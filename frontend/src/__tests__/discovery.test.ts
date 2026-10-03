import { describe, expect, it } from "vitest";
import { publicVideos, relatedVideos, searchVideos } from "../discovery";
import type { Video } from "../api";

const video = (over: Partial<Video>): Video => ({ video_id: "a", filename: "a", status: "ready", created_at: "2026-10-01", playback_url: "/video.m3u8", ...over });
describe("Curated video discovery", () => {
  it("searches a YouTube embed without a transcript", () => {
    const embedded = video({ video_id: "external", playback_url: null, title: "The phantom jelly", description: "A deep sea sighting", owner: "MBARI", capabilities: { watch: true } as Video["capabilities"] });
    expect(searchVideos([embedded], "deep MBARI")).toEqual([embedded]);
  });
  it("excludes unlisted and processing videos even when playable", () => {
    expect(publicVideos([video({ visibility: "unlisted" }), video({ status: "processing" })])).toEqual([]);
  });
  it("ranks real shared tags first and excludes the current video", () => {
    const current = video({ tags: ["space", "sound"] });
    const unrelated = video({ video_id: "b", tags: ["history"], created_at: "2026-10-02" });
    const related = video({ video_id: "c", tags: ["space"], created_at: "2026-09-01" });
    expect(relatedVideos(current, [current, unrelated, related]).map((v) => v.video_id)).toEqual(["c", "b"]);
  });
});
