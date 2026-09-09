// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RabbitHole, RabbitHoleListItem } from "../api";
import { LibraryPage } from "../LibraryPage";

// Homepage data sources: the published feed, then a detail fetch per shown
// entry. Every test sets its own resolved values (no beforeEach reset —
// resetting the impl mid-run makes the effect throw and hangs vitest).
const listRabbitHoles = vi.fn<(limit?: number) => Promise<RabbitHoleListItem[]>>();
const getRabbitHole = vi.fn<(slug: string) => Promise<RabbitHole | null>>();
vi.mock("../api", async () => {
  const actual = await vi.importActual<typeof import("../api")>("../api");
  return {
    ...actual,
    listRabbitHoles: (limit?: number) => listRabbitHoles(limit),
    getRabbitHole: (slug: string) => getRabbitHole(slug),
  };
});

function listItem(slug: string): RabbitHoleListItem {
  return {
    id: slug,
    slug,
    title: `Title ${slug}`,
    subtitle: null,
    status: "published",
    published_at: "2026-09-01T00:00:00Z",
    updated_at: null,
    source_count: 3,
  };
}

function rabbitHole(slug: string, over: Partial<RabbitHole> = {}): RabbitHole {
  return {
    slug,
    title: `Title ${slug}`,
    subtitle: null,
    hook: `Hook for ${slug}. A second sentence that must not show.`,
    short_version: null,
    what_we_know: [],
    contested_open: null,
    timeline: null,
    keep_digging: [],
    sources: [],
    author_display: null,
    published_at: "2026-09-01T00:00:00Z",
    updated_at: null,
    ...over,
  };
}

function renderHome() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<LibraryPage />} />
        <Route path="/rabbitholes/:slug" element={<div>reader page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

const startHref = () =>
  screen.getByRole("link", { name: /dive in/i }).getAttribute("href");

// Clear call history between tests but keep implementations — mockReset()
// would drop the impl and make the effect throw (which hangs vitest).
beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("LibraryPage — homepage", () => {
  it("renders the hero before any API data resolves", () => {
    listRabbitHoles.mockReturnValue(new Promise(() => {}));
    getRabbitHole.mockReturnValue(new Promise(() => {}));
    renderHome();

    expect(
      screen.getByRole("heading", { level: 1, name: /follow the interesting thing/i }),
    ).toBeTruthy();
    expect(startHref()).toBe("/");
  });

  it("has no explanation block and no START HERE treatment", async () => {
    listRabbitHoles.mockResolvedValue([listItem("a"), listItem("b")]);
    getRabbitHole.mockImplementation(async (s) => rabbitHole(s));
    renderHome();
    await screen.findByRole("region", { name: /latest rabbitholes/i });

    expect(screen.queryByText(/built to be wandered/i)).toBeNull();
    expect(screen.queryByText(/^start here$/i)).toBeNull();
    expect(screen.queryByText(/where it goes from here/i)).toBeNull();
  });

  it("0 published: hero renders, no index, no detail fetches, no crash", async () => {
    listRabbitHoles.mockResolvedValue([]);
    getRabbitHole.mockResolvedValue(null);
    renderHome();

    await waitFor(() => expect(listRabbitHoles).toHaveBeenCalled());
    expect(
      screen.getByRole("heading", { level: 1, name: /follow the interesting thing/i }),
    ).toBeTruthy();
    expect(screen.queryByRole("region", { name: /latest/i })).toBeNull();
    expect(getRabbitHole).not.toHaveBeenCalled();
    expect(startHref()).toBe("/");
  });

  it("1 published: one 'Latest' entry, title + first-sentence hook + link", async () => {
    listRabbitHoles.mockResolvedValue([listItem("qwerty")]);
    getRabbitHole.mockResolvedValue(
      rabbitHole("qwerty", {
        title: "How the QWERTY Keyboard Took Over",
        hook: "The layout was fixed by a machine from 1873. This part is dropped.",
      }),
    );
    renderHome();

    const region = await screen.findByRole("region", { name: /^latest$/i });
    expect(within(region).getByRole("heading", { name: /^latest$/i })).toBeTruthy();
    expect(
      within(region).getByRole("heading", { name: /how the qwerty keyboard took over/i }),
    ).toBeTruthy();
    expect(within(region).getByText("The layout was fixed by a machine from 1873.")).toBeTruthy();
    expect(within(region).queryByText(/this part is dropped/i)).toBeNull();
    expect(within(region).getByRole("link").getAttribute("href")).toBe(
      "/rabbitholes/qwerty",
    );
    // CTA points at a real published RabbitHole, not a hard-coded slug
    await waitFor(() => expect(startHref()).toBe("/rabbitholes/qwerty"));
  });

  it("2+ published: a short 'Latest RabbitHoles' list, entries link by slug", async () => {
    listRabbitHoles.mockResolvedValue([listItem("a"), listItem("b"), listItem("c")]);
    getRabbitHole.mockImplementation(async (s) => rabbitHole(s));
    renderHome();

    const region = await screen.findByRole("region", { name: /latest rabbitholes/i });
    const links = within(region).getAllByRole("link");
    expect(links.map((l) => l.getAttribute("href"))).toEqual([
      "/rabbitholes/a",
      "/rabbitholes/b",
      "/rabbitholes/c",
    ]);
    expect(within(region).getByText("Hook for a.")).toBeTruthy();
  });

  it("caps the index at five entries", async () => {
    const many = ["a", "b", "c", "d", "e", "f", "g"].map(listItem);
    listRabbitHoles.mockResolvedValue(many);
    getRabbitHole.mockImplementation(async (s) => rabbitHole(s));
    renderHome();

    const region = await screen.findByRole("region", { name: /latest rabbitholes/i });
    await waitFor(() =>
      expect(within(region).getAllByRole("link")).toHaveLength(5),
    );
    expect(getRabbitHole).toHaveBeenCalledTimes(5);
  });

  it("falls back to short_version when hook is missing", async () => {
    listRabbitHoles.mockResolvedValue([listItem("x")]);
    getRabbitHole.mockResolvedValue(
      rabbitHole("x", {
        hook: null,
        short_version: "A short-version lead sentence. And more text after it.",
      }),
    );
    renderHome();

    const region = await screen.findByRole("region", { name: /^latest$/i });
    expect(within(region).getByText("A short-version lead sentence.")).toBeTruthy();
  });

  it("API failure: hero still renders, no index, no crash", async () => {
    listRabbitHoles.mockRejectedValue(new Error("down"));
    getRabbitHole.mockResolvedValue(null);
    renderHome();

    await waitFor(() => expect(listRabbitHoles).toHaveBeenCalled());
    expect(
      screen.getByRole("heading", { level: 1, name: /follow the interesting thing/i }),
    ).toBeTruthy();
    expect(screen.queryByRole("region", { name: /latest/i })).toBeNull();
    expect(startHref()).toBe("/");
  });

  it("a failed detail fetch drops that entry without breaking the rest", async () => {
    listRabbitHoles.mockResolvedValue([listItem("ok"), listItem("bad")]);
    getRabbitHole.mockImplementation(async (slug) => {
      if (slug === "bad") throw new Error("500");
      return rabbitHole(slug);
    });
    renderHome();

    const region = await screen.findByRole("region", { name: /^latest$/i });
    const links = within(region).getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute("href")).toBe("/rabbitholes/ok");
  });
});
