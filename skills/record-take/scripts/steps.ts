import type { Delay } from "./random.ts";

export interface Point {
  x: number;
  y: number;
}

export interface Area extends Point {
  width: number;
  height: number;
}

export interface TextTarget {
  text?: string;
  with?: string;
  selector?: string;
  at?: Point;
}

export type Target =
  | { text: string; with?: string; at?: Point }
  | { selector: string; at?: Point }
  | Point;

export type ScrollEdge = "top" | "bottom";

export type Step =
  | { wait: number }
  | { waitFor: Target; timeout?: number }
  | { moveTo: Target; duration?: number }
  | { click: Target; duration?: number }
  | { doubleClick: Target; duration?: number }
  | { rightClick: Target; duration?: number }
  | { drag: Target; to: Target; duration?: number }
  | { scroll: number | ScrollEdge; duration?: number }
  | { scrollTo: Exclude<Target, Point>; duration?: number }
  | { type: string; delay?: Delay; submit?: boolean }
  | { press: string; times?: number; delay?: Delay }
  | { pressUntil: string; highlighted: TextTarget; delay?: Delay; limit?: number }
  | { zoom: number; at?: Target; duration?: number }
  | { go: string }
  | { eval: string };

export interface Take {
  url: string;
  width: number;
  height: number;
  ready?: Target;
  cursor?: Point;
  settle?: number;
  seed?: number;
  setup?: Step[];
  steps: Step[];
  loop?: boolean;
}

const STEP_KINDS = [
  "wait",
  "waitFor",
  "moveTo",
  "click",
  "doubleClick",
  "rightClick",
  "drag",
  "scroll",
  "scrollTo",
  "type",
  "press",
  "pressUntil",
  "zoom",
  "go",
  "eval",
];
const LOOP_RETURN_DURATION = 700;
const LOOP_HOLD = 1000;

export function readTake(exports: { TAKE?: Take }): Take {
  const take = exports.TAKE;
  if (!take) throw new Error("The take file must export TAKE.");
  for (const step of [...(take.setup ?? []), ...take.steps]) {
    if (!STEP_KINDS.some((kind) => kind in step)) {
      throw new Error(`Unknown step: ${JSON.stringify(step)}`);
    }
  }
  return take;
}

export function toScreenPoint(area: Area, point: Point): Point {
  return { x: area.x + point.x, y: area.y + point.y };
}

export function readCursorStart(take: Take): Point {
  return take.cursor ?? { x: take.width / 2, y: take.height / 2 };
}

export function readRecordedSteps(take: Take): Step[] {
  if (!take.loop) return take.steps;
  return [
    ...take.steps,
    { moveTo: readCursorStart(take), duration: LOOP_RETURN_DURATION },
    { wait: LOOP_HOLD },
  ];
}

export function readZoomOrigin(center: Point, viewport: Point, scale: number): Point {
  if (scale <= 1) return center;
  const middle = { x: viewport.x / 2, y: viewport.y / 2 };
  return {
    x: Math.min(Math.max((scale * center.x - middle.x) / (scale - 1), 0), viewport.x),
    y: Math.min(Math.max((scale * center.y - middle.y) / (scale - 1), 0), viewport.y),
  };
}

export interface Zoom {
  scale: number;
  origin: Point;
}

export function toLayoutPoint(point: Point, zoom: Zoom): Point {
  return {
    x: zoom.origin.x + (point.x - zoom.origin.x) / zoom.scale,
    y: zoom.origin.y + (point.y - zoom.origin.y) / zoom.scale,
  };
}
