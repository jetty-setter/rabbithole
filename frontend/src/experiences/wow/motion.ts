import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// ScrollTrigger's own registration reads window.matchMedia synchronously --
// absent in this repo's jsdom test environment at module-import time (test
// files only stub it in their own beforeEach, which runs after imports have
// already resolved), so registering unconditionally would crash every test
// file that imports this module, not just the Wow! Signal ones. Guarded
// here rather than skipped outright so a real browser missing matchMedia
// for some other reason degrades the same way canRunPinnedMotion() already
// causes every scene to: no pins, plain resolved rendering.
if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
  gsap.registerPlugin(ScrollTrigger);
}

export { gsap, ScrollTrigger };

/** The page's small motion system -- named curves tied to what the motion
 *  is doing, not one generic `ease` reused everywhere. Picked once here so
 *  every scene reads as the same choreography rather than a pile of
 *  one-off tweens. No elastic/bounce/back anywhere in this file -- those
 *  read as playful UI, not documentary. */
export const EASE = {
  /** Something new settling into place (a scene's own content arriving). */
  enter: "power3.out",
  /** Something leaving/receding (a scene's content exiting, ceding the
   *  stage to what replaces it). */
  exit: "power2.in",
  /** A single continuous move through a scroll-scrubbed sequence -- the
   *  paper-to-data zoom, the countdown, the evidence-field handoff. */
  move: "power3.inOut",
  /** Small, immediate responses -- button presses, verdict pulses,
   *  hover/focus feedback. */
  micro: "power2.out",
} as const;

/** Duration bands, not one flat number everywhere -- see the comment on
 *  each call site for which of these it's using and why. Pinned/scrubbed
 *  sequences intentionally have no duration here: their pacing comes from
 *  how far the user scrolls, not from milliseconds. */
export const DURATION = {
  micro: 0.2,
  text: 0.45,
  scene: 1.1,
} as const;

/** Whether this browser can run the full pinned/scrubbed choreography.
 *  ScrollTrigger itself works without ResizeObserver, but this codebase's
 *  test environment (jsdom) has no real layout engine -- every element
 *  reports a zero-size, zero-position bounding box, which would make pins
 *  span no scroll distance and the geometry-dependent shared-element
 *  flight measure nothing sensible. Gating on ResizeObserver (absent in
 *  jsdom, present in every real browser this page targets) keeps the
 *  flagship choreography honestly untested-by-Vitest rather than silently
 *  wrong, while the reduced-motion-equivalent static path underneath it
 *  still renders and is what the test suite actually exercises. */
export function canRunPinnedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    typeof ResizeObserver !== "undefined" &&
    typeof IntersectionObserver !== "undefined"
  );
}

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}
