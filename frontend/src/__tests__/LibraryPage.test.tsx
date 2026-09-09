// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { RabbitHoleListItem } from "../api";
import { LibraryPage } from "../LibraryPage";

const FALLBACK_SLUG = "how-the-qwerty-keyboard-took-over";

// The homepage's only data source: the published-RabbitHole feed. Each test
// sets its own resolved value.
const listRabbitHoles = vi.fn<(limit?: number) => Promise<RabbitHoleListItem[]>>();
vi.mock("../api", async () => {
  const actual = await vi.importActual<typeof import("../api")>("../api");
  return { ...actual, listRabbitHoles: (limit?: number) => listRabbitHoles(limit) };
});

function item(slug: string): RabbitHoleListItem {
  return {
    id: slug,
    slug,
    title: `Title for ${slug}`,
    subtitle: `A short line about ${slug}.`,
    status: "published",
    published_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    source_count: 5,
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
  screen.getByRole("link", { name: /start somewhere/i }).getAttribute("href");

afterEach(cleanup);

describe("LibraryPage — homepage IA", () => {
  it("renders the hero before the feed resolves, with a valid CTA destination", () => {
    listRabbitHoles.mockReturnValue(new Promise(() => {})); // never resolves
    renderHome();

    expect(
      screen.getByRole("heading", { level: 1, name: /follow the interesting thing/i }),
    ).toBeTruthy();
    expect(startHref()).toBe(`/rabbitholes/${FALLBACK_SLUG}`);
    expect(screen.getByText(/built to be wandered/i)).toBeTruthy();
  });

  it("has no START HERE / featured-article treatment", async () => {
    listRabbitHoles.mockResolvedValue([item("a"), item("b")]);
    renderHome();
    await screen.findByRole("heading", { name: /worth a look/i });

    expect(screen.queryByText(/^start here$/i)).toBeNull();
    expect(screen.queryByText(/where it goes from here/i)).toBeNull();
    expect(screen.queryByText(/coming soon/i)).toBeNull();
  });

  it("points Start somewhere at one of the published RabbitHoles", async () => {
    listRabbitHoles.mockResolvedValue([item("alpha"), item("beta"), item("gamma")]);
    renderHome();

    await waitFor(() =>
      expect(["/rabbitholes/alpha", "/rabbitholes/beta", "/rabbitholes/gamma"]).toContain(
        startHref(),
      ),
    );
  });

  it("with a single published RabbitHole: no discovery list, CTA still valid", async () => {
    listRabbitHoles.mockResolvedValue([item("only-one")]);
    renderHome();

    await waitFor(() => expect(startHref()).toBe("/rabbitholes/only-one"));
    expect(screen.queryByRole("heading", { name: /worth a look/i })).toBeNull();
    expect(screen.getByText(/built to be wandered/i)).toBeTruthy();
  });

  it("with two or more: renders the discovery list as links, capped at five", async () => {
    const items = ["a", "b", "c", "d", "e", "f", "g"].map((s) => item(s));
    listRabbitHoles.mockResolvedValue(items);
    renderHome();

    const section = await screen.findByRole("region", { name: /worth a look/i });
    const links = within(section).getAllByRole("link");
    expect(links).toHaveLength(5);
    expect(links[0].getAttribute("href")).toBe("/rabbitholes/a");
    expect(within(section).getByText("Title for a")).toBeTruthy();
    expect(within(section).getByText(/a short line about a\./i)).toBeTruthy();
  });

  it("survives a feed failure: hero + explanation render, no discovery, no crash", async () => {
    // listRabbitHoles resolves to [] on any error by contract.
    listRabbitHoles.mockResolvedValue([]);
    renderHome();

    await waitFor(() => expect(listRabbitHoles).toHaveBeenCalled());
    expect(
      screen.getByRole("heading", { level: 1, name: /follow the interesting thing/i }),
    ).toBeTruthy();
    expect(screen.getByText(/built to be wandered/i)).toBeTruthy();
    expect(screen.queryByRole("heading", { name: /worth a look/i })).toBeNull();
    expect(startHref()).toBe(`/rabbitholes/${FALLBACK_SLUG}`);
  });
});
