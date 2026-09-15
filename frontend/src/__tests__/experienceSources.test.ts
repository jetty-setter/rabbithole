import { describe, expect, it } from "vitest";

import type { RabbitHole } from "../api";
import { buildSourceIdIndex, resolveSourceRefs } from "../experiences/sources";
import fixture from "./fixtures-qwerty.json";

const QWERTY = fixture as unknown as RabbitHole;

describe("buildSourceIdIndex", () => {
  it("maps every source_id referenced in the article's own citations to its display number", () => {
    const index = buildSourceIdIndex(QWERTY);
    // QWERTY's fixture cites at least sources 1-5 somewhere across its
    // facts/contested items/timeline -- confirm the index actually found
    // real mappings, not an empty map.
    expect(index.size).toBeGreaterThan(0);
    for (const [, number] of index) {
      expect(number).toBeGreaterThanOrEqual(1);
    }
  });

  it("resolves the exact source_id a What We Know fact cites", () => {
    const index = buildSourceIdIndex(QWERTY);
    const firstFact = QWERTY.what_we_know[0];
    const firstCitation = firstFact.citations[0];
    expect(index.get(firstCitation.source_id)).toBe(firstCitation.number);
  });
});

describe("resolveSourceRefs", () => {
  it("resolves known source ids to real RhCitation objects", () => {
    const index = new Map([
      ["s10", 1],
      ["s11", 2],
    ]);
    const resolved = resolveSourceRefs([{ sourceId: "s10" }, { sourceId: "s11" }], index);
    expect(resolved).toEqual([
      { source_id: "s10", number: 1 },
      { source_id: "s11", number: 2 },
    ]);
  });

  it("silently drops a source id that isn't in the index, rather than throwing", () => {
    const index = new Map([["s10", 1]]);
    const resolved = resolveSourceRefs([{ sourceId: "s10" }, { sourceId: "s999" }], index);
    expect(resolved).toEqual([{ source_id: "s10", number: 1 }]);
  });

  it("returns an empty array for undefined or empty refs", () => {
    const index = new Map([["s10", 1]]);
    expect(resolveSourceRefs(undefined, index)).toEqual([]);
    expect(resolveSourceRefs([], index)).toEqual([]);
  });
});
