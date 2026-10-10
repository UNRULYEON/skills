export interface KeyPress {
  code: number;
  flags: number;
}

export type TypedKey = KeyPress | { text: string };

const KEY_CODES: Record<string, number> = {
  a: 0,
  s: 1,
  d: 2,
  f: 3,
  h: 4,
  g: 5,
  z: 6,
  x: 7,
  c: 8,
  v: 9,
  b: 11,
  q: 12,
  w: 13,
  e: 14,
  r: 15,
  y: 16,
  t: 17,
  o: 31,
  u: 32,
  i: 34,
  p: 35,
  l: 37,
  j: 38,
  k: 40,
  n: 45,
  m: 46,
  return: 36,
  enter: 36,
  tab: 48,
  space: 49,
  delete: 51,
  escape: 53,
  left: 123,
  right: 124,
  down: 125,
  up: 126,
  "[": 33,
  "]": 30,
};

const SHIFT_FLAG = 0x20000;

const MODIFIER_FLAGS: Record<string, number> = {
  shift: SHIFT_FLAG,
  ctrl: 0x40000,
  alt: 0x80000,
  opt: 0x80000,
  cmd: 0x100000,
};

export function readKeyPress(shortcut: string): KeyPress {
  const parts = shortcut.toLowerCase().split("+");
  const key = parts.pop() ?? "";
  const code = KEY_CODES[key];
  if (code === undefined) throw new Error(`Unknown key "${key}" in "${shortcut}".`);

  const flags = parts.reduce((total, part) => {
    const flag = MODIFIER_FLAGS[part];
    if (flag === undefined) throw new Error(`Unknown modifier "${part}" in "${shortcut}".`);
    return total | flag;
  }, 0);
  return { code, flags };
}

export function readTypedKeys(text: string): TypedKey[] {
  return [...text].map((character) => {
    const lower = character.toLowerCase();
    const code =
      character === " " ? KEY_CODES.space : /^[a-z]$/.test(lower) ? KEY_CODES[lower] : undefined;
    if (code === undefined) return { text: character };
    return { code, flags: character === lower ? 0 : SHIFT_FLAG };
  });
}
