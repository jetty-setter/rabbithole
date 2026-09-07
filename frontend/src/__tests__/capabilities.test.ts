import { describe, expect, it } from "vitest";
import {
  canAsk,
  canEmbed,
  canPlayInternal,
  canSeekExactMoment,
  canTranscriptSearch,
  canTumble,
  canWatch,
  hasTranscript,
  isFeaturable,
  type Capabilities,
  type Video,
} from "../api";

const caps = (over: Partial<Capabilities>): Capabilities => ({
  play_internal: false,
  embed_external: false,
  open_external: false,
  watch: false,
  transcript: false,
  moment_search: false,
  ask_video: false,
  seek: false,
  tunnels: false,
  map: false,
  tumble: false,
  ...over,
});

const vid = (over: Partial<Video>): Video => ({
  video_id: "x",
  filename: "x",
  status: "ready",
  created_at: "2026-01-01T00:00:00Z",
  visibility: "public",
  ...over,
});

describe("capability helpers — hosted content", () => {
  const hosted = vid({
    source_type: "hosted",
    playback_url: "https://cdn/x.m3u8",
    has_transcript: true,
    capabilities: caps({
      play_internal: true, watch: true, transcript: true, moment_search: true,
      ask_video: true, seek: true, tumble: true,
    }),
  });

  it("plays internally, is watchable, tumbable, seekable", () => {
    expect(canPlayInternal(hosted)).toBe(true);
    expect(canWatch(hosted)).toBe(true);
    expect(canTumble(hosted)).toBe(true);
    expect(canSeekExactMoment(hosted)).toBe(true);
    expect(canEmbed(hosted)).toBe(false);
  });

  it("has transcript + ask + transcript search", () => {
    expect(hasTranscript(hosted)).toBe(true);
    expect(canAsk(hosted)).toBe(true);
    expect(canTranscriptSearch(hosted)).toBe(true);
  });
});

describe("capability helpers — legacy response with no capabilities field", () => {
  it("falls back to status+playback_url so nothing regresses", () => {
    const legacy = vid({ playback_url: "https://cdn/x.m3u8" });
    expect(canWatch(legacy)).toBe(true);
    expect(canPlayInternal(legacy)).toBe(true);
    expect(canTumble(legacy)).toBe(true);
    const notReady = vid({ status: "processing", playback_url: null });
    expect(canWatch(notReady)).toBe(false);
  });
});

describe("capability helpers — external YouTube without transcript", () => {
  const yt = vid({
    source_type: "external",
    provider: "youtube",
    embed_url: "https://www.youtube-nocookie.com/embed/abc?enablejsapi=1",
    source_url: "https://www.youtube.com/watch?v=abc",
    playback_url: null,
    capabilities: caps({ embed_external: true, watch: true, tunnels: true, map: true, tumble: true }),
  });

  it("embeds + watchable + tumbable, but no internal player", () => {
    expect(canEmbed(yt)).toBe(true);
    expect(canWatch(yt)).toBe(true);
    expect(canTumble(yt)).toBe(true);
    expect(canPlayInternal(yt)).toBe(false);
  });

  it("no transcript-derived capabilities", () => {
    expect(hasTranscript(yt)).toBe(false);
    expect(canAsk(yt)).toBe(false);
    expect(canTranscriptSearch(yt)).toBe(false);
    expect(canSeekExactMoment(yt)).toBe(false);
  });

  it("is eligible for the Featured slot", () => {
    expect(isFeaturable(yt)).toBe(true);
  });
});

describe("capability helpers — external with transcript", () => {
  it("gains transcript search / ask / seek from the capability set", () => {
    const ext = vid({
      source_type: "external",
      provider: "youtube",
      embed_url: "https://www.youtube-nocookie.com/embed/abc?enablejsapi=1",
      has_transcript: true,
      transcript_source: "imported",
      capabilities: caps({
        embed_external: true, watch: true, transcript: true, moment_search: true,
        ask_video: true, seek: true, tumble: true, tunnels: true, map: true,
      }),
    });
    expect(canAsk(ext)).toBe(true);
    expect(canTranscriptSearch(ext)).toBe(true);
    expect(canSeekExactMoment(ext)).toBe(true);
  });

  it("text-only imported transcript is searchable but not seekable", () => {
    const ext = vid({
      source_type: "external",
      capabilities: caps({
        embed_external: true, watch: true, transcript: true, moment_search: true,
        ask_video: true, seek: false,
      }),
    });
    expect(canTranscriptSearch(ext)).toBe(true);
    expect(canSeekExactMoment(ext)).toBe(false);
  });
});

describe("capability helpers — external generic link", () => {
  const gen = vid({
    source_type: "external",
    provider: "generic",
    source_url: "https://archive.org/details/x",
    playback_url: null,
    capabilities: caps({ open_external: true, watch: true, tumble: true, tunnels: true, map: true }),
  });

  it("is watchable via outbound link and tumbable, no player", () => {
    expect(canWatch(gen)).toBe(true);
    expect(canTumble(gen)).toBe(true);
    expect(canPlayInternal(gen)).toBe(false);
    expect(canEmbed(gen)).toBe(false);
  });
});
