import { describe, expect, it } from "vitest";
import { activeCueIndex } from "../cues";

const cues = [
  { start: 0, end: 2, text: "a" },
  { start: 5, end: 7, text: "b" },
  { start: 10, end: 12, text: "c" },
];

describe("activeCueIndex", () => {
  it("returns -1 before the first cue", () => {
    expect(activeCueIndex(cues, -1)).toBe(-1);
  });

  it("stays on a cue until the next one starts", () => {
    expect(activeCueIndex(cues, 0)).toBe(0);
    expect(activeCueIndex(cues, 4)).toBe(0);
  });

  it("advances with a small lead", () => {
    expect(activeCueIndex(cues, 5)).toBe(1); // 5 <= 5 + 0.15
    expect(activeCueIndex(cues, 9)).toBe(1);
    expect(activeCueIndex(cues, 10)).toBe(2);
  });

  it("clamps to the last cue past the end", () => {
    expect(activeCueIndex(cues, 999)).toBe(2);
  });

  it("handles an empty transcript", () => {
    expect(activeCueIndex([], 5)).toBe(-1);
  });
});
