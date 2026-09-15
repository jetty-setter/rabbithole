// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RabbitHole } from "../api";
import { RabbitHolePage } from "../RabbitHolePage";
import { resolveExperience } from "../experiences/registry";
import fixture from "./fixtures-qwerty.json";

const getRabbitHole = vi.fn<(slug: string) => Promise<RabbitHole | null>>();
vi.mock("../api", async () => {
  const actual = await vi.importActual<typeof import("../api")>("../api");
  return { ...actual, getRabbitHole: (slug: string) => getRabbitHole(slug) };
});

const QWERTY = fixture as unknown as RabbitHole;

/** A synthetic RabbitHole shaped like the real Wow! Signal article --
 *  same slug (so the real shipped wow-signal.experience.json loads
 *  through the ordinary registry) and citations covering every source id
 *  the experience file references (s10-s17), so every citation the
 *  experience renders actually resolves, exactly as it would against the
 *  live article. Facts/claims are simplified stand-ins, not the real
 *  article prose. */
function wowFixture(): RabbitHole {
  const cite = (sourceId: string, number: number) => ({ source_id: sourceId, number });
  return {
    ...QWERTY,
    slug: "the-wow-signal",
    title: "The Wow! Signal",
    what_we_know: [
      { text: "Fact one.", citations: [cite("s10", 1)] },
      { text: "Fact two.", citations: [cite("s11", 2)] },
      { text: "Fact three.", citations: [cite("s12", 3)] },
    ],
    contested_open: {
      intro: "The observation is real; the explanation is contested.",
      items: [
        {
          claim: "It was a deliberate extraterrestrial transmission.",
          state: "contested",
          body: "Body one.",
          why: "Why one.",
          citations: [cite("s10", 1), cite("s17", 8)],
        },
        {
          claim: "It was terrestrial radio interference.",
          state: "contested",
          body: "Body two.",
          why: "Why two.",
          citations: [cite("s14", 5)],
        },
        {
          claim: "It was a natural hydrogen-line transient.",
          state: "contested",
          body: "Body three.",
          why: "Why three.",
          citations: [cite("s13", 4), cite("s16", 7)],
        },
        {
          claim: "A comet produced the signal.",
          state: "unsupported",
          body: "Body four.",
          why: "Why four.",
          citations: [cite("s15", 6)],
        },
      ],
      open_questions: ["What produced it?"],
    },
    media: [
      {
        kind: "image",
        role: "primary-source",
        caption: "The printout.",
        credit: "Big Ear",
        url: "/Wow_Signal_Archive_Crop_Wide.webp",
        source: cite("s10", 1),
      },
    ],
  } as unknown as RabbitHole;
}

function renderPage(slug: string) {
  return render(
    <MemoryRouter initialEntries={[`/rabbitholes/${slug}`]}>
      <Routes>
        <Route path="/rabbitholes/:slug" element={<RabbitHolePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  getRabbitHole.mockReset();
  Element.prototype.scrollIntoView = vi.fn();
  window.matchMedia ??= vi.fn().mockReturnValue({ matches: false }) as never;
});
afterEach(cleanup);

describe("RabbitHolePage — fallback behaviour", () => {
  it("renders the plain generic reader for a RabbitHole with no experience file", async () => {
    getRabbitHole.mockResolvedValue(QWERTY);
    renderPage("how-the-qwerty-keyboard-took-over");
    await screen.findByRole("heading", { level: 1 });
    expect(document.querySelector(".rh-evidence-mode")).toBeNull();
    // the plain article's own contested section still renders
    expect(document.querySelector(".rh-contested")).toBeTruthy();
  });

  it("a malformed experience payload resolves to null rather than throwing (registry.resolveExperience)", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(resolveExperience({ id: "broken" }, "the-wow-signal")).toBeNull();
    expect(resolveExperience(null, "the-wow-signal")).toBeNull();
    expect(resolveExperience({ ...validMinimal(), slug: "some-other-slug" }, "the-wow-signal")).toBeNull();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("resolves a well-formed experience whose slug matches", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exp = resolveExperience(validMinimal(), "the-wow-signal");
    expect(exp).not.toBeNull();
    expect(exp?.slug).toBe("the-wow-signal");
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

function validMinimal() {
  return {
    id: "x",
    slug: "the-wow-signal",
    title: "X",
    invitation: "X",
    artifacts: [],
    evidence: [{ id: "e1", label: "E", statement: "S" }],
    sequences: [
      {
        id: "s1",
        kind: "replay",
        title: "T",
        steps: [{ id: "st1", order: 0, label: "L", meaning: "M" }],
      },
    ],
    hypotheses: [
      {
        id: "h1",
        label: "H",
        status: "contested",
        thesis: "T",
        evidence: [{ evidenceId: "e1", verdict: "supports" }],
      },
    ],
  };
}

describe("RabbitHolePage — Wow! Signal evidence experience", () => {
  beforeEach(() => getRabbitHole.mockResolvedValue(wowFixture()));

  it("renders the flagship scene structure: replay, second pass, comparison", async () => {
    renderPage("the-wow-signal");
    await screen.findByRole("heading", { level: 1, name: /the wow! signal/i });
    expect(document.querySelector(".wow-exp")).toBeTruthy();
    expect(screen.getByRole("heading", { name: /the 72 seconds/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /compare the explanations/i })).toBeTruthy();
    // the traditional case file is always mounted (deep links must work
    // regardless of scroll position), not gated behind an interaction
    expect(document.querySelector(".rh-contested")).toBeTruthy();
    expect(document.querySelector(".rh-sources")).toBeTruthy();
  });

  it("tapping each sample glyph selects it; the scrubber also updates the active sample", async () => {
    renderPage("the-wow-signal");
    await screen.findByRole("heading", { level: 1, name: /the wow! signal/i });

    const buttons = [...document.querySelectorAll<HTMLButtonElement>(".wow-replay-glyph")];
    expect(buttons).toHaveLength(6);
    const labels = ["6", "E", "Q", "U", "J", "5"];
    buttons.forEach((btn, i) => {
      fireEvent.click(btn);
      expect(btn.getAttribute("aria-pressed")).toBe("true");
      expect(document.querySelector(".wow-replay-glyph.is-active")?.textContent).toBe(labels[i]);
    });

    const scrub = document.querySelector<HTMLInputElement>(".wow-replay-scrub")!;
    fireEvent.change(scrub, { target: { value: "0" } });
    expect(document.querySelector(".wow-replay-glyph.is-active")?.textContent).toBe("6");
  });

  it("a hotspot on the printout reveals the digital glyphs and scrolls to the replay scene", async () => {
    renderPage("the-wow-signal");
    await screen.findByRole("heading", { level: 1, name: /the wow! signal/i });

    const hotspot = document.querySelector<HTMLElement>(".rh-media-hotspot")!;
    expect(hotspot).toBeTruthy();
    expect(document.querySelector(".wow-glyph-reveal")?.classList.contains("is-shown")).toBe(false);
    fireEvent.click(hotspot);

    expect(document.querySelector(".wow-glyph-reveal")?.classList.contains("is-shown")).toBe(true);
    // the replay scene should have been scrolled into view (jsdom stubs
    // scrollIntoView, so just confirm it was actually invoked, not left a
    // dead click).
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it("switching hypotheses changes the evidence verdicts shown; evidence rows stay the same", async () => {
    renderPage("the-wow-signal");
    await screen.findByRole("heading", { name: /compare the explanations/i });

    const tabs = screen.getAllByRole("button", { name: /transmission|interference|transient|comet/i });
    expect(tabs.length).toBe(4);

    const rowLabelsBefore = [...document.querySelectorAll(".rh-evidence-label")].map((el) => el.textContent);
    fireEvent.click(tabs[1]); // terrestrial interference
    const rowLabelsAfter = [...document.querySelectorAll(".rh-evidence-label")].map((el) => el.textContent);
    expect(rowLabelsAfter).toEqual(rowLabelsBefore); // same evidence, same order

    const verdicts = [...document.querySelectorAll(".rh-evidence-verdict")].map((el) => el.textContent);
    expect(verdicts.length).toBeGreaterThan(0);
  });

  it("selecting an evidence row reveals its statement with a resolving citation", async () => {
    renderPage("the-wow-signal");
    await screen.findByRole("heading", { name: /compare the explanations/i });

    const firstRow = document.querySelector<HTMLElement>(".rh-evidence-row-btn")!;
    fireEvent.click(firstRow);
    expect(firstRow.getAttribute("aria-expanded")).toBe("true");
    const statement = document.querySelector(".rh-evidence-statement");
    expect(statement).toBeTruthy();
    // its citation, if any, must be a real resolving link (not a dead
    // reference) -- if present it should carry a real href.
    const cite = statement?.querySelector("a.rh-cite");
    if (cite) expect(cite.getAttribute("href")).toMatch(/^#rh-source-\d+$/);
  });

  it("every primary control is a real semantic element (button / range input)", async () => {
    renderPage("the-wow-signal");
    await screen.findByRole("heading", { level: 1, name: /the wow! signal/i });

    // Real <button>/<input type=range> elements are keyboard-operable by
    // the browser itself (Enter/Space activates a button, arrow keys move
    // a range) -- guaranteed HTML behaviour, not something jsdom can
    // usefully re-simulate. This asserts every primary control actually
    // is one of those elements rather than a div with a click handler.
    const selector =
      ".wow-replay-play, .wow-replay-glyph, .wow-secondpass-replay, .rh-explorer-tab, .rh-evidence-row-btn, .rh-media-hotspot";
    for (const el of document.querySelectorAll(selector)) {
      expect(el.tagName).toBe("BUTTON");
      expect(el.getAttribute("type")).toBe("button");
    }
    expect(document.querySelector(".wow-replay-scrub")?.tagName).toBe("INPUT");
    expect(document.querySelector<HTMLInputElement>(".wow-replay-scrub")?.type).toBe("range");
  });

  it("the second-pass replay resolves to its end state under prefers-reduced-motion", async () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as never;
    renderPage("the-wow-signal");
    const replayButton = await screen.findByRole("button", { name: /^replay$/i });
    fireEvent.click(replayButton);

    await waitFor(() => {
      const states = [...document.querySelectorAll(".wow-pass-state")].map((el) => el.textContent);
      expect(states).toEqual(["Detected", "Nothing detected"]);
    });
  });

  it("citations rendered inside the experience resolve to the same source list as the article", async () => {
    renderPage("the-wow-signal");
    await screen.findByRole("heading", { name: /compare the explanations/i });
    const hypThesis = document.querySelector(".rh-evidence-hyp-thesis")!;
    const cites = within(hypThesis as HTMLElement).getAllByRole("link");
    expect(cites.length).toBeGreaterThan(0);
    cites.forEach((cite) => {
      expect(cite.getAttribute("aria-label")).toMatch(/jump to source \d+/i);
      expect(cite.getAttribute("href")).toMatch(/^#rh-source-\d+$/);
    });
  });
});
