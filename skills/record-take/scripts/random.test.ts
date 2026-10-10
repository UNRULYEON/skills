import { describe, expect, it } from "bun:test";
import { createRandom, readDelay } from "./random.ts";

describe("createRandom", () => {
  it("gives the same numbers for the same seed", () => {
    const first = createRandom(7);
    const second = createRandom(7);
    expect([first(), first(), first()]).toEqual([second(), second(), second()]);
  });

  it("gives other numbers for another seed", () => {
    expect(createRandom(1)()).not.toBe(createRandom(2)());
  });

  it("stays between 0 and 1", () => {
    const random = createRandom(42);
    const values = Array.from({ length: 1000 }, random);
    expect(values.every((value) => value >= 0 && value < 1)).toBe(true);
  });
});

describe("readDelay", () => {
  it("keeps a fixed delay", () => {
    expect(readDelay(250, createRandom(1))).toBe(250);
  });

  it("picks a delay inside the range", () => {
    const random = createRandom(3);
    const delays = Array.from({ length: 200 }, () => readDelay({ min: 100, max: 300 }, random));
    expect(delays.every((delay) => delay >= 100 && delay <= 300)).toBe(true);
    expect(new Set(delays).size).toBeGreaterThan(10);
  });
});
