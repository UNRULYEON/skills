#!/usr/bin/env bun

import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { setTimeout as sleep } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { startRecording, stopRecording } from "./clean-shot.ts";
import { readKeyPress, readTypedKeys, type TypedKey } from "./keys.ts";
import { openPointer, type Pointer } from "./pointer.ts";
import { createRandom, type Delay, type Random, readDelay } from "./random.ts";
import {
  closeWindow,
  findTarget,
  isHighlighted,
  navigate,
  openWindow,
  placeWindow,
  readScrollDistance,
  runJavaScript,
  setZoom,
  waitForLoad,
} from "./safari.ts";
import {
  type Area,
  type Point,
  readCursorStart,
  readRecordedSteps,
  readTake,
  readZoomOrigin,
  type Step,
  type Take,
  type Target,
  type TextTarget,
  toLayoutPoint,
  toScreenPoint,
  type Zoom,
} from "./steps.ts";

interface Run {
  windowId: number;
  area: Area;
  pointer: Pointer;
  cursor: Point;
  random: Random;
  zoom: Zoom;
}

const DEFAULT_SETTLE = 1500;
const DEFAULT_MOVE_DURATION = 700;
const DEFAULT_SCROLL_DURATION = 1000;
const DEFAULT_TYPE_DELAY = 60;
const TARGET_TIMEOUT = 10_000;
const CLICK_PAUSE = 120;
const DEFAULT_PRESS_DELAY = 250;
const DEFAULT_PRESS_LIMIT = 30;
const DEFAULT_SEED = 1;
const DEFAULT_ZOOM_DURATION = 900;
const NO_ZOOM: Zoom = { scale: 1, origin: { x: 0, y: 0 } };
const INTERRUPTED_EXIT_CODE = 130;
const DEFAULT_STOP_SHORTCUT = "ctrl+alt+cmd+r";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    rehearse: { type: "boolean", short: "r" },
    warmup: { type: "boolean", short: "w" },
    help: { type: "boolean", short: "h" },
  },
});

const takePath = positionals[0];
const stopShortcut = process.env.CLEANSHOT_STOP_SHORTCUT ?? DEFAULT_STOP_SHORTCUT;

if (values.help || !takePath) {
  usage();
  process.exit(values.help ? 0 : 1);
}

const TAKE = readTake((await import(pathToFileURL(resolve(takePath)).href)) as { TAKE?: Take });
const pointer = await openPointer();
const windowId = await openWindow(TAKE.url);
let isRecording = false;
let isCleanedUp = false;

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void cleanUp().finally(() => process.exit(INTERRUPTED_EXIT_CODE));
  });
}

try {
  await waitForLoad(windowId);
  let area = await placeWindow(windowId, TAKE.width, TAKE.height);
  if (values.warmup) {
    await waitForWarmup();
    area = await placeWindow(windowId, TAKE.width, TAKE.height);
  }
  console.log("Page area on screen:", area);

  if (TAKE.ready) await findTarget(windowId, TAKE.ready, TARGET_TIMEOUT);
  const current: Run = {
    windowId,
    area,
    pointer,
    cursor: readCursorStart(TAKE),
    random: createRandom(TAKE.seed ?? DEFAULT_SEED),
    zoom: NO_ZOOM,
  };
  if (TAKE.setup) {
    console.log("Setup:");
    await runSteps(current, TAKE.setup);
  }
  current.cursor = readCursorStart(TAKE);
  current.random = createRandom(TAKE.seed ?? DEFAULT_SEED);
  const cursorStart = toScreenPoint(area, current.cursor);
  await pointer.send({ command: "move", ...cursorStart });
  await sleep(TAKE.settle ?? DEFAULT_SETTLE);

  if (!values.rehearse) {
    await startRecording(pointer, cursorStart);
    isRecording = true;
    console.log("The recording is on.");
  }
  await runSteps(current, readRecordedSteps(TAKE));
} finally {
  await cleanUp();
}

async function cleanUp(): Promise<void> {
  if (isCleanedUp) return;
  isCleanedUp = true;
  if (isRecording) await stopRecording(pointer, stopShortcut);
  pointer.close();
  await closeWindow(windowId).catch((cause: unknown) => {
    console.warn(`Could not close the Safari window: ${String(cause)}`);
  });
}

function usage(): void {
  console.log(`Usage: bun index.ts <take-file> [--rehearse] [--warmup]

Runs a take in your normal Safari and records the Safari window with CleanShot X.

  -r, --rehearse  Run the steps without recording
  -w, --warmup    Pause after the page loads, so you can prepare the window by hand
  -h, --help      Show this help

Environment:
  CLEANSHOT_STOP_SHORTCUT  The CleanShot "Record screen" shortcut (default: ${DEFAULT_STOP_SHORTCUT})`);
}

async function waitForWarmup(): Promise<void> {
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  prompt.on("SIGINT", () => process.kill(process.pid, "SIGINT"));
  await prompt.question("Prepare the Safari window, then press Enter here to continue.");
  prompt.close();
}

async function runSteps(current: Run, steps: Step[], index = 0): Promise<void> {
  const step = steps[index];
  if (!step) return;
  console.log(`${index + 1}/${steps.length}`, JSON.stringify(step));
  await runStep(current, step);
  await runSteps(current, steps, index + 1);
}

async function runStep(current: Run, step: Step): Promise<void> {
  if ("wait" in step) {
    await sleep(step.wait);
  } else if ("waitFor" in step) {
    await findTarget(current.windowId, step.waitFor, step.timeout ?? TARGET_TIMEOUT);
  } else if ("moveTo" in step) {
    await moveToTarget(current, step.moveTo, step.duration ?? DEFAULT_MOVE_DURATION);
  } else if ("click" in step) {
    await moveToTarget(current, step.click, step.duration ?? DEFAULT_MOVE_DURATION);
    await sleep(CLICK_PAUSE);
    await current.pointer.send({ command: "click" });
  } else if ("doubleClick" in step) {
    await moveToTarget(current, step.doubleClick, step.duration ?? DEFAULT_MOVE_DURATION);
    await sleep(CLICK_PAUSE);
    await current.pointer.send({ command: "doubleClick" });
  } else if ("rightClick" in step) {
    await moveToTarget(current, step.rightClick, step.duration ?? DEFAULT_MOVE_DURATION);
    await sleep(CLICK_PAUSE);
    await current.pointer.send({ command: "rightClick" });
  } else if ("drag" in step) {
    await moveToTarget(current, step.drag, DEFAULT_MOVE_DURATION);
    await sleep(CLICK_PAUSE);
    await current.pointer.send({ command: "down" });
    await sleep(CLICK_PAUSE);
    await moveToTarget(current, step.to, step.duration ?? DEFAULT_MOVE_DURATION);
    await sleep(CLICK_PAUSE);
    await current.pointer.send({ command: "up" });
  } else if ("scroll" in step) {
    const distance =
      typeof step.scroll === "number"
        ? step.scroll
        : await readScrollDistance(current.windowId, current.cursor, step.scroll);
    await current.pointer.send({
      command: "scroll",
      distance,
      duration: step.duration ?? DEFAULT_SCROLL_DURATION,
    });
  } else if ("type" in step) {
    await typeKeys(current, readTypedKeys(step.type), step.delay ?? DEFAULT_TYPE_DELAY);
    if (step.submit) await current.pointer.send({ command: "key", ...readKeyPress("return") });
  } else if ("press" in step) {
    await pressKey(current, step.press, step.times ?? 1, step.delay ?? DEFAULT_PRESS_DELAY);
  } else if ("pressUntil" in step) {
    await pressUntilHighlighted(
      current,
      step.pressUntil,
      step.highlighted,
      step.delay ?? DEFAULT_PRESS_DELAY,
      step.limit ?? DEFAULT_PRESS_LIMIT,
    );
  } else if ("scrollTo" in step) {
    const distance = await readScrollDistance(current.windowId, current.cursor, step.scrollTo);
    await current.pointer.send({
      command: "scroll",
      distance,
      duration: step.duration ?? DEFAULT_SCROLL_DURATION,
    });
  } else if ("zoom" in step) {
    await zoomTo(current, step.zoom, step.at, step.duration ?? DEFAULT_ZOOM_DURATION);
  } else if ("go" in step) {
    await navigate(current.windowId, step.go);
  } else {
    const result = await runJavaScript(current.windowId, step.eval);
    if (result !== null) console.log(result);
  }
}

async function pressKey(current: Run, key: string, times: number, delay: Delay): Promise<void> {
  if (times <= 0) return;
  await current.pointer.send({ command: "key", ...readKeyPress(key) });
  if (times > 1) await sleep(readDelay(delay, current.random));
  await pressKey(current, key, times - 1, delay);
}

async function pressUntilHighlighted(
  current: Run,
  key: string,
  target: TextTarget,
  delay: Delay,
  limit: number,
): Promise<void> {
  if (await isHighlighted(current.windowId, target)) return;
  if (limit <= 0)
    throw new Error(`Pressed ${key} but ${JSON.stringify(target)} was never highlighted.`);
  await current.pointer.send({ command: "key", ...readKeyPress(key) });
  await sleep(readDelay(delay, current.random));
  await pressUntilHighlighted(current, key, target, delay, limit - 1);
}

async function typeKeys(current: Run, keys: TypedKey[], delay: Delay): Promise<void> {
  const [key, ...rest] = keys;
  if (!key) return;
  await current.pointer.send(
    "text" in key ? { command: "type", text: key.text } : { command: "key", ...key },
  );
  await sleep(readDelay(delay, current.random));
  await typeKeys(current, rest, delay);
}

async function moveToTarget(current: Run, target: Target, duration: number): Promise<void> {
  const point = await findTarget(current.windowId, target, TARGET_TIMEOUT);
  await current.pointer.send({ command: "move", ...toScreenPoint(current.area, point), duration });
  current.cursor = point;
}

async function zoomTo(
  current: Run,
  scale: number,
  at: Target | undefined,
  duration: number,
): Promise<void> {
  const center = at ? await readLayoutCenter(current, at) : null;
  const viewport = { x: current.area.width, y: current.area.height };
  const origin = center ? readZoomOrigin(center, viewport, scale) : null;
  await setZoom(current.windowId, scale, origin, duration);
  await sleep(duration);
  current.zoom = scale === 1 ? NO_ZOOM : { scale, origin: origin ?? current.zoom.origin };
}

async function readLayoutCenter(current: Run, target: Target): Promise<Point> {
  if ("x" in target) return target;
  const point = await findTarget(current.windowId, target, TARGET_TIMEOUT, false);
  return toLayoutPoint(point, current.zoom);
}
