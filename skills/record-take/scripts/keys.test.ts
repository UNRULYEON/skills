import { describe, expect, it } from "bun:test";
import { readKeyPress, readTypedKeys } from "./keys.ts";

describe("readKeyPress", () => {
  it("reads a named key without modifiers", () => {
    expect(readKeyPress("down")).toEqual({ code: 125, flags: 0 });
  });

  it("adds the flag of every modifier", () => {
    expect(readKeyPress("cmd+k")).toEqual({ code: 40, flags: 0x100000 });
    expect(readKeyPress("cmd+shift+k")).toEqual({ code: 40, flags: 0x120000 });
  });

  it("reads a bracket key", () => {
    expect(readKeyPress("[")).toEqual({ code: 33, flags: 0 });
  });

  it("rejects an unknown key", () => {
    expect(() => readKeyPress("cmd+f13")).toThrow('Unknown key "f13"');
  });

  it("rejects an unknown modifier", () => {
    expect(() => readKeyPress("hyper+k")).toThrow('Unknown modifier "hyper"');
  });
});

describe("readTypedKeys", () => {
  it("types letters and spaces with their own key codes", () => {
    expect(readTypedKeys("k l")).toEqual([
      { code: 40, flags: 0 },
      { code: 49, flags: 0 },
      { code: 37, flags: 0 },
    ]);
  });

  it("holds shift for a capital letter", () => {
    expect(readTypedKeys("K")).toEqual([{ code: 40, flags: 0x20000 }]);
  });

  it("sends other characters as text", () => {
    expect(readTypedKeys("é&")).toEqual([{ text: "é" }, { text: "&" }]);
  });
});
