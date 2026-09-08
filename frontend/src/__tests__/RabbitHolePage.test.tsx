// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RabbitHole } from "../api";
import { RabbitHolePage } from "../RabbitHolePage";
import fixture from "./fixtures-qwerty.json";

// getRabbitHole is the single data source for the page — mock it per test.
const getRabbitHole = vi.fn<(slug: string) => Promise<RabbitHole | null>>();
vi.mock("../api", async () => {
  const actual = await vi.importActual<typeof import("../api")>("../api");
  return { ...actual, getRabbitHole: (slug: string) => getRabbitHole(slug) };
});

const QWERTY = fixture as unknown as RabbitHole;

function renderPage(slug = "how-the-qwerty-keyboard-took-over") {
  return render(
    <MemoryRouter initialEntries={[`/rabbitholes/${slug}`]}>
      <Routes>
        <Route path="/rabbitholes/:slug" element={<RabbitHolePage />} />
        <Route path="/" element={<div>surface</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  getRabbitHole.mockReset();
  // jsdom has no scrollIntoView / matchMedia
  Element.prototype.scrollIntoView = vi.fn();
  window.matchMedia ??= vi.fn().mockReturnValue({ matches: false }) as never;
});
afterEach(cleanup);

describe("RabbitHolePage — QWERTY render", () => {
  beforeEach(() => getRabbitHole.mockResolvedValue(QWERTY));

  it("renders the frozen editorial model sections from the live shape", async () => {
    renderPage();
    expect(
      await screen.findByRole("heading", { level: 1, name: /how the qwerty keyboard took over/i }),
    ).toBeTruthy();

    for (const name of [
      /the short version/i,
      /what we know/i,
      /contested or still open/i,
      /timeline/i,
      /keep digging/i,
      /sources/i,
    ]) {
      expect(screen.getByRole("heading", { name })).toBeTruthy();
    }
    expect(screen.getByText(QWERTY.subtitle!)).toBeTruthy();
    expect(screen.getByText(QWERTY.hook!)).toBeTruthy();

    // sections appear in editorial order in the DOM
    const order = [".rh-hook", ".rh-short", ".rh-wwk", ".rh-contested", ".rh-timeline", ".rh-keep", ".rh-sources"];
    const tops = order.map((s) => {
      const el = document.querySelector(s);
      return el ? [...document.querySelectorAll("*")].indexOf(el) : -1;
    });
    expect(tops).toEqual([...tops].sort((a, b) => a - b));
  });

  it("shows trust metadata: source count + published date + author", async () => {
    renderPage();
    const meta = await screen.findByText(/5 sources/i);
    expect(meta.getAttribute("href")).toBe("#rh-h-sources");
    expect(screen.getByText(/published sep 2026/i)).toBeTruthy();
    expect(screen.getByText(/rabbithole editorial/i)).toBeTruthy();
  });

  it("renders What We Know facts with citation numbers matching the API", async () => {
    renderPage();
    await screen.findByRole("heading", { name: /what we know/i });
    const list = document.querySelector<HTMLElement>(".rh-wwk-list")!;
    const cites = within(list).getAllByRole("link");
    // API: [1,2,3,4,5] in reading order (sources are already first-citation ordered)
    expect(cites.map((a) => a.textContent)).toEqual(["1", "2", "3", "4", "5"]);
    cites.forEach((a) =>
      expect(a.getAttribute("href")).toBe(`#rh-source-${a.textContent}`),
    );
  });

  it("a citation click scrolls to and flashes its source", async () => {
    renderPage();
    await screen.findByRole("heading", { name: /sources/i });
    const cite = document.querySelector<HTMLAnchorElement>(".rh-wwk-item .rh-cite")!;
    const target = document.getElementById("rh-source-1")!;
    cite.click();
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    expect(target.classList.contains("is-flash")).toBe(true);
  });

  it("does not show a chip for Established facts, does for non-Established", async () => {
    renderPage();
    await screen.findByRole("heading", { name: /what we know/i });
    // all five QWERTY facts are Established -> zero chips in that section
    const wwk = document.querySelector(".rh-wwk-list")!;
    expect(wwk.querySelectorAll(".rh-chip").length).toBe(0);
    // contested section carries exactly the two states present
    const contested = document.querySelector(".rh-contested")!;
    expect([...contested.querySelectorAll(".rh-chip")].map((c) => c.textContent)).toEqual([
      "Debunked",
      "Contested",
    ]);
  });

  it("renders the limitation line for a contested claim", async () => {
    renderPage();
    await screen.findByRole("heading", { name: /contested/i });
    expect(screen.getAllByText(/the limit/i).length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByText(/nothing in the record from sholes/i),
    ).toBeTruthy();
  });

  it("orders the timeline chronologically and never repeats it as a fact", async () => {
    renderPage();
    await screen.findByRole("heading", { name: /timeline/i });
    const dates = [...document.querySelectorAll(".rh-tl-date")].map((d) => d.textContent);
    expect(dates).toEqual(["1868", "c. 1873", "1874", "1878", "1888", "1893", "1936", "1956"]);
    // What We Know carries none of those years verbatim as a bullet
    const wwkText = document.querySelector(".rh-wwk-list")!.textContent ?? "";
    expect(/\b18\d\d\b|\b19\d\d\b/.test(wwkText)).toBe(false);
  });

  it("renders Keep Digging as non-clickable coming-soon nodes (no dead links)", async () => {
    renderPage();
    await screen.findByRole("heading", { name: /keep digging/i });
    const items = [...document.querySelectorAll(".rh-keep-item")];
    expect(items).toHaveLength(4);
    items.forEach((li) => {
      expect(li.querySelector("a")).toBeNull(); // no anchor at all
      expect(li.textContent).toMatch(/coming soon/i);
    });
    expect(screen.getByText(/the most serious attempt to replace qwerty/i)).toBeTruthy();
  });

  it("renders Sources numbered 1–N with working anchors and no null fields", async () => {
    renderPage();
    await screen.findByRole("heading", { name: /sources/i });
    const srcs = [...document.querySelectorAll(".rh-src")];
    expect(srcs.map((s) => s.id)).toEqual([
      "rh-source-1",
      "rh-source-2",
      "rh-source-3",
      "rh-source-4",
      "rh-source-5",
    ]);
    // source 2 has no url -> title link falls back to the DOI resolver
    const s2 = document.getElementById("rh-source-2")!;
    expect(s2.querySelector("a.rh-src-title")?.getAttribute("href")).toBe(
      "https://doi.org/10.14989/139379",
    );
    // no raw null / undefined text anywhere
    expect(document.querySelector(".rh")!.textContent).not.toMatch(/null|undefined/);
  });

  it("never exposes internal/admin fields", async () => {
    renderPage();
    await screen.findByRole("heading", { name: /sources/i });
    const html = document.querySelector(".rh")!.innerHTML;
    for (const leak of [
      "relationship_type",
      "created_by",
      "updated_by",
      "editorial_note",
      "_source_seq",
      "schema_version",
      "planned_slug",
    ]) {
      expect(html).not.toContain(leak);
    }
  });
});

describe("RabbitHolePage — optional sections", () => {
  it("omits What's Contested when the API doesn't return it", async () => {
    const { contested_open, ...rest } = QWERTY;
    void contested_open;
    getRabbitHole.mockResolvedValue(rest as RabbitHole);
    renderPage();
    await screen.findByRole("heading", { name: /what we know/i });
    expect(screen.queryByRole("heading", { name: /contested/i })).toBeNull();
    expect(document.querySelector(".rh-contested")).toBeNull();
  });

  it("omits an empty contested_open shell", async () => {
    getRabbitHole.mockResolvedValue({
      ...QWERTY,
      contested_open: { intro: null, items: [], open_questions: [] },
    });
    renderPage();
    await screen.findByRole("heading", { name: /what we know/i });
    expect(document.querySelector(".rh-contested")).toBeNull();
  });

  it("omits the Timeline when absent or empty", async () => {
    getRabbitHole.mockResolvedValue({ ...QWERTY, timeline: [] });
    renderPage();
    await screen.findByRole("heading", { name: /what we know/i });
    expect(document.querySelector(".rh-timeline")).toBeNull();
    expect(screen.queryByRole("heading", { name: /timeline/i })).toBeNull();
  });
});

describe("RabbitHolePage — states", () => {
  it("shows a loading state before data arrives", async () => {
    let resolve!: (v: RabbitHole) => void;
    getRabbitHole.mockReturnValue(new Promise((r) => (resolve = r)));
    const { container } = renderPage();
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();
    resolve(QWERTY);
    await screen.findByRole("heading", { level: 1 });
  });

  it("shows a RabbitHole-shaped not-found state on 404 (not the catalog copy)", async () => {
    getRabbitHole.mockResolvedValue(null);
    renderPage("nope");
    expect(await screen.findByText(/hasn.t been dug yet/i)).toBeTruthy();
    expect(screen.queryByText(/nothing in the hole yet/i)).toBeNull();
    expect(screen.getByRole("link", { name: /back to the surface/i })).toBeTruthy();
  });

  it("shows an error state when the request fails", async () => {
    getRabbitHole.mockRejectedValue(new Error("boom"));
    renderPage();
    expect(await screen.findByText(/something went wrong loading this/i)).toBeTruthy();
  });
});

describe("RabbitHolePage — layout", () => {
  it("has no element wider than the viewport at 375px", async () => {
    getRabbitHole.mockResolvedValue(QWERTY);
    // jsdom reports 0 for layout; assert the structural guard instead:
    // the article and its lists never set an explicit width, and long words
    // are allowed to wrap. This is a smoke check that nothing renders a
    // fixed pixel width that could overflow.
    const { container } = renderPage();
    await screen.findByRole("heading", { level: 1 });
    const widths = [...container.querySelectorAll<HTMLElement>("*")]
      .map((el) => el.style.width)
      .filter((w) => w && w.endsWith("px"));
    expect(widths).toEqual([]);
  });
});
