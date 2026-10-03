import { describe, expect, it } from "vitest";
import picks from "../../../scripts/curiosity-starter.json";
import { branchesInTrail } from "../curatedTrail";
import type { Video } from "../api";

const videos: Video[] = picks.map((pick) => ({
  video_id: pick.provider_id, provider_id: pick.provider_id, provider: "youtube",
  filename: pick.provider_id, status: "ready", created_at: "2026-10-03",
  visibility: "public", playback_url: "/test.m3u8",
}));

describe("curated branches", () => {
  it("gives every entry multiple valid exits and incoming connections", () => {
    const incoming = new Set<string>();
    for (const video of videos) {
      const branches = branchesInTrail(video, videos);
      expect(branches.length).toBeGreaterThanOrEqual(2);
      expect(new Set(branches.map((b) => b.video.video_id)).size).toBe(branches.length);
      for (const branch of branches) {
        expect(branch.video.video_id).not.toBe(video.video_id);
        expect(branch.connection.length).toBeGreaterThan(20);
        incoming.add(branch.video.video_id);
      }
    }
    expect(incoming.size).toBe(videos.length);
  });
  it("never exposes unlisted, processing, missing or non-YouTube destinations", () => {
    const current = videos[0];
    const hidden = videos.map((v) => ({ ...v, visibility: "unlisted" as const }));
    expect(branchesInTrail(current, hidden)).toEqual([]);
    expect(branchesInTrail(current, videos.map((v) => ({ ...v, status: "processing" })))).toEqual([]);
    expect(branchesInTrail(current, [])).toEqual([]);
    expect(branchesInTrail({ ...current, provider: null }, videos)).toEqual([]);
  });
});
