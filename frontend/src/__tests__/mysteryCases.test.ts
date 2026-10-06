import { describe, expect, it } from "vitest";
import picks from "../../../scripts/curiosity-starter.json";
import { buildMysteryCases, caseSources } from "../mysteryCases";
import type { Video } from "../api";

const videos: Video[] = picks.map(p => ({ video_id: p.provider_id, provider_id: p.provider_id, provider: "youtube", filename: p.provider_id, status: "ready", visibility: "public", created_at: "2026-10-05", playback_url: "/test.m3u8" }));
describe("mystery cases", () => {
  it("maps every curated video to a stable case with available destinations", () => {
    const cases = buildMysteryCases(videos);
    expect(cases).toHaveLength(picks.length);
    expect(new Set(Object.values(caseSources).flat()).size).toBe(picks.length);
    for (const c of cases) {
      expect(c.connections.length).toBeGreaterThanOrEqual(2);
      for (const edge of c.connections) {
        expect(cases.some(target => target.id === edge.target)).toBe(true);
        expect(edge.target).not.toBe(c.id);
      }
    }
  });
  it("removes hidden cases and their inbound connections", () => {
    const cases = buildMysteryCases(videos.map(v => v.provider_id === "GUpeDwiD64M" ? { ...v, visibility: "unlisted" } : v));
    expect(cases.some(c => c.id === "mothman")).toBe(false);
    expect(cases.some(c => c.connections.some(e => e.target === "mothman"))).toBe(false);
    expect(buildMysteryCases(videos.map(v => ({ ...v, status: "processing" })))).toEqual([]);
  });
  it("groups multiple videos into one case without duplicate or self connections", () => {
    const original = caseSources.mothman;
    caseSources.mothman = [...original, "1C7zocpEqT8"];
    try {
      const c = buildMysteryCases(videos).find(c => c.id === "mothman")!;
      expect(c.videos).toHaveLength(2);
      expect(new Set(c.connections.map(e => e.target)).size).toBe(c.connections.length);
      expect(c.connections.some(e => e.target === c.id)).toBe(false);
    } finally { caseSources.mothman = original; }
  });
});
