// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes, useSearchParams } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Video } from "../api";
import type { AppCtx } from "../App";
import { LibraryPage } from "../LibraryPage";

function video(over: Partial<Video>): Video {
  return {
    video_id: "x",
    filename: "x.mp4",
    status: "ready",
    created_at: "2026-09-01T00:00:00Z",
    playback_url: "https://cdn.example/x/master.m3u8",
    views: 0,
    tags: [],
    ...over,
  };
}

const VIDEOS: Video[] = [
  video({
    video_id: "feat",
    title: "Strange lights over the lake",
    featured: true,
    views: 900,
    duration_seconds: "184",
    has_transcript: true,
    tags: ["lights", "lakes"],
    created_at: "2026-08-01T00:00:00Z",
  }),
  video({ video_id: "new", title: "Newer clip", views: 40, tags: ["lights"], created_at: "2026-09-20T00:00:00Z" }),
  video({ video_id: "old", title: "Older clip", views: 5, created_at: "2026-09-10T00:00:00Z" }),
  video({ video_id: "proc", title: "Still transcoding", status: "processing", playback_url: null }),
];

// Stands in for the real search results route so a hero submission can be
// observed, including the query it carried in `?q=`.
function SearchProbe() {
  const [params] = useSearchParams();
  return <div>search results for: {params.get("q")}</div>;
}

function renderHome(over: Partial<AppCtx> = {}) {
  const ctx = {
    videos: VIDEOS,
    loading: false,
    live: true,
    openUpload: vi.fn(),
    openExternal: vi.fn(),
    isAdmin: true,
    ...over,
  } as unknown as AppCtx;
  render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route element={<Outlet context={ctx} />}>
          <Route path="/" element={<LibraryPage />} />
        </Route>
        <Route path="/rabbitholes/:slug" element={<div>reader page</div>} />
        <Route path="/search" element={<SearchProbe />} />
      </Routes>
    </MemoryRouter>,
  );
  return ctx;
}

const heroSearchInput = () =>
  screen.getByRole("searchbox", { name: /search rabbithole/i });
const diveInButton = () => screen.getByRole("button", { name: /dive in/i });

afterEach(cleanup);

describe("LibraryPage — homepage", () => {
  it("renders the hero", () => {
    renderHome();

    expect(
      screen.getByRole("heading", { level: 1, name: /see what.?s\s+inside/i }),
    ).toBeTruthy();
    // The hero's call to action is a real search form.
    expect(heroSearchInput()).toBeTruthy();
    expect(diveInButton()).toBeTruthy();
  });

  it("has no explanation block and no START HERE treatment", () => {
    renderHome();

    expect(screen.queryByText(/built to be wandered/i)).toBeNull();
    expect(screen.queryByText(/^start here$/i)).toBeNull();
    expect(screen.queryByText(/where it goes from here/i)).toBeNull();
  });

  it("features the curated video and links it to its watch page", () => {
    renderHome();

    const region = screen.getByRole("region", { name: /strange lights over the lake/i });
    expect(within(region).getByText(/featured video/i)).toBeTruthy();
    const watch = within(region).getByRole("link", { name: /^watch$/i });
    expect(watch.getAttribute("href")).toBe("/watch/feat");
    expect(within(region).getByText(/captions and searchable transcript/i)).toBeTruthy();
  });

  it("lists other ready videos under Just added, newest first", () => {
    renderHome();

    const region = screen.getByRole("region", { name: /just added/i });
    const titles = within(region)
      .getAllByRole("heading", { level: 3 })
      .map((h) => h.textContent);
    expect(titles).toEqual(["Newer clip", "Older clip"]);
  });

  it("hides Most watched while Just added already shows the whole library", () => {
    renderHome();
    expect(screen.queryByRole("region", { name: /most watched/i })).toBeNull();
  });

  it("ranks Most watched by views once the library outgrows Just added", () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      video({ video_id: `m${i}`, title: `Clip ${i}`, views: i, created_at: `2026-09-${10 + i}T00:00:00Z` }),
    );
    renderHome({ videos: [...VIDEOS, ...many] });

    const region = screen.getByRole("region", { name: /most watched/i });
    const titles = within(region)
      .getAllByRole("heading", { level: 3 })
      .map((h) => h.textContent);
    expect(titles[0]).toBe("Strange lights over the lake");
    expect(titles[1]).toBe("Newer clip");
  });

  it("shows uploads still processing with their current stage", () => {
    renderHome();

    const region = screen.getByRole("region", { name: /in the pipeline/i });
    expect(within(region).getByText("Still transcoding")).toBeTruthy();
    const current = within(region).getByText("Transcoding");
    expect(current.getAttribute("aria-current")).toBe("step");
    expect(within(region).getByText(/live status/i)).toBeTruthy();
  });

  it("builds topic chips from video tags with counts", () => {
    renderHome();

    const region = screen.getByRole("region", { name: /^topics$/i });
    const chip = within(region).getByRole("link", { name: /^lights\s*2$/i });
    expect(chip.getAttribute("href")).toBe("/tunnels/lights");
  });

  it("Upload a video calls the upload handler", () => {
    const ctx = renderHome();

    fireEvent.click(screen.getByRole("button", { name: /upload a video/i }));
    expect(ctx.openUpload).toHaveBeenCalledTimes(1);
  });

  it("invites an upload when there are no videos", () => {
    renderHome({ videos: [] });

    expect(screen.getByRole("heading", { name: /no videos yet/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /upload a video/i })).toBeTruthy();
  });

  it("lets an editor add a YouTube find without uploading a file", () => {
    const ctx = renderHome({ videos: [] });
    fireEvent.click(screen.getByRole("button", { name: "Add a YouTube find" }));
    expect(ctx.openExternal).toHaveBeenCalledOnce();
  });

  it("does not present unlisted videos as featured or pending", () => {
    renderHome({ videos: [video({ title: "Hidden clip", visibility: "unlisted" })] });
    expect(screen.queryByText("Hidden clip")).toBeNull();
    expect(screen.queryByRole("region", { name: /in the pipeline/i })).toBeNull();
  });

  it("keeps other users' processing jobs out of public discovery", () => {
    renderHome({ isAdmin: false, username: null });
    expect(screen.queryByRole("region", { name: /in the pipeline/i })).toBeNull();
    expect(screen.queryByRole("button", { name: "Add a YouTube find" })).toBeNull();
  });

  it("hero search: a query + Dive in routes into /search, carrying the query", async () => {
    renderHome();

    fireEvent.change(heroSearchInput(), { target: { value: "  gone too far  " } });
    fireEvent.click(diveInButton());

    expect(await screen.findByText("search results for: gone too far")).toBeTruthy();
  });

  it("hero search: Enter in the field submits the query", async () => {
    renderHome();

    const input = heroSearchInput();
    fireEvent.change(input, { target: { value: "the qwerty keyboard" } });
    fireEvent.submit(input.closest("form")!);

    expect(
      await screen.findByText("search results for: the qwerty keyboard"),
    ).toBeTruthy();
  });

  it("hero search: an empty query does not navigate", () => {
    renderHome();

    fireEvent.change(heroSearchInput(), { target: { value: "   " } });
    fireEvent.click(diveInButton());

    expect(screen.queryByText(/^search results for:/)).toBeNull();
    // still on the homepage
    expect(
      screen.getByRole("heading", { level: 1, name: /see what.?s\s+inside/i }),
    ).toBeTruthy();
  });
});
