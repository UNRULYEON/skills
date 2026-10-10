import { describe, expect, it } from "bun:test";
import {
  readCursorStart,
  readRecordedSteps,
  readTake,
  readZoomOrigin,
  toLayoutPoint,
  toScreenPoint,
} from "./steps.ts";

describe("toScreenPoint", () => {
  it("moves a page point by the page area origin", () => {
    const area = { x: 100, y: 204, width: 1280, height: 800 };
    expect(toScreenPoint(area, { x: 40, y: 60 })).toEqual({ x: 140, y: 264 });
  });
});

describe("readCursorStart", () => {
  const take = { url: "https://example.com", width: 1280, height: 800, steps: [] };

  it("starts in the middle of the page", () => {
    expect(readCursorStart(take)).toEqual({ x: 640, y: 400 });
  });

  it("starts at the given cursor point", () => {
    expect(readCursorStart({ ...take, cursor: { x: 20, y: 30 } })).toEqual({ x: 20, y: 30 });
  });
});

describe("readRecordedSteps", () => {
  const take = {
    url: "https://example.com",
    width: 1280,
    height: 800,
    steps: [{ click: { text: "Albums" } }],
  };

  it("keeps the steps when the take does not loop", () => {
    expect(readRecordedSteps(take)).toEqual(take.steps);
  });

  it("moves the cursor back to the start when the take loops", () => {
    expect(readRecordedSteps({ ...take, loop: true })).toEqual([
      { click: { text: "Albums" } },
      { moveTo: { x: 640, y: 400 }, duration: 700 },
      { wait: 1000 },
    ]);
  });
});

describe("readZoomOrigin", () => {
  const viewport = { x: 1280, y: 800 };

  it("moves the target to the middle of the view", () => {
    const origin = readZoomOrigin({ x: 640, y: 290 }, viewport, 1.4);
    expect(origin.x).toBeCloseTo(640);
    expect(origin.y).toBeCloseTo(15);
    expect(origin.y + 1.4 * (290 - origin.y)).toBeCloseTo(400);
  });

  it("keeps the origin inside the view so no empty edge shows", () => {
    expect(readZoomOrigin({ x: 40, y: 20 }, viewport, 1.5)).toEqual({ x: 0, y: 0 });
  });

  it("keeps the center when the page does not grow", () => {
    expect(readZoomOrigin({ x: 100, y: 200 }, viewport, 1)).toEqual({ x: 100, y: 200 });
  });
});

describe("toLayoutPoint", () => {
  it("keeps a point when the page is not zoomed", () => {
    expect(toLayoutPoint({ x: 300, y: 200 }, { scale: 1, origin: { x: 0, y: 0 } })).toEqual({
      x: 300,
      y: 200,
    });
  });

  it("undoes the zoom around its origin", () => {
    expect(toLayoutPoint({ x: 280, y: 240 }, { scale: 2, origin: { x: 0, y: 800 } })).toEqual({
      x: 140,
      y: 520,
    });
  });
});

describe("readTake", () => {
  const take = { url: "https://example.com", width: 1280, height: 800, steps: [{ wait: 100 }] };

  it("gives the exported take", () => {
    expect(readTake({ TAKE: take })).toBe(take);
  });

  it("rejects a file without a take", () => {
    expect(() => readTake({})).toThrow("must export TAKE");
  });

  it("rejects a step of an unknown kind", () => {
    const steps = [{ clik: { text: "Play" } }] as never;
    expect(() => readTake({ TAKE: { ...take, steps } })).toThrow("Unknown step");
  });
});
