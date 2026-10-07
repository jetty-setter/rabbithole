// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { useTranscriptPrefill } from "../hooks/useTranscriptPrefill";
import type { Video } from "../api";

const video = (provider_id: string, overrides = {}): Video => ({
  video_id: provider_id, provider: "youtube", provider_id,
  status: "ready", visibility: "public", has_transcript: true,
  capabilities: { watch: true, moment_search: true }, ...overrides,
} as Video);
afterEach(cleanup);

it("does not prefill from unavailable or unsearchable sources", () => {
  const { result } = renderHook(() => useTranscriptPrefill([
    video("GUpeDwiD64M", { visibility: "unlisted" }),
    video("I2O7blSSzpI", { capabilities: { watch: true, moment_search: false } }),
    video("ryg077wBvsM", { capabilities: { watch: false, moment_search: true } }),
    video("SpeSpA3e56A", { status: "processing" }),
  ]));
  expect(result.current[0]).toBe("");
});

it("prefills after the catalog loads and preserves edits and clearing", () => {
  const { result, rerender } = renderHook(({ videos }) => useTranscriptPrefill(videos), { initialProps: { videos: [] as Video[] } });
  rerender({ videos: [video("GUpeDwiD64M")] });
  expect(["glowing red eyes", "Silver Bridge"]).toContain(result.current[0]);
  act(() => result.current[1]("my own mystery"));
  rerender({ videos: [video("I2O7blSSzpI")] });
  expect(result.current[0]).toBe("my own mystery");
  act(() => result.current[1](""));
  expect(result.current[0]).toBe("");
});

it("does not overwrite a query entered before the catalog arrives", () => {
  const { result, rerender } = renderHook(({ videos }) => useTranscriptPrefill(videos), { initialProps: { videos: [] as Video[] } });
  act(() => result.current[1]("my mystery"));
  rerender({ videos: [video("GUpeDwiD64M")] });
  expect(result.current[0]).toBe("my mystery");
});

it("preserves an existing search query", () => {
  const { result } = renderHook(() => useTranscriptPrefill([video("GUpeDwiD64M")], "existing query"));
  expect(result.current[0]).toBe("existing query");
});
