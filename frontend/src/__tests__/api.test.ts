import { afterEach, describe, expect, it, vi } from "vitest";
import { displayTitle, fetchCues, formatDuration, relativeTime } from "../api";

describe("displayTitle", () => {
  it("uses the title when present", () => {
    expect(displayTitle({ title: "  Real Title ", filename: "x.mp4" })).toBe("Real Title");
  });

  it("prettifies the filename when there's no title", () => {
    expect(displayTitle({ title: null, filename: "my_cool-clip.mp4" })).toBe("my cool clip");
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
