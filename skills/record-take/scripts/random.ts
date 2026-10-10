export type Delay = number | { min: number; max: number };

export type Random = () => number;

const MULBERRY_INCREMENT = 0x6d2b79f5;

export function createRandom(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (state + MULBERRY_INCREMENT) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function readDelay(delay: Delay, random: Random): number {
  if (typeof delay === "number") return delay;
  return Math.round(delay.min + (delay.max - delay.min) * random());
}
