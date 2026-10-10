/// <reference lib="dom" />

import { execFile } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { promisify } from "node:util";
import type { Area, Point, ScrollEdge, Target, TextTarget } from "./steps.ts";

interface Geometry {
  screenX: number;
  screenY: number;
  outerHeight: number;
  innerWidth: number;
  innerHeight: number;
}

const POLL_INTERVAL = 100;
const LOAD_TIMEOUT = 30_000;
const WINDOW_RESIZE_DELAY = 400;
const WINDOW_ORIGIN = { x: 100, y: 100 };
const JAVASCRIPT_SETTING_HINT =
  'Turn on Safari > Develop > "Allow JavaScript from Apple Events", then try again.';

const run = promisify(execFile);

export async function openWindow(url: string): Promise<number> {
  const id = await runAppleScript(
    'tell application "Safari"',
    "activate",
    "make new document with properties {URL: item 1 of argv}",
    "return id of front window",
    "end tell",
  )(url);
  return Number(id);
}

export async function closeWindow(id: number): Promise<void> {
  await runAppleScript(`tell application "Safari" to close window id ${id}`)();
}

export async function navigate(id: number, url: string): Promise<void> {
  await runAppleScript(
    `tell application "Safari" to set URL of current tab of window id ${id} to item 1 of argv`,
  )(url);
  await waitForLoad(id);
}

export async function waitForLoad(id: number): Promise<void> {
  await sleep(WINDOW_RESIZE_DELAY);
  await poll(`the page in window ${id} to load`, Date.now() + LOAD_TIMEOUT, async () => {
    const state = await runJavaScript<string>(id, "return document.readyState");
    return state === "complete" ? true : null;
  });
}

export async function placeWindow(id: number, width: number, height: number): Promise<Area> {
  await runAppleScript(
    'tell application "Safari"',
    "activate",
    `set index of window id ${id} to 1`,
    "end tell",
  )();
  await setWindowBounds(id, width, height);
  const first = await readGeometry(id);
  await setWindowBounds(id, width, height + first.outerHeight - first.innerHeight);
  const geometry = await readGeometry(id);

  if (geometry.innerWidth !== width || geometry.innerHeight !== height) {
    console.warn(
      `The page is ${geometry.innerWidth}x${geometry.innerHeight}, not ${width}x${height}. Is the screen big enough?`,
    );
  }

  return {
    x: geometry.screenX,
    y: geometry.screenY + geometry.outerHeight - geometry.innerHeight,
    width: geometry.innerWidth,
    height: geometry.innerHeight,
  };
}

export async function findTarget(
  id: number,
  target: Target,
  timeout: number,
  mustBeVisible = true,
): Promise<Point> {
  if ("x" in target) return target;
  return poll(JSON.stringify(target), Date.now() + timeout, () =>
    runJavaScript<Point | null>(
      id,
      `return (${findCenter.toString()})(${readMatchingRects.toString()}, ${JSON.stringify(target)}, ${mustBeVisible})`,
    ),
  );
}

export async function readScrollDistance(
  id: number,
  point: Point,
  goal: ScrollEdge | TextTarget,
): Promise<number> {
  const distance = await runJavaScript<number | null>(
    id,
    `return (${findScrollDistance.toString()})(${findScroller.toString()}, ${readMatchingRects.toString()}, ${JSON.stringify(point)}, ${JSON.stringify(goal)})`,
  );
  if (distance === null) {
    throw new Error(`Could not find ${JSON.stringify(goal)} on the page, even outside the view.`);
  }
  return distance;
}

export function setZoom(
  id: number,
  scale: number,
  origin: Point | null,
  duration: number,
): Promise<boolean> {
  return runJavaScript<boolean>(
    id,
    `return (${applyZoom.toString()})(${scale}, ${JSON.stringify(origin)}, ${duration})`,
  );
}

export function isHighlighted(id: number, target: TextTarget): Promise<boolean> {
  return runJavaScript<boolean>(
    id,
    `return (${readIsHighlighted.toString()})(${JSON.stringify(target)})`,
  );
}

export async function runJavaScript<T>(id: number, body: string): Promise<T> {
  const source = `(() => { try { return JSON.stringify({ value: (() => { ${body} })() ?? null }); } catch (error) { return JSON.stringify({ error: String(error) }); } })()`;
  const output = await runAppleScript(
    `tell application "Safari" to do JavaScript (item 1 of argv) in current tab of window id ${id}`,
  )(source).catch((cause: unknown) => {
    const message = cause instanceof Error ? cause.message : String(cause);
    throw new Error(message.includes("Allow JavaScript") ? JAVASCRIPT_SETTING_HINT : message);
  });
  const result = JSON.parse(output) as { value: T } | { error: string };
  if ("error" in result) throw new Error(`The page script failed: ${result.error}`);
  return result.value;
}

function runAppleScript(...lines: string[]): (...args: string[]) => Promise<string> {
  const script = ["on run argv", ...lines, "end run"].flatMap((line) => ["-e", line]);
  return async (...args) => {
    const { stdout } = await run("osascript", [...script, ...args]);
    return stdout.trim();
  };
}

async function setWindowBounds(id: number, width: number, height: number): Promise<void> {
  const { x, y } = WINDOW_ORIGIN;
  await runAppleScript(
    `tell application "Safari" to set bounds of window id ${id} to {${x}, ${y}, ${x + width}, ${y + height}}`,
  )();
  await sleep(WINDOW_RESIZE_DELAY);
}

function readGeometry(id: number): Promise<Geometry> {
  return runJavaScript<Geometry>(
    id,
    "return { screenX, screenY, outerHeight, innerWidth, innerHeight }",
  );
}

async function poll<T>(label: string, deadline: number, read: () => Promise<T | null>): Promise<T> {
  const value = await read();
  if (value !== null) return value;
  if (Date.now() > deadline) throw new Error(`Timed out while waiting for ${label}.`);
  await sleep(POLL_INTERVAL);
  return poll(label, deadline, read);
}

function readMatchingRects(target: TextTarget): DOMRect[] {
  const elements = [...document.querySelectorAll(target.selector ?? "body *")];
  const matches = target.selector
    ? elements
    : elements.filter((element) => {
        const text = element instanceof HTMLElement ? element.innerText?.trim() : undefined;
        if (target.with) {
          return Boolean(text?.includes(target.text ?? "") && text.includes(target.with));
        }
        return element.getAttribute("aria-label") === target.text || text === target.text;
      });
  return matches
    .map((element) => element.getBoundingClientRect())
    .filter((box) => box.width > 0 && box.height > 0)
    .toSorted((a, b) => a.width * a.height - b.width * b.height);
}

function findScroller(point: Point): Element {
  let element = document.elementFromPoint(point.x, point.y);
  while (element && element !== document.documentElement) {
    const { overflowY } = getComputedStyle(element);
    const canScroll = overflowY === "auto" || overflowY === "scroll";
    if (canScroll && element.scrollHeight > element.clientHeight + 1) return element;
    element = element.parentElement;
  }
  return document.scrollingElement ?? document.documentElement;
}

function findCenter(
  readRects: typeof readMatchingRects,
  target: TextTarget,
  mustBeVisible: boolean,
): Point | null {
  const [rect] = readRects(target);
  if (!rect) return null;
  const isVisible =
    rect.bottom > 0 &&
    rect.right > 0 &&
    rect.top < window.innerHeight &&
    rect.left < window.innerWidth;
  if (mustBeVisible && !isVisible) return null;
  const at = target.at ?? { x: 0.5, y: 0.5 };
  return { x: rect.left + rect.width * at.x, y: rect.top + rect.height * at.y };
}

function findScrollDistance(
  readScroller: typeof findScroller,
  readRects: typeof readMatchingRects,
  point: Point,
  goal: ScrollEdge | TextTarget,
): number | null {
  const scroller = readScroller(point);
  const top = -scroller.scrollTop;
  const bottom = scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop;
  if (goal === "top") return top;
  if (goal === "bottom") return bottom;

  const [rect] = readRects(goal);
  if (!rect) return null;
  const frame = scroller.getBoundingClientRect();
  const offset = rect.top + rect.height / 2 - (frame.top + scroller.clientHeight / 2);
  return Math.round(Math.min(Math.max(offset, top), bottom));
}

function readIsHighlighted(target: TextTarget): boolean {
  const element = document.querySelector(target.selector ?? "[data-highlighted]");
  const text = element instanceof HTMLElement ? element.innerText : "";
  return text.includes(target.text ?? "") && text.includes(target.with ?? "");
}

function applyZoom(scale: number, origin: Point | null, duration: number): boolean {
  const { body, documentElement } = document;
  const isZoomed = body.style.transform !== "" && body.style.transform !== "scale(1)";
  const easing = "cubic-bezier(0.65, 0, 0.35, 1)";
  documentElement.style.overflow = "hidden";
  if (origin && !isZoomed) {
    body.style.transition = "none";
    body.style.transformOrigin = `${origin.x}px ${origin.y}px`;
    body.getBoundingClientRect();
  }
  body.style.transition = `transform ${duration}ms ${easing}, transform-origin ${duration}ms ${easing}`;
  body.getBoundingClientRect();
  if (origin && isZoomed) body.style.transformOrigin = `${origin.x}px ${origin.y}px`;
  body.style.transform = `scale(${scale})`;
  if (scale === 1) {
    setTimeout(() => {
      body.style.removeProperty("transform");
      body.style.removeProperty("transform-origin");
      body.style.removeProperty("transition");
      documentElement.style.removeProperty("overflow");
    }, duration);
  }
  return true;
}
