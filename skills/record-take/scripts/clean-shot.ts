import { execFile } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { promisify } from "node:util";
import { readKeyPress } from "./keys.ts";
import type { Pointer } from "./pointer.ts";
import type { Point } from "./steps.ts";

const APP = "CleanShot X";
const POLL_INTERVAL = 100;
const STABLE_DURATION = 700;
const OVERLAY_TIMEOUT = 15_000;
const START_TIMEOUT = 8000;
const WINDOW_MODE_DELAY = 400;
const HOVER_DURATION = 150;
const HOVER_OFFSET = 4;
const STOP_DELAY = 500;
const START_KEY_DELAY = 400;

const run = promisify(execFile);

export async function startRecording(pointer: Pointer, windowPoint: Point): Promise<void> {
  const idle = await readWindows(pointer);
  await run("open", ["cleanshot://record-screen"]);
  const overlay = await waitForWindows(
    pointer,
    "the CleanShot X overlay",
    [idle],
    Date.now() + OVERLAY_TIMEOUT,
  );

  try {
    await pointer.send({ command: "key", ...readKeyPress("space") });
    await sleep(WINDOW_MODE_DELAY);
    await pointer.send({
      command: "move",
      x: windowPoint.x + HOVER_OFFSET,
      y: windowPoint.y + HOVER_OFFSET,
      duration: HOVER_DURATION,
    });
    await pointer.send({ command: "move", ...windowPoint, duration: HOVER_DURATION });
    await pointer.send({ command: "click" });

    await sleep(START_KEY_DELAY);
    await pointer.send({ command: "key", ...readKeyPress("return") });
    await waitForWindows(
      pointer,
      "the recording to start",
      [idle, overlay],
      Date.now() + START_TIMEOUT,
    );
  } catch (cause) {
    await pointer.send({ command: "key", ...readKeyPress("escape") });
    throw cause;
  }
}

export async function stopRecording(pointer: Pointer, shortcut: string): Promise<void> {
  await sleep(STOP_DELAY);
  await pointer.send({ command: "key", ...readKeyPress(shortcut) });
}

function readWindows(pointer: Pointer): Promise<string> {
  return pointer.send({ command: "windows", owner: APP });
}

async function waitForWindows(
  pointer: Pointer,
  label: string,
  known: string[],
  deadline: number,
  last = "",
  since = Date.now(),
): Promise<string> {
  const windows = await readWindows(pointer);
  const isStable = windows === last && Date.now() - since >= STABLE_DURATION;
  if (isStable && !known.includes(windows)) return windows;
  if (Date.now() > deadline) throw new Error(`Timed out while waiting for ${label}.`);
  await sleep(POLL_INTERVAL);
  return waitForWindows(
    pointer,
    label,
    known,
    deadline,
    windows,
    windows === last ? since : Date.now(),
  );
}
