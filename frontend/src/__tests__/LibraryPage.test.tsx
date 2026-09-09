// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RabbitHole } from "../api";
import { LibraryPage } from "../LibraryPage";
import fixture from "./fixtures-qwerty.json";

const PINNED_SLUG = "how-the-qwerty-keyboard-took-over";

// The homepage's only data source: the full detail fetch for the pinned
// featured RabbitHole. No feed ordering, no video catalog.
const getRabbitHole = vi.fn<(slug: string) => Promise<RabbitHole | null>>();
vi.mock("../api", async () => {
  const actual = await vi.importActual<typeof import("../api")>("../api");
  return { ...actual, getRabbitHole: (slug: string) => getRabbitHole(slug) };
});

const QWERTY = fixture as unknown as RabbitHole;

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
  getRabbitHole.mockReset();
});
afterEach(cleanup);

describe("LibraryPage — homepage", () => {
  it("renders the hero without waiting on any network data", () => {
    getRabbitHole.mockReturnValue(new Promise(() => {})); // never resolves
    renderHome();

    expect(
      screen.getByRole("heading", { level: 1, name: /follow the interesting thing/i }),
    ).toBeTruthy();
    // CTA is present immediately, pointing at the pinned RabbitHole.
    const cta = screen.getByRole("link", { name: /start somewhere/i });
    expect(cta.getAttribute("href")).toBe(`/rabbitholes/${PINNED_SLUG}`);
  });

  it("features the pinned RabbitHole — fetched by slug, not by feed ordering", async () => {
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

    // it asked for exactly the pinned slug
    expect(getRabbitHole).toHaveBeenCalledWith(PINNED_SLUG);
  });

  it("keeps the hero + explainer and does not crash when the pinned fetch fails", async () => {
    getRabbitHole.mockRejectedValue(new Error("offline"));
    renderHome();

    expect(
      screen.getByRole("heading", { level: 1, name: /follow the interesting thing/i }),
    ).toBeTruthy();
    // the explainer still renders once the (failed) promise settles
    await screen.findByText(/every rabbithole is short, and every claim is sourced/i);
    // no featured section
    expect(screen.queryByText(/where it goes from here/i)).toBeNull();
    // CTA still points at the pinned slug
    expect(
      screen.getByRole("link", { name: /start somewhere/i }).getAttribute("href"),
    ).toBe(`/rabbitholes/${PINNED_SLUG}`);
  });
});
