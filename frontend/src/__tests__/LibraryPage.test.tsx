// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RabbitHole, RabbitHoleListItem } from "../api";
import { LibraryPage } from "../LibraryPage";
import fixture from "./fixtures-qwerty.json";

// The homepage's only data sources — the published feed and the full detail
// fetch for whatever it puts first. No video catalog is involved any more.
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

const QWERTY = fixture as unknown as RabbitHole;
const LIST_ITEM: RabbitHoleListItem = {
  id: "1",
  slug: QWERTY.slug,
  title: QWERTY.title,
  subtitle: QWERTY.subtitle,
  status: "published",
  published_at: QWERTY.published_at,
  updated_at: QWERTY.published_at,
  source_count: QWERTY.sources.length,
};

function renderHome() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<LibraryPage />} />
        <Route path="/rabbitholes/:slug" element={<div>rabbithole detail</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  listRabbitHoles.mockReset();
  getRabbitHole.mockReset();
});
afterEach(cleanup);

describe("LibraryPage — homepage", () => {
  it("renders the hero without waiting on any network data", () => {
    listRabbitHoles.mockReturnValue(new Promise(() => {})); // never resolves
    getRabbitHole.mockReturnValue(new Promise(() => {}));
    renderHome();

    expect(
      screen.getByRole("heading", { level: 1, name: /follow the interesting thing/i }),
    ).toBeTruthy();
    // CTA is present immediately, pointing at the fallback RabbitHole.
    const cta = screen.getByRole("link", { name: /start somewhere/i });
    expect(cta.getAttribute("href")).toBe("/rabbitholes/how-the-qwerty-keyboard-took-over");
  });

  it("promotes the newest published RabbitHole as the entry point once loaded", async () => {
    listRabbitHoles.mockResolvedValue([LIST_ITEM]);
    getRabbitHole.mockResolvedValue(QWERTY);
    renderHome();

    // the featured section is labelled by its RabbitHole title
    const featured = await screen.findByRole("region", { name: QWERTY.title });
    expect(within(featured).getByText(/start here/i)).toBeTruthy();
    expect(
      within(featured).getByRole("heading", { level: 2, name: QWERTY.title }),
    ).toBeTruthy();
    // the connections out of it come along, as non-links while they are coming soon
    expect(within(featured).getByText(/where it goes from here/i)).toBeTruthy();
    expect(within(featured).getByText("The Dvorak Keyboard")).toBeTruthy();
    expect(within(featured).getAllByText(/coming soon/i).length).toBe(4);

    // the hero CTA now points at the featured piece
    expect(
      screen.getByRole("link", { name: /start somewhere/i }).getAttribute("href"),
    ).toBe(`/rabbitholes/${QWERTY.slug}`);
  });

  it("still renders hero + explainer when nothing is published", async () => {
    listRabbitHoles.mockResolvedValue([]);
    getRabbitHole.mockResolvedValue(null);
    renderHome();

    expect(
      screen.getByRole("heading", { level: 1, name: /follow the interesting thing/i }),
    ).toBeTruthy();
    // let the (empty) feed promise settle
    await screen.findByText(/every rabbithole is short, and every claim is sourced/i);
    // no featured section rendered
    expect(screen.queryByText(/where it goes from here/i)).toBeNull();
    // getRabbitHole is never called when the feed is empty
    expect(getRabbitHole).not.toHaveBeenCalled();
  });
});
