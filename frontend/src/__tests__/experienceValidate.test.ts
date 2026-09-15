import { describe, expect, it } from "vitest";

import { validateExperience } from "../experiences/validate";
import wowSignalRaw from "../experiences/wow-signal.experience.json";

function minimalExperience() {
  return {
    id: "test-experience",
    slug: "test-rabbithole",
    title: "Examine the test",
    invitation: "Examine it",
    artifacts: [
      {
        id: "artifact-1",
        kind: "image",
        url: "/test.webp",
        hotspots: [
          {
            id: "hotspot-1",
            region: { left: 10, top: 10, width: 20, height: 20 },
            label: "Spot",
            explain: "A region of the image.",
            selects: { kind: "sequence", id: "sequence-1" },
          },
        ],
      },
    ],
    evidence: [
      { id: "fact-1", label: "Fact one", statement: "The first fact." },
      { id: "fact-2", label: "Fact two", statement: "The second fact." },
    ],
    sequences: [
      {
        id: "sequence-1",
        kind: "replay",
        title: "Replay",
        totalSeconds: 10,
        steps: [
          { id: "step-1", order: 0, label: "A", meaning: "Step A.", evidenceId: "fact-1" },
          { id: "step-2", order: 1, label: "B", meaning: "Step B." },
        ],
      },
    ],
    hypotheses: [
      {
        id: "hyp-1",
        label: "Hypothesis one",
        status: "contested",
        thesis: "A thesis.",
        evidence: [
          { evidenceId: "fact-1", verdict: "supports" },
          { evidenceId: "fact-2", verdict: "weakens" },
        ],
      },
    ],
    matrix: { evidenceIds: ["fact-1", "fact-2"] },
  };
}

describe("validateExperience — the real shipped Wow! Signal file", () => {
  it("accepts wow-signal.experience.json as-is", () => {
    const result = validateExperience(wowSignalRaw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.experience.slug).toBe("the-wow-signal");
      expect(result.experience.hypotheses).toHaveLength(4);
      expect(result.experience.evidence).toHaveLength(7);
      expect(result.experience.sequences).toHaveLength(2);
    }
  });
});

describe("validateExperience — a minimal valid experience", () => {
  it("accepts a well-formed minimal experience", () => {
    const result = validateExperience(minimalExperience());
    expect(result.ok).toBe(true);
  });

  it("rejects a non-object", () => {
    expect(validateExperience(null).ok).toBe(false);
    expect(validateExperience("nope").ok).toBe(false);
  });

  it("rejects duplicate evidence ids", () => {
    const exp = minimalExperience();
    exp.evidence.push({ id: "fact-1", label: "Dupe", statement: "Duplicate id." });
    const result = validateExperience(exp);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((e) => e.includes("duplicate id"))).toBe(true);
  });

  it("rejects duplicate hypothesis ids", () => {
    const exp = minimalExperience();
    exp.hypotheses.push({ ...exp.hypotheses[0] });
    const result = validateExperience(exp);
    expect(result.ok).toBe(false);
  });

  it("rejects an unresolved evidence reference on a sequence step", () => {
    const exp = minimalExperience();
    exp.sequences[0].steps[0].evidenceId = "does-not-exist";
    const result = validateExperience(exp);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((e) => e.includes("unresolved evidence id"))).toBe(true);
  });

  it("rejects an unresolved evidence reference on a hypothesis", () => {
    const exp = minimalExperience();
    exp.hypotheses[0].evidence[0].evidenceId = "ghost-fact";
    const result = validateExperience(exp);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((e) => e.includes("unresolved evidence id"))).toBe(true);
  });

  it("rejects an unresolved artifact hotspot target", () => {
    const exp = minimalExperience();
    exp.artifacts[0].hotspots![0].selects = { kind: "sequence", id: "no-such-sequence" };
    const result = validateExperience(exp);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((e) => e.includes('unresolved sequence id "no-such-sequence"'))).toBe(true);
  });

  it("rejects out-of-range hotspot percentages", () => {
    const exp = minimalExperience();
    exp.artifacts[0].hotspots![0].region = { left: 90, top: 10, width: 30, height: 10 };
    const result = validateExperience(exp);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((e) => e.includes("region"))).toBe(true);
  });

  it("rejects a negative hotspot percentage", () => {
    const exp = minimalExperience();
    exp.artifacts[0].hotspots![0].region = { left: -5, top: 10, width: 20, height: 20 };
    const result = validateExperience(exp);
    expect(result.ok).toBe(false);
  });

  it("rejects an invalid hypothesis evidence verdict", () => {
    const exp = minimalExperience();
    exp.hypotheses[0].evidence[0].verdict = "definitely";
    const result = validateExperience(exp);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((e) => e.includes("verdict"))).toBe(true);
  });

  it("rejects an invalid hypothesis status", () => {
    const exp = minimalExperience();
    exp.hypotheses[0].status = "confirmed";
    const result = validateExperience(exp);
    expect(result.ok).toBe(false);
  });

  it("rejects a sequence with duplicate step order", () => {
    const exp = minimalExperience();
    exp.sequences[0].steps[1].order = 0;
    const result = validateExperience(exp);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((e) => e.includes("duplicate step order"))).toBe(true);
  });

  it("rejects a matrix referencing an unknown evidence id", () => {
    const exp = minimalExperience();
    exp.matrix = { evidenceIds: ["fact-1", "not-a-real-id"] };
    const result = validateExperience(exp);
    expect(result.ok).toBe(false);
  });

  it("rejects a missing required top-level field", () => {
    const exp = minimalExperience();
    // @ts-expect-error -- deliberately missing field for the test
    delete exp.title;
    const result = validateExperience(exp);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((e) => e.includes("experience.title"))).toBe(true);
  });
});
