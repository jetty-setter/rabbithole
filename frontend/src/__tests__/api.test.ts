import { afterEach, describe, expect, it, vi } from "vitest";
import { displayTitle, fetchCues, formatDuration, normalizeTag, pickFeatured, relativeTime, transcriptSectionState, type Video } from "../api";

describe("transcriptSectionState", () => {
  it("shows transcribing while a job is in flight", () => {
    expect(transcriptSectionState({ transcript_status: "transcribing" })).toBe("transcribing");
  });

  it("shows ready once cues exist", () => {
    expect(transcriptSectionState({ transcript_status: "ready" })).toBe("ready");
  });

  it("shows no_speech distinctly from a failure", () => {
    expect(transcriptSectionState({ transcript_status: "no_speech" })).toBe("no_speech");
  });

  it("collapses failed into unavailable (no raw error shown to the user)", () => {
    expect(transcriptSectionState({ transcript_status: "failed" })).toBe("unavailable");
  });

  it("collapses pending into unavailable", () => {
    expect(transcriptSectionState({ transcript_status: "pending" })).toBe("unavailable");
  });

  it("treats a legacy record with no transcript_status as unavailable, not hidden", () => {
    expect(transcriptSectionState({})).toBe("unavailable");
  });
});

describe("displayTitle", () => {
  it("uses the title when present", () => {
    expect(displayTitle({ title: "  Real Title ", filename: "x.mp4" })).toBe("Real Title");
  });

  it("prettifies the filename when there's no title", () => {
    expect(displayTitle({ title: null, filename: "my_cool-clip.mp4" })).toBe("my cool clip");
  });
});

describe("pickFeatured", () => {
  const ready = (over: Partial<Video>): Video => ({
    video_id: "x",
    filename: "x.mp4",
    status: "ready",
    created_at: "2026-01-01T00:00:00Z",
    playback_url: "https://cdn/x.m3u8",
    visibility: "public",
    ...over,
  });

  it("returns null for an empty list", () => {
    expect(pickFeatured([])).toBeNull();
  });

  it("falls back to the first ready video when none is curated", () => {
    const list = [ready({ video_id: "a" }), ready({ video_id: "b" })];
    expect(pickFeatured(list)?.video_id).toBe("a");
  });

  it("an explicitly featured video wins over the first ready video", () => {
    const list = [ready({ video_id: "a" }), ready({ video_id: "b", featured: true })];
    expect(pickFeatured(list)?.video_id).toBe("b");
  });

  it("ignores a featured video that is unlisted and uses the fallback", () => {
    const list = [
      ready({ video_id: "a" }),
      ready({ video_id: "b", featured: true, visibility: "unlisted" }),
    ];
    expect(pickFeatured(list)?.video_id).toBe("a");
  });

  it("ignores a featured video that is not ready / not playable", () => {
    const list = [
      ready({ video_id: "a" }),
      ready({ video_id: "b", featured: true, playback_url: null }),
      ready({ video_id: "c", featured: true, status: "processing" }),
    ];
    expect(pickFeatured(list)?.video_id).toBe("a");
  });

  it("treats a legacy video with no featured field as not featured", () => {
    const list = [ready({ video_id: "a" }), ready({ video_id: "b" })];
    delete list[0].featured;
    delete list[1].featured;
    expect(pickFeatured(list)?.video_id).toBe("a");
  });
});

describe("normalizeTag", () => {
  it("lowercases, trims, and drops a leading #", () => {
    expect(normalizeTag("  #Space ")).toBe("space");
  });

  it("renders internal whitespace/underscore runs as a single hyphen", () => {
    expect(normalizeTag("true   crime")).toBe("true-crime");
    expect(normalizeTag("cold_case")).toBe("cold-case");
    expect(normalizeTag("True-Crime")).toBe("true-crime");
  });

  it("does not merge genuinely different spellings", () => {
    expect(normalizeTag("truecrime")).toBe("truecrime");
    expect(normalizeTag("space")).not.toBe(normalizeTag("spaceflight"));
  });

  it("trims stray hyphens and caps length at 30", () => {
    expect(normalizeTag("-weird-")).toBe("weird");
    expect(normalizeTag("a".repeat(50))).toBe("a".repeat(30));
    expect(normalizeTag("#")).toBe("");
  });
});

describe("formatDuration", () => {
  it("formats seconds as m:ss", () => {
    expect(formatDuration("90")).toBe("1:30");
    expect(formatDuration("5")).toBe("0:05");
  });

  it("returns empty for missing/invalid input", () => {
    expect(formatDuration(null)).toBe("");
    expect(formatDuration("")).toBe("");
    expect(formatDuration("abc")).toBe("");
  });
});

describe("relativeTime", () => {
  it("renders hours ago", () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 3600_000).toISOString();
    expect(relativeTime(twoHoursAgo)).toBe("2 hours ago");
  });

  it("singularizes correctly", () => {
    const oneDayAgo = new Date(Date.now() - 86_400_000 - 1000).toISOString();
    expect(relativeTime(oneDayAgo)).toBe("1 day ago");
  });

  it("falls back to just now / empty", () => {
    expect(relativeTime(new Date().toISOString())).toBe("just now");
    expect(relativeTime(null)).toBe("");
    expect(relativeTime("not-a-date")).toBe("");
  });
});

describe("fetchCues", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns the cue array on success", async () => {
    const cues = [{ start: 0, end: 1, text: "hi" }];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => cues }));
    expect(await fetchCues("/x")).toEqual(cues);
  });

  it("returns [] on a non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));
    expect(await fetchCues("/x")).toEqual([]);
  });

  it("returns [] when fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    expect(await fetchCues("/x")).toEqual([]);
  });

  it("returns [] when the payload isn't an array", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
    expect(await fetchCues("/x")).toEqual([]);
  });
});
