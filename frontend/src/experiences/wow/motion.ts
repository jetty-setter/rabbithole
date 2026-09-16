import { gsap } from "gsap";
import { Flip } from "gsap/Flip";

if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
  gsap.registerPlugin(Flip);
}

export { Flip, gsap };

/** The stage's small motion system -- named curves tied to what the motion
 *  is doing, not one generic `ease` reused everywhere. No elastic/bounce/
 *  back anywhere -- those read as playful UI, not an evidence exhibit. */
export const EASE = {
  enter: "power3.out",
  exit: "power2.in",
  move: "power3.inOut",
  micro: "power2.out",
} as const;

/** Duration bands, not one flat number everywhere. Sequence durations
 *  live beside the sequence that uses them (see each stage component);
 *  these are just the reusable micro/transition bands. */
export const DURATION = {
  micro: 0.2,
  text: 0.45,
  scene: 1.1,
} as const;

/** Whether this browser can run the animated stage. Gated on
 *  ResizeObserver (used to keep the stage's own measurements current)
 *  and matchMedia -- both absent in this repo's jsdom test environment,
 *  so tests exercise the reduced/discrete-state rendering path, which is
 *  also what real browsers get under prefers-reduced-motion. */
export function canRunStageMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    typeof ResizeObserver !== "undefined"
  );
}

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/** Eased 0..1 -> 0..1 progress, sampled from the same named curves above
 *  (via GSAP's own eases) so a sequence's internal motion shares the same
 *  feel as everything else, even though the sequences render from a pure
 *  `progress` number rather than a running GSAP tween. */
export function ease(name: keyof typeof EASE, t: number): number {
  const fn = gsap.parseEase(EASE[name]);
  return fn(Math.max(0, Math.min(1, t)));
}
