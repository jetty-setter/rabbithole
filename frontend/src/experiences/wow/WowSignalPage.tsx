import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { monthYear, type RabbitHole } from "../../api";
import { ContestedOpen } from "../../components/rabbithole/ContestedOpen";
import { KeepDigging } from "../../components/rabbithole/KeepDigging";
import { RabbitHoleMedia, type MediaHotspot } from "../../components/rabbithole/RabbitHoleMedia";
import { RabbitHoleTimeline } from "../../components/rabbithole/RabbitHoleTimeline";
import { SourcesList } from "../../components/rabbithole/SourcesList";
import { WhatWeKnow } from "../../components/rabbithole/WhatWeKnow";
import { EvidenceComparison } from "../../components/rabbithole/evidence/EvidenceComparison";
import type { Experience, Sequence } from "../types";
import { buildSourceIdIndex } from "../sources";
import { useEvidenceState } from "../useEvidenceState";
import { WOW_SCENES } from "../wow-signal.scenes";
import { buildSmoothPath, playheadAt, type TimedPoint } from "./interpolate";
import { canRunPinnedMotion, DURATION, EASE, gsap, ScrollTrigger } from "./motion";
import { usePrefersReducedMotion } from "./useMotion";

const BOX = { width: 900, height: 260 };
const GLYPHS = ["6", "E", "Q", "U", "J", "5"];
const OBSERVATION_CHIPS = ["72 SEC", "1420 MHz", "NARROWBAND", "BEAM PROFILE", "NO SECOND PASS", "NEVER REPEATED"];
const COUNTDOWN = ["2:52", "2:31", "1:48", "0:54", "0:08", "0:00"];

function currentStepIndex(steps: Sequence["steps"], elapsed: number): number {
  let idx = 0;
  for (let i = 0; i < steps.length; i++) {
    if ((steps[i].elapsedSeconds ?? 0) <= elapsed) idx = i;
  }
  return idx;
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function vh(fraction: number): () => string {
  return () => `+=${Math.round((typeof window !== "undefined" ? window.innerHeight : 800) * fraction)}`;
}

/** RabbitHole's flagship interactive experience: reconstruct the Wow!
 *  Signal observation as one continuous piece of scroll choreography
 *  rather than a stack of independently-fading sections. GSAP drives the
 *  motion (timelines for sequencing, ScrollTrigger for pinning and
 *  scroll-scrubbing); the browser's own scroll is never hijacked --
 *  ScrollTrigger only reads scroll position and, for a handful of
 *  deliberately chosen scenes, pins an element in place for a scroll
 *  distance while its own timeline plays. `cinematic` gates every bit of
 *  that: it's only true when the browser can support it (ResizeObserver +
 *  IntersectionObserver present -- absent in this repo's jsdom test
 *  environment, so tests exercise the plain resolved-state rendering) and
 *  the user hasn't asked for reduced motion. Either way, every scene's
 *  factual content, every control, and every citation is present in the
 *  DOM from the first render -- cinematic mode only adds motion on top of
 *  an already-complete page, it never gates content behind an animation.
 *
 *  Wow-specific narration lives in wow-signal.scenes.ts; Wow-specific
 *  facts live in wow-signal.experience.json; this component only
 *  choreographs them. */
export function WowSignalPage({ rh, experience }: { rh: RabbitHole; experience: Experience }) {
  const reduced = usePrefersReducedMotion();
  const cinematic = canRunPinnedMotion() && !reduced;
  const evidenceState = useEvidenceState(experience.hypotheses[0]?.id ?? null);
  const sourceIndex = buildSourceIdIndex(rh);

  const replaySequence = experience.sequences.find((s) => s.kind === "replay");
  const comparisonSequence = experience.sequences.find((s) => s.kind === "comparison");
  const hotspots: MediaHotspot[] = (experience.artifacts[0]?.hotspots ?? []).map((h) => ({
    id: h.id,
    region: h.region,
    label: h.label,
    explain: h.explain,
  }));

  const [foundGlyphs, setFoundGlyphs] = useState(false);
  const replayRef = useRef<HTMLDivElement | null>(null);
  const caseFileRef = useRef<HTMLDivElement | null>(null);

  const activateHotspot = () => {
    setFoundGlyphs(true);
    replayRef.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  };

  const jumpToInvestigation = (evidenceId?: string) => {
    if (evidenceId) evidenceState.selectEvidence(evidenceId);
    document
      .getElementById("wow-investigation")
      ?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  };

  const scrollToCaseFile = () => {
    caseFileRef.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  };

  const published = monthYear(rh.published_at);

  return (
    <main className="page wow-exp" data-reduced-motion={reduced || undefined} data-cinematic={cinematic || undefined}>
      {/* ── Scene 1 — Arrival ──────────────────────────────────────────── */}
      <SceneArrival title={rh.title} cinematic={cinematic} />

      {/* ── Scene 2 — the artifact, then 6EQUJ5 ──────────────────────────── */}
      <SceneArtifact
        rh={rh}
        hotspots={hotspots}
        onActivate={activateHotspot}
        foundGlyphs={foundGlyphs}
        cinematic={cinematic}
      />

      {/* ── Scene 3 — replay the 72 seconds ──────────────────────────────── */}
      <div ref={replayRef} id="wow-scene-replay">
        {replaySequence && (
          <SceneReplay
            sequence={replaySequence}
            reduced={reduced}
            cinematic={cinematic}
            onSeeEvidence={jumpToInvestigation}
          />
        )}
      </div>

      {/* ── Scene 4 — the disappearance ──────────────────────────────────── */}
      <SceneDisappearance cinematic={cinematic} />

      {/* ── Scene 5 — the second pass ─────────────────────────────────────── */}
      {comparisonSequence && <SceneSecondPass sequence={comparisonSequence} cinematic={cinematic} />}

      {/* ── Scene 6 — why that matters ─────────────────────────────────────── */}
      <SceneWhyItMatters cinematic={cinematic} />

      {/* ── Scene 7 — investigation ───────────────────────────────────────── */}
      <SceneInvestigation
        experience={experience}
        sourceIndex={sourceIndex}
        evidenceState={evidenceState}
        cinematic={cinematic}
      />

      {/* ── Scene 8 — the case is still open ─────────────────────────────── */}
      <SceneUnresolved onOpenCaseFile={scrollToCaseFile} cinematic={cinematic} />

      {/* ── Scene 9 — the case file (always mounted for deep links) ───────── */}
      <div ref={caseFileRef}>
        <SceneCaseFile rh={rh} published={published} cinematic={cinematic} />
      </div>
    </main>
  );
}

// ── individual scenes ─────────────────────────────────────────────────

/** Scene 1 → 2: the title recedes as the user scrolls -- scaling down,
 *  drifting up and fading -- instead of simply scrolling past. Pinned for
 *  a short scroll distance on desktop so the exit reads as one continuous
 *  move rather than the title just leaving the viewport at scroll speed. */
function SceneArrival({ title, cinematic }: { title: string; cinematic: boolean }) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const eyebrowRef = useRef<HTMLParagraphElement | null>(null);
  const lineRef = useRef<HTMLParagraphElement | null>(null);

  useLayoutEffect(() => {
    if (!cinematic || !sectionRef.current) return;
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();
      mm.add("(min-width: 901px)", () => {
        // Position offsets on a GSAP timeline are absolute seconds, not
        // fractions of the scrubbed scroll range -- every child tween needs
        // an explicit duration spread across the same rough total, or the
        // whole sequence (using GSAP's 0.5s default duration) finishes in
        // the first ~15% of the pin and leaves the rest of the scroll
        // distance dead.
        gsap.timeline({
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top top",
            end: vh(0.9),
            scrub: 0.4,
            pin: true,
            pinType: "transform",
            pinSpacing: true,
          },
        })
          .to(eyebrowRef.current, { opacity: 0, y: -18, duration: 0.8, ease: EASE.move }, 0)
          .to(titleRef.current, { scale: 0.82, y: -70, opacity: 0, duration: 2.0, ease: EASE.move }, 0)
          .to(lineRef.current, { opacity: 0, y: 16, duration: 0.8, ease: EASE.move }, 0.3);
      });
      mm.add("(max-width: 900px)", () => {
        gsap.timeline({
          scrollTrigger: { trigger: sectionRef.current, start: "top top", end: "bottom top", scrub: 0.4 },
        }).to([titleRef.current, eyebrowRef.current, lineRef.current], { opacity: 0, y: -20, ease: EASE.move });
      });
    }, sectionRef);
    return () => ctx.revert();
  }, [cinematic]);

  return (
    <section className="wow-scene wow-scene--arrival" aria-label="Arrival" ref={sectionRef}>
      <div className="wow-arrival-inner">
        <p className="wow-eyebrow" ref={eyebrowRef}>
          {WOW_SCENES.eyebrow}
        </p>
        <h1 className="wow-arrival-title" ref={titleRef}>
          {title}
        </h1>
        <p className="wow-arrival-line" ref={lineRef}>
          {WOW_SCENES.arrivalLine}
        </p>
      </div>
    </section>
  );
}

/** Scene 2 → 3: "PAPER → DATA". The real printout de-emphasizes and the
 *  composition pushes in toward the measured 6EQUJ5 hotspot; a typography
 *  overlay (not a copy of the artifact image) begins at that hotspot's own
 *  measured screen position and travels to a large, centered resting
 *  position that Scene 3 picks up from. Pinned for a longer scroll
 *  distance on desktop -- this is the page's one "spectacular" transition. */
function SceneArtifact({
  rh,
  hotspots,
  onActivate,
  foundGlyphs,
  cinematic,
}: {
  rh: RabbitHole;
  hotspots: MediaHotspot[];
  onActivate: () => void;
  foundGlyphs: boolean;
  cinematic: boolean;
}) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const imgWrapRef = useRef<HTMLDivElement | null>(null);
  const maskRef = useRef<HTMLDivElement | null>(null);
  const flightRef = useRef<HTMLDivElement | null>(null);

  const region = hotspots[0]?.region;
  const focusX = region ? region.left + region.width / 2 : 50;
  const focusY = region ? region.top + region.height / 2 : 50;

  useLayoutEffect(() => {
    if (!cinematic || !sectionRef.current) return;
    const hotspotEl = sectionRef.current.querySelector<HTMLElement>(".rh-media-hotspot");

    const ctx = gsap.context(() => {
      const measureFlightOrigin = () => {
        if (!hotspotEl || !stageRef.current) return { left: "50%", top: "50%" };
        const stageRect = stageRef.current.getBoundingClientRect();
        const hsRect = hotspotEl.getBoundingClientRect();
        return {
          left: hsRect.left - stageRect.left + hsRect.width / 2,
          top: hsRect.top - stageRect.top + hsRect.height / 2,
        };
      };

      const mm = gsap.matchMedia();

      mm.add("(min-width: 901px)", () => {
        // A second, independent ScrollTrigger on this same trigger element
        // (an earlier "fade the image in as it enters view" pass, before
        // the pin below) made GSAP miscompute the pin's fixed offset --
        // confirmed by comparing computed styles during real wheel-driven
        // scrolling: position was correctly "fixed", but with a `top` far
        // above the viewport, rendering the whole pinned scene invisible
        // for a stretch of real scroll distance. One ScrollTrigger per
        // pinned trigger element avoids it; the entrance beat lives inside
        // the pinned timeline itself instead (see the mask/scale tween at
        // position 0 below).
        if (!hotspotEl || !flightRef.current) return;
        const origin = measureFlightOrigin();
        gsap.set(flightRef.current, { left: origin.left, top: origin.top, xPercent: -50, yPercent: -50, scale: 0.35, opacity: 0 });

        // Same explicit-duration requirement as the arrival timeline above,
        // scaled up for this longer pin -- ~3.8s of spread-out milestones
        // rather than the default-duration cluster this used to collapse
        // into within the first ~20% of the scroll distance.
        gsap.timeline({
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top top",
            end: vh(1.9),
            scrub: 0.5,
            pin: true,
            pinType: "transform",
            pinSpacing: true,
            invalidateOnRefresh: true,
            onRefresh: () => {
              const o = measureFlightOrigin();
              gsap.set(flightRef.current, { left: o.left, top: o.top });
            },
          },
        })
          .to(maskRef.current, { opacity: 1, duration: 1.6, ease: EASE.move }, 0)
          .to(imgWrapRef.current, { scale: 1.24, duration: 3.0, ease: EASE.move }, 0)
          .to(flightRef.current, { opacity: 1, scale: 0.85, duration: 0.9, ease: EASE.move }, 1.0)
          .to(flightRef.current, { left: "50%", top: "58%", scale: 1.7, duration: 1.3, ease: EASE.move }, 1.7)
          .to(imgWrapRef.current, { opacity: 0, duration: 0.9, ease: EASE.exit }, 2.4)
          .to(maskRef.current, { opacity: 0, duration: 0.6, ease: EASE.exit }, 2.9)
          .to(sectionRef.current, { opacity: 0, duration: 0.5, ease: EASE.exit }, 3.3);
      });

      mm.add("(max-width: 900px)", () => {
        if (!flightRef.current) return;
        gsap.set(flightRef.current, { left: "50%", top: "50%", xPercent: -50, yPercent: -50, scale: 1, opacity: 0 });
        gsap.timeline({
          scrollTrigger: { trigger: sectionRef.current, start: "top 35%", end: "bottom 15%", scrub: 0.4 },
        })
          .to(imgWrapRef.current, { opacity: 0.3, duration: 1, ease: EASE.move }, 0)
          .to(flightRef.current, { opacity: 1, duration: 1, ease: EASE.move }, 0.6);
      });
    }, sectionRef);

    return () => ctx.revert();
  }, [cinematic]);

  return (
    <section className="wow-scene wow-scene--artifact" aria-label="The archival record" ref={sectionRef}>
      <div className="wow-artifact-wrap">
        <p className="wow-eyebrow">{WOW_SCENES.artifactLabel}</p>
        <div className="wow-artifact-stage" ref={stageRef}>
          {cinematic && (
            <div
              className="wow-artifact-mask"
              ref={maskRef}
              aria-hidden="true"
              style={{ "--wow-focus-x": `${focusX}%`, "--wow-focus-y": `${focusY}%` } as React.CSSProperties}
            />
          )}
          <div
            className="wow-artifact-imgwrap"
            ref={imgWrapRef}
            style={cinematic ? { transformOrigin: `${focusX}% ${focusY}%` } : undefined}
          >
            <RabbitHoleMedia items={rh.media} hotspots={hotspots} onActivateHotspot={onActivate} />
          </div>
          {cinematic && (
            <div className="wow-glyph-flight" ref={flightRef} aria-hidden="true">
              {GLYPHS.map((c) => (
                <span key={c}>{c}</span>
              ))}
            </div>
          )}
        </div>
        <p className="wow-artifact-cue">{WOW_SCENES.findLabel}</p>
        <div className={`wow-glyph-reveal${foundGlyphs ? " is-shown" : ""}`} aria-hidden={!foundGlyphs}>
          {GLYPHS.map((c, i) => (
            <span className="wow-glyph-reveal-char" key={i} style={{ transitionDelay: `${i * 50}ms` }}>
              {c}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Scene 3: the 72 seconds, made scrubbable. While this scene is pinned,
 *  scrolling itself becomes the transport -- scroll progress maps directly
 *  onto elapsed time, one shared `elapsed` state whether it's driven by
 *  scroll, the Play button's own real-time playback, the range scrubber,
 *  or tapping a sample. Pressing Play never moves the page (so the pin
 *  never fights the user), and any real scroll input during playback
 *  hands control straight back to scroll -- ScrollTrigger's onUpdate only
 *  fires from genuine scroll position changes, since playback itself never
 *  scrolls, so "the user scrolled" and "pause autoplay" are the same
 *  event. Past 72 seconds the same pinned scroll distance drives the
 *  collapse -- curve and glyphs losing intensity down to an empty field --
 *  before the pin releases into Scene 4's held silence. */
function SceneReplay({
  sequence,
  reduced,
  cinematic,
  onSeeEvidence,
}: {
  sequence: Sequence;
  reduced: boolean;
  cinematic: boolean;
  onSeeEvidence: (evidenceId: string) => void;
}) {
  // Memoized rather than recomputed inline: `steps` sits in the playback
  // effect's dependency array below, and a fresh array identity on every
  // render (setElapsed included) would tear the rAF loop down and rebuild
  // it every single tick -- resetting lastTsRef each time and effectively
  // pinning dt near 0, so Play would barely advance elapsed at all.
  const steps = useMemo(() => [...sequence.steps].sort((a, b) => a.order - b.order), [sequence]);
  const total = sequence.totalSeconds ?? steps[steps.length - 1]?.elapsedSeconds ?? 0;
  const points: TimedPoint[] = useMemo(
    () => steps.map((s) => ({ t: s.elapsedSeconds ?? 0, value: s.value ?? 0 })),
    [steps],
  );
  const maxValue = Math.max(...points.map((p) => p.value), 1);

  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(false);
  const playingRef = useRef(playing);
  playingRef.current = playing;

  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const stepTimerRef = useRef<number | null>(null);
  const sectionRef = useRef<HTMLElement | null>(null);
  const collapseRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!playing) return;

    if (reduced) {
      stepTimerRef.current = window.setInterval(() => {
        setElapsed((e) => {
          const idx = currentStepIndex(steps, e);
          const next = steps[idx + 1];
          if (!next) {
            setPlaying(false);
            return e;
          }
          return next.elapsedSeconds ?? e;
        });
      }, 1000);
      return () => {
        if (stepTimerRef.current) window.clearInterval(stepTimerRef.current);
      };
    }

    const tick = (ts: number) => {
      if (lastTsRef.current === null) lastTsRef.current = ts;
      const dt = (ts - lastTsRef.current) / 1000;
      lastTsRef.current = ts;
      setElapsed((e) => {
        const next = e + dt;
        if (next >= total) {
          setPlaying(false);
          return total;
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastTsRef.current = null;
    };
  }, [playing, reduced, steps, total]);

  useLayoutEffect(() => {
    if (!cinematic || !sectionRef.current) return;
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();
      mm.add("(min-width: 901px)", () => {
        ScrollTrigger.create({
          trigger: sectionRef.current,
          start: "top top",
          end: vh(2.6),
          scrub: 0.35,
          pin: true,
            pinType: "transform",
          pinSpacing: true,
          onUpdate: (self) => {
            if (playingRef.current) setPlaying(false);
            const p = self.progress;
            if (p <= 0.82) {
              setElapsed((p / 0.82) * total);
              gsap.set(collapseRef.current, { opacity: 1, scale: 1, y: 0 });
            } else {
              setElapsed(total);
              const cp = Math.min(1, (p - 0.82) / 0.18);
              gsap.set(collapseRef.current, { opacity: 1 - cp, scale: 1 - cp * 0.08, y: cp * 20 });
            }
          },
        });
      });
    }, sectionRef);
    return () => ctx.revert();
  }, [cinematic, total]);

  // The end-of-replay collapse also has to play when playback itself
  // reaches the end (no scroll involved) -- otherwise pressing Play and
  // letting it finish would just stop, with no disappearance at all.
  const collapsedForPlayback = useRef(false);
  useEffect(() => {
    if (!cinematic || !collapseRef.current) return;
    if (elapsed >= total && !playing) {
      if (collapsedForPlayback.current) return;
      collapsedForPlayback.current = true;
      gsap.fromTo(
        collapseRef.current,
        { opacity: 1, scale: 1, y: 0 },
        { opacity: 0, scale: 0.92, y: 20, duration: DURATION.scene, ease: EASE.exit, delay: 0.5 },
      );
    } else {
      collapsedForPlayback.current = false;
    }
  }, [elapsed, playing, total, cinematic]);

  const togglePlay = () => {
    setPlaying((p) => {
      if (!p && elapsed >= total) setElapsed(0);
      if (!p && collapseRef.current) gsap.set(collapseRef.current, { opacity: 1, scale: 1, y: 0 });
      return !p;
    });
  };

  const selectElapsed = (t: number) => {
    setPlaying(false);
    setElapsed(t);
    if (collapseRef.current) gsap.set(collapseRef.current, { opacity: 1, scale: 1, y: 0 });
  };

  const path = buildSmoothPath(points, { ...BOX, maxValue });
  const head = playheadAt(points, elapsed, { ...BOX, maxValue });
  const activeIndex = currentStepIndex(steps, elapsed);
  const active = steps[activeIndex];
  const intensity = active ? 1 + ((active.value ?? 0) / maxValue) * 0.6 : 1.15;

  return (
    <section className="wow-scene wow-scene--replay" aria-labelledby="wow-h-replay" ref={sectionRef}>
      <p className="wow-eyebrow">Reconstruct the observation</p>
      <h2 className="wow-h" id="wow-h-replay">
        The 72 seconds
      </h2>
      <p className="wow-lead">{WOW_SCENES.replayIntro}</p>

      <div className="wow-replay-controls">
        <button
          type="button"
          className="wow-replay-play"
          onClick={togglePlay}
          aria-label={playing ? "Pause the replay" : "Play the 72-second replay"}
        >
          {playing ? "Pause" : "Play"}
        </button>
        <input
          type="range"
          className="wow-replay-scrub"
          min={0}
          max={total}
          step={0.1}
          value={elapsed}
          onChange={(e) => selectElapsed(Number(e.target.value))}
          aria-label="Scrub through the observation"
          aria-valuetext={`${formatElapsed(elapsed)}, sample ${active?.label}`}
        />
        <span className="wow-replay-time" aria-hidden="true">
          {formatElapsed(elapsed)} / {formatElapsed(total)}
        </span>
      </div>

      <div className="wow-replay-collapse" ref={collapseRef}>
        <div className="wow-replay-field">
          <svg
            className="wow-replay-svg"
            viewBox={`0 0 ${BOX.width} ${BOX.height}`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path d={path} fill="none" stroke="var(--violet-deep)" strokeWidth="3" opacity="0.55" />
            <path
              d={path}
              fill="none"
              stroke="var(--violet-light)"
              strokeWidth="3"
              style={{
                clipPath: `inset(0 ${Math.max(0, 100 - (elapsed / total) * 100)}% 0 0)`,
              }}
            />
            <circle cx={Math.max(7, Math.min(BOX.width - 7, head.x))} cy={head.y} r="7" fill="var(--violet-light)" />
          </svg>
          <div className="wow-replay-glyphs" role="group" aria-label="The six samples">
            {steps.map((s, i) => (
              <button
                type="button"
                key={s.id}
                className={`wow-replay-glyph${i === activeIndex ? " is-active" : ""}`}
                style={{
                  left: `${Math.min(96, Math.max(4, ((s.elapsedSeconds ?? 0) / total) * 100))}%`,
                  ...(i === activeIndex ? ({ "--wow-intensity": intensity.toFixed(2) } as React.CSSProperties) : {}),
                }}
                onClick={() => selectElapsed(s.elapsedSeconds ?? 0)}
                aria-pressed={i === activeIndex}
                aria-label={`Sample ${i + 1}: ${s.label}, ${s.valueLabel ?? ""}, elapsed ${formatElapsed(s.elapsedSeconds ?? 0)}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {active && (
        <div className="wow-replay-readout" aria-live="polite">
          <strong>{active.valueLabel}</strong> {active.meaning}
          {active.evidenceId && (
            <button type="button" className="wow-inline-link" onClick={() => onSeeEvidence(active.evidenceId!)}>
              See the evidence →
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function SceneDisappearance({ cinematic }: { cinematic: boolean }) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const lineRef = useRef<HTMLParagraphElement | null>(null);

  useLayoutEffect(() => {
    if (!cinematic || !sectionRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        lineRef.current,
        { opacity: 0, y: 14 },
        {
          opacity: 1,
          y: 0,
          ease: EASE.enter,
          duration: DURATION.scene,
          scrollTrigger: { trigger: sectionRef.current, start: "top 70%", end: "top 40%", scrub: 0.4 },
        },
      );
    }, sectionRef);
    return () => ctx.revert();
  }, [cinematic]);

  return (
    <section className="wow-scene wow-scene--quiet" aria-label="The signal ends" ref={sectionRef}>
      <p className="wow-quiet-line" ref={lineRef}>
        {WOW_SCENES.disappearance}
      </p>
    </section>
  );
}

/** Scene 4 → 5: the wait, compressed into typography that accelerates
 *  toward 0:00, then a held, genuinely empty beat, then the payoff --
 *  "NO SECOND DETECTION." lands on its own, not beside an explanation. A
 *  GSAP timeline (paused, built once) owns the sequencing; it only ever
 *  calls back into React state (never writes text nodes directly), the
 *  same collaboration SceneReplay uses for its own playback. Pinned so the
 *  hold actually reads as a hold regardless of scroll speed. */
function SceneSecondPass({ sequence, cinematic }: { sequence: Sequence; cinematic: boolean }) {
  const steps = [...sequence.steps].sort((a, b) => a.order - b.order);
  const [first, second] = steps;

  const [stage, setStage] = useState<"idle" | "countdown" | "hold" | "payoff">(cinematic ? "idle" : "payoff");
  const [countdownIdx, setCountdownIdx] = useState(0);

  const sectionRef = useRef<HTMLElement | null>(null);
  const played = useRef(false);
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  useLayoutEffect(() => {
    if (!cinematic || !sectionRef.current) return;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ paused: true });
      tl.call(() => setStage("countdown"));
      COUNTDOWN.forEach((_, i) => {
        tl.call(() => setCountdownIdx(i)).to({}, { duration: i < 2 ? 0.4 : i < 4 ? 0.28 : 0.18 });
      });
      tl.call(() => setStage("hold")).to({}, { duration: 1.15 }).call(() => setStage("payoff"));
      tlRef.current = tl;

      ScrollTrigger.create({
        trigger: sectionRef.current,
        start: "top top",
        end: vh(0.7),
        pin: true,
            pinType: "transform",
        pinSpacing: true,
        onEnter: () => {
          if (!played.current) {
            played.current = true;
            tl.play(0);
          }
        },
      });
    }, sectionRef);
    return () => ctx.revert();
  }, [cinematic]);

  const replay = () => {
    if (cinematic && tlRef.current) {
      setStage("idle");
      tlRef.current.pause(0);
      requestAnimationFrame(() => tlRef.current?.play(0));
      return;
    }
    setStage("payoff");
  };

  return (
    <section className="wow-scene wow-scene--secondpass" aria-labelledby="wow-h-secondpass" ref={sectionRef}>
      <p className="wow-eyebrow">{sequence.title}</p>
      <h2 className="wow-h" id="wow-h-secondpass">
        {WOW_SCENES.secondPassSetup}
      </h2>
      <button type="button" className="wow-replay-play wow-secondpass-replay" onClick={replay}>
        <span aria-hidden="true">▶</span> Replay
      </button>

      <div className="wow-secondpass-field" aria-live="polite">
        <p className={`wow-secondpass-countdown${stage === "countdown" ? " is-shown" : ""}`} aria-hidden="true">
          {COUNTDOWN[countdownIdx]}
        </p>
        <div className="wow-secondpass-stage">
          <div className={`wow-pass-block${stage !== "idle" ? " is-shown" : ""}`}>
            <span className="wow-pass-label">{first.label}</span>
            <span className="wow-pass-state">{stage !== "idle" ? first.state : ""}</span>
          </div>
          <div className={`wow-pass-gap${stage === "hold" ? " is-active" : ""}`}>
            <span className="wow-pass-gap-text">
              {stage === "payoff" ? second.timing : stage === "hold" ? WOW_SCENES.secondPassWaiting : ""}
            </span>
          </div>
          <div className={`wow-pass-block wow-pass-block--miss${stage === "payoff" ? " is-shown" : ""}`}>
            <span className="wow-pass-label">{second.label}</span>
            <span className="wow-pass-state">{stage === "payoff" ? second.state : ""}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function SceneWhyItMatters({ cinematic }: { cinematic: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const sectionRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    if (!cinematic || !sectionRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        sectionRef.current!.children,
        { opacity: 0, y: 12 },
        {
          opacity: 1,
          y: 0,
          stagger: 0.06,
          ease: EASE.enter,
          duration: DURATION.text,
          scrollTrigger: { trigger: sectionRef.current, start: "top 78%", end: "top 48%", scrub: 0.4 },
        },
      );
    }, sectionRef);
    return () => ctx.revert();
  }, [cinematic]);

  return (
    <section className="wow-scene wow-scene--narrow" aria-label="Why the second pass matters" ref={sectionRef}>
      <p className="wow-lead">{WOW_SCENES.whyItMattersLead}</p>
      {!expanded && (
        <button type="button" className="wow-inline-link" onClick={() => setExpanded(true)}>
          Why is this weird? ↓
        </button>
      )}
      {expanded && <p className="wow-lead wow-lead--muted">{WOW_SCENES.whyItMattersMore}</p>}
    </section>
  );
}

/** Scene 5 → 7: the observations that just played out become evidence
 *  objects -- a row of plain tokens staggering in as the reader scrolls
 *  into the Investigation scene -- before the hypothesis/evidence
 *  comparison itself (reused, unmodified, from the generic Evidence Mode
 *  architecture). Reclassifying evidence when the active hypothesis
 *  changes gets its own small motion pass: rows briefly lift back in,
 *  weighted by their new verdict, without ever reordering them -- the
 *  reader's mental map of "where each fact lives" has to survive a
 *  hypothesis switch. */
function SceneInvestigation({
  experience,
  sourceIndex,
  evidenceState,
  cinematic,
}: {
  experience: Experience;
  sourceIndex: Map<string, number>;
  evidenceState: ReturnType<typeof useEvidenceState>;
  cinematic: boolean;
}) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const chipsRef = useRef<HTMLDivElement | null>(null);
  const evidenceWrapRef = useRef<HTMLDivElement | null>(null);
  const firstHypRender = useRef(true);

  useLayoutEffect(() => {
    if (!cinematic || !sectionRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        chipsRef.current!.children,
        { opacity: 0, y: 10 },
        {
          opacity: 1,
          y: 0,
          stagger: 0.05,
          ease: EASE.move,
          scrollTrigger: { trigger: sectionRef.current, start: "top 85%", end: "top 50%", scrub: 0.4 },
        },
      );
    }, sectionRef);
    return () => ctx.revert();
  }, [cinematic]);

  useLayoutEffect(() => {
    if (firstHypRender.current) {
      firstHypRender.current = false;
      return;
    }
    if (!cinematic || !evidenceWrapRef.current) return;
    const rows = evidenceWrapRef.current.querySelectorAll<HTMLElement>(".rh-evidence-row");
    if (rows.length === 0) return;
    gsap.fromTo(
      rows,
      { opacity: 0.3, y: 8 },
      {
        opacity: (_i, el) => {
          const badge = el.querySelector(".rh-evidence-verdict");
          if (badge?.classList.contains("rh-evidence-verdict--uncertain") || badge?.classList.contains("rh-evidence-verdict--not_applicable")) {
            return 0.62;
          }
          return 1;
        },
        y: 0,
        duration: DURATION.text,
        stagger: 0.025,
        ease: EASE.move,
        overwrite: true,
      },
    );
  }, [evidenceState.activeHypothesisId, cinematic]);

  return (
    <section className="wow-scene wow-scene--investigation" id="wow-investigation" aria-labelledby="wow-h-investigation" ref={sectionRef}>
      <p className="wow-eyebrow">{WOW_SCENES.investigationHeading}</p>
      <div className="wow-obs-chips" ref={chipsRef} aria-hidden="true">
        {OBSERVATION_CHIPS.map((c) => (
          <span className="wow-obs-chip" key={c} style={cinematic ? undefined : { opacity: 1, transform: "none" }}>
            {c}
          </span>
        ))}
      </div>
      <h2 className="wow-h" id="wow-h-investigation">
        Compare the explanations
      </h2>
      <p className="wow-lead">{WOW_SCENES.investigationIntro}</p>
      <div ref={evidenceWrapRef}>
        <EvidenceComparison
          experience={experience}
          sourceIndex={sourceIndex}
          activeHypothesisId={evidenceState.activeHypothesisId}
          onSelectHypothesis={evidenceState.selectHypothesis}
          selectedEvidenceId={evidenceState.selectedEvidenceId}
          onSelectEvidence={evidenceState.selectEvidence}
        />
      </div>
    </section>
  );
}

function SceneUnresolved({ onOpenCaseFile, cinematic }: { onOpenCaseFile: () => void; cinematic: boolean }) {
  const sectionRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    if (!cinematic || !sectionRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        sectionRef.current!.querySelectorAll(".wow-unresolved-line, .wow-casefile-cta, .wow-casefile-sub"),
        { opacity: 0, y: 14 },
        {
          opacity: 1,
          y: 0,
          stagger: 0.07,
          ease: EASE.enter,
          scrollTrigger: { trigger: sectionRef.current, start: "top 75%", end: "top 35%", scrub: 0.4 },
        },
      );
    }, sectionRef);
    return () => ctx.revert();
  }, [cinematic]);

  return (
    <section className="wow-scene wow-scene--quiet" aria-label="The case remains open" ref={sectionRef}>
      <div className="wow-unresolved">
        {WOW_SCENES.unresolvedLines.map((line, i) => (
          <p className="wow-unresolved-line" key={i}>
            {line}
          </p>
        ))}
      </div>
      <button type="button" className="wow-replay-play wow-casefile-cta" onClick={onOpenCaseFile}>
        {WOW_SCENES.caseFileCta} ↓
      </button>
      <p className="wow-casefile-sub">{WOW_SCENES.caseFileSub}</p>
    </section>
  );
}

/** Scene 9: the handoff out of the reconstruction and into the record.
 *  One calm settle-in as the case file arrives -- and nothing else. No
 *  further GSAP triggers exist below this point; motion density drops to
 *  zero on purpose once the reader is reading rather than experiencing. */
function SceneCaseFile({ rh, published, cinematic }: { rh: RabbitHole; published: string; cinematic: boolean }) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const contested =
    rh.contested_open &&
    ((rh.contested_open.intro && rh.contested_open.intro.trim()) ||
      rh.contested_open.items.length > 0 ||
      rh.contested_open.open_questions.length > 0)
      ? rh.contested_open
      : null;
  const timeline = rh.timeline && rh.timeline.length > 0 ? rh.timeline : null;

  useLayoutEffect(() => {
    if (!cinematic || !sectionRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        sectionRef.current,
        { opacity: 0.35, scale: 0.985 },
        {
          opacity: 1,
          scale: 1,
          ease: EASE.enter,
          duration: DURATION.scene,
          scrollTrigger: { trigger: sectionRef.current, start: "top 82%", end: "top 45%", scrub: 0.4 },
        },
      );
    }, sectionRef);
    return () => ctx.revert();
  }, [cinematic]);

  return (
    <section className="wow-scene wow-scene--casefile" aria-labelledby="wow-h-casefile" ref={sectionRef}>
      <div className="rh">
        <p className="wow-eyebrow" id="wow-h-casefile">
          The case file
        </p>
        <p className="rh-meta">
          <a href="#rh-h-sources" className="rh-meta-sources">
            {rh.sources.length} {rh.sources.length === 1 ? "source" : "sources"}
          </a>
          {published && (
            <span className="rh-meta-part">
              <span className="rh-meta-dot" aria-hidden="true">·</span>
              Published {published}
            </span>
          )}
        </p>

        {rh.short_version && (
          <section className="rh-block rh-short" aria-labelledby="rh-h-short">
            <h2 className="rh-short-label" id="rh-h-short">
              The short version
            </h2>
            <p className="rh-short-text">{rh.short_version}</p>
          </section>
        )}

        {rh.what_we_know.length > 0 && <WhatWeKnow facts={rh.what_we_know} />}
        {contested && <ContestedOpen data={contested} />}
        {timeline && <RabbitHoleTimeline entries={timeline} />}
        {rh.keep_digging.length > 0 && <KeepDigging connections={rh.keep_digging} />}
        {rh.sources.length > 0 && <SourcesList sources={rh.sources} />}
      </div>
    </section>
  );
}
