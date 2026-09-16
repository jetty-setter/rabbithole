// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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

  // jsdom has no ResizeObserver, so canRunStageMotion() is always false
  // here regardless of prefers-reduced-motion -- every render below
  // exercises WowReducedStage, the discrete/control-equivalent fallback
  // the animated stage falls back to under real reduced motion too. The
  // cinematic GSAP-driven stage (pin-free, play/pause/scrub timeline) is
  // exercised only by the Playwright verification against a real browser.

  it("renders the calm page + reduced stage + investigation lab structure", async () => {
    renderPage("the-wow-signal");
    await screen.findByRole("heading", { level: 1, name: /the wow! signal/i });
    expect(document.querySelector(".wow-exp")).toBeTruthy();
    expect(document.querySelector(".wow-stage--reduced")).toBeTruthy();
    expect(screen.getByRole("heading", { name: /the 72 seconds/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /compare the explanations/i })).toBeTruthy();
    // the traditional case file is always mounted (deep links must work
    // regardless of scroll position), not gated behind an interaction
    expect(document.querySelector(".rh-contested")).toBeTruthy();
    expect(document.querySelector(".rh-sources")).toBeTruthy();
  });

  it("tapping each sample selects it and updates the readout", async () => {
    renderPage("the-wow-signal");
    await screen.findByRole("heading", { level: 1, name: /the wow! signal/i });

    const buttons = [...document.querySelectorAll<HTMLButtonElement>(".wow-reduced-sample")];
    expect(buttons).toHaveLength(6);
    const labels = ["6", "E", "Q", "U", "J", "5"];
    buttons.forEach((btn, i) => {
      fireEvent.click(btn);
      expect(btn.getAttribute("aria-pressed")).toBe("true");
      expect(document.querySelector(".wow-reduced-sample.is-active")?.textContent).toBe(labels[i]);
    });
  });

  it("a hotspot on the printout reveals the digital glyphs", async () => {
    renderPage("the-wow-signal");
    await screen.findByRole("heading", { level: 1, name: /the wow! signal/i });

    const hotspot = document.querySelector<HTMLElement>(".rh-media-hotspot")!;
    expect(hotspot).toBeTruthy();
    expect(document.querySelector(".wow-glyph-reveal")?.classList.contains("is-shown")).toBe(false);
    fireEvent.click(hotspot);
    expect(document.querySelector(".wow-glyph-reveal")?.classList.contains("is-shown")).toBe(true);
  });

  it("both second-pass outcomes are shown at once, without any interaction needed", async () => {
    renderPage("the-wow-signal");
    await screen.findByRole("heading", { level: 1, name: /the wow! signal/i });
    const states = [...document.querySelectorAll(".wow-reduced-pass-state")].map((el) => el.textContent);
    expect(states).toEqual(["Detected", "Nothing detected"]);
    expect(document.querySelector(".wow-reduced-absence")?.textContent).toMatch(/no second detection/i);
  });

  it("switching hypotheses reclassifies evidence into new buckets; the tokens stay the same set", async () => {
    renderPage("the-wow-signal");
    await screen.findByRole("heading", { name: /compare the explanations/i });

    const tabs = screen.getAllByRole("button", { name: /transmission|interference|transient|comet/i });
    expect(tabs.length).toBe(4);

    const labelsBefore = [...document.querySelectorAll(".wow-lab-token-btn")].map((el) => el.textContent).sort();
    fireEvent.click(tabs[1]); // terrestrial interference
    const labelsAfter = [...document.querySelectorAll(".wow-lab-token-btn")].map((el) => el.textContent).sort();
    expect(labelsAfter).toEqual(labelsBefore); // same evidence, reclassified not replaced

    const buckets = new Set([...document.querySelectorAll(".wow-lab-bucket")].map((el) => el.getAttribute("data-bucket")));
    expect(buckets).toEqual(new Set(["supports", "weakens", "compatible", "uncertain"]));
  });

  it("selecting an evidence token reveals its statement with a resolving citation", async () => {
    renderPage("the-wow-signal");
    await screen.findByRole("heading", { name: /compare the explanations/i });

    const firstToken = document.querySelector<HTMLElement>(".wow-lab-token-btn")!;
    fireEvent.click(firstToken);
    expect(firstToken.getAttribute("aria-expanded")).toBe("true");
    const detail = document.querySelector(".wow-lab-token-detail");
    expect(detail).toBeTruthy();
    const cite = detail?.querySelector("a.rh-cite");
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
    const selector = ".wow-reduced-sample, .wow-lab-tab, .wow-lab-token-btn, .rh-media-hotspot";
    for (const el of document.querySelectorAll(selector)) {
      expect(el.tagName).toBe("BUTTON");
      expect(el.getAttribute("type")).toBe("button");
    }
  });

  it("citations rendered inside the investigation lab resolve to the same source list as the article", async () => {
    renderPage("the-wow-signal");
    await screen.findByRole("heading", { name: /compare the explanations/i });
    const thesis = document.querySelector(".wow-lab-thesis")!;
    const cites = within(thesis as HTMLElement).getAllByRole("link");
    expect(cites.length).toBeGreaterThan(0);
    cites.forEach((cite) => {
      expect(cite.getAttribute("aria-label")).toMatch(/jump to source \d+/i);
      expect(cite.getAttribute("href")).toMatch(/^#rh-source-\d+$/);
    });
  });
});
