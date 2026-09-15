import { useEffect, useRef, useState } from "react";

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
import { useInView, usePrefersReducedMotion } from "./useMotion";

const BOX = { width: 900, height: 260 };

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

/** RabbitHole's flagship interactive experience: reconstruct the Wow!
 *  Signal observation rather than simply describe it. A sequence of
 *  scenes -- arrival, the real artifact, the 72-second replay, the
 *  disappearance, the missing second pass, investigation, and the
 *  unresolved case -- before the full research article (always present
 *  in the DOM, so #rh-source-N deep links and citation jumps keep
 *  working regardless of scroll position). Wow-specific narration lives
 *  in wow-signal.scenes.ts; Wow-specific facts live in
 *  wow-signal.experience.json; this component only choreographs them. */
export function WowSignalPage({ rh, experience }: { rh: RabbitHole; experience: Experience }) {
  const reduced = usePrefersReducedMotion();
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
    <main className="page wow-exp" data-reduced-motion={reduced || undefined}>
      {/* ── Scene 1 — Arrival ──────────────────────────────────────────── */}
      <SceneArrival title={rh.title} />

      {/* ── Scene 2 — the artifact, then 6EQUJ5 ──────────────────────────── */}
      <SceneArtifact rh={rh} hotspots={hotspots} onActivate={activateHotspot} foundGlyphs={foundGlyphs} />

      {/* ── Scene 3 — replay the 72 seconds ──────────────────────────────── */}
      <div ref={replayRef} id="wow-scene-replay">
        {replaySequence && (
          <SceneReplay sequence={replaySequence} reduced={reduced} onSeeEvidence={jumpToInvestigation} />
        )}
      </div>

      {/* ── Scene 4 — the disappearance ──────────────────────────────────── */}
      <SceneDisappearance />

      {/* ── Scene 5 — the second pass ─────────────────────────────────────── */}
      {comparisonSequence && <SceneSecondPass sequence={comparisonSequence} reduced={reduced} />}

      {/* ── Scene 6 — why that matters ─────────────────────────────────────── */}
      <SceneWhyItMatters />

      {/* ── Scene 7 — investigation ───────────────────────────────────────── */}
      <section className="wow-scene wow-scene--investigation" id="wow-investigation" aria-labelledby="wow-h-investigation">
        <FadeIn>
          <p className="wow-eyebrow">{WOW_SCENES.investigationHeading}</p>
          <h2 className="wow-h" id="wow-h-investigation">
            Compare the explanations
          </h2>
          <p className="wow-lead">{WOW_SCENES.investigationIntro}</p>
          <EvidenceComparison
            experience={experience}
            sourceIndex={sourceIndex}
            activeHypothesisId={evidenceState.activeHypothesisId}
            onSelectHypothesis={evidenceState.selectHypothesis}
            selectedEvidenceId={evidenceState.selectedEvidenceId}
            onSelectEvidence={evidenceState.selectEvidence}
          />
        </FadeIn>
      </section>

      {/* ── Scene 8 — the case is still open ─────────────────────────────── */}
      <SceneUnresolved onOpenCaseFile={scrollToCaseFile} />

      {/* ── Scene 9 — the case file (always mounted for deep links) ───────── */}
      <div ref={caseFileRef}>
        <SceneCaseFile rh={rh} published={published} />
      </div>
    </main>
  );
}

// ── individual scenes ─────────────────────────────────────────────────

function FadeIn({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <div ref={ref} className={`wow-fade${inView ? " is-visible" : ""} ${className}`}>
      {children}
    </div>
  );
}

function SceneArrival({ title }: { title: string }) {
  return (
    <section className="wow-scene wow-scene--arrival" aria-label="Arrival">
      <div className="wow-arrival-inner">
        <p className="wow-eyebrow">{WOW_SCENES.eyebrow}</p>
        <h1 className="wow-arrival-title">{title}</h1>
        <p className="wow-arrival-line">{WOW_SCENES.arrivalLine}</p>
      </div>
    </section>
  );
}

function SceneArtifact({
  rh,
  hotspots,
  onActivate,
  foundGlyphs,
}: {
  rh: RabbitHole;
  hotspots: MediaHotspot[];
  onActivate: () => void;
  foundGlyphs: boolean;
}) {
  const { ref, inView } = useInView<HTMLDivElement>(0.5);
  return (
    <section className="wow-scene wow-scene--artifact" aria-label="The archival record" ref={ref}>
      <div className={`wow-artifact-wrap${inView ? " is-visible" : ""}`}>
        <p className="wow-eyebrow">{WOW_SCENES.artifactLabel}</p>
        <RabbitHoleMedia
          items={rh.media}
          hotspots={hotspots}
          onActivateHotspot={onActivate}
        />
        <p className="wow-artifact-cue">{WOW_SCENES.findLabel}</p>
        <div className={`wow-glyph-reveal${foundGlyphs ? " is-shown" : ""}`} aria-hidden={!foundGlyphs}>
          {["6", "E", "Q", "U", "J", "5"].map((c, i) => (
            <span className="wow-glyph-reveal-char" key={i} style={{ transitionDelay: `${i * 60}ms` }}>
              {c}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function SceneReplay({
  sequence,
  reduced,
  onSeeEvidence,
}: {
  sequence: Sequence;
  reduced: boolean;
  onSeeEvidence: (evidenceId: string) => void;
}) {
  const steps = [...sequence.steps].sort((a, b) => a.order - b.order);
  const total = sequence.totalSeconds ?? steps[steps.length - 1]?.elapsedSeconds ?? 0;
  const points: TimedPoint[] = steps.map((s) => ({ t: s.elapsedSeconds ?? 0, value: s.value ?? 0 }));
  const maxValue = Math.max(...points.map((p) => p.value), 1);

  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(false);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const stepTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!playing) return;

    if (reduced) {
      // Discrete stepping, no continuous interpolation.
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

  const togglePlay = () => {
    setPlaying((p) => {
      if (!p && elapsed >= total) setElapsed(0);
      return !p;
    });
  };

  const selectElapsed = (t: number) => {
    setPlaying(false);
    setElapsed(t);
  };

  const path = buildSmoothPath(points, { ...BOX, maxValue });
  const head = playheadAt(points, elapsed, { ...BOX, maxValue });
  const activeIndex = currentStepIndex(steps, elapsed);
  const active = steps[activeIndex];

  return (
    <section className="wow-scene wow-scene--replay" aria-labelledby="wow-h-replay">
      <FadeIn>
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
                style={{ left: `${Math.min(96, Math.max(4, ((s.elapsedSeconds ?? 0) / total) * 100))}%` }}
                onClick={() => selectElapsed(s.elapsedSeconds ?? 0)}
                aria-pressed={i === activeIndex}
                aria-label={`Sample ${i + 1}: ${s.label}, ${s.valueLabel ?? ""}, elapsed ${formatElapsed(s.elapsedSeconds ?? 0)}`}
              >
                {s.label}
              </button>
            ))}
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
      </FadeIn>
    </section>
  );
}

function SceneDisappearance() {
  return (
    <section className="wow-scene wow-scene--quiet" aria-label="The signal ends">
      <FadeIn>
        <p className="wow-quiet-line">{WOW_SCENES.disappearance}</p>
      </FadeIn>
    </section>
  );
}

function SceneSecondPass({ sequence, reduced }: { sequence: Sequence; reduced: boolean }) {
  const steps = [...sequence.steps].sort((a, b) => a.order - b.order);
  const { ref, inView } = useInView<HTMLDivElement>(0.5);
  const [revealed, setRevealed] = useState(0);
  const played = useRef(false);
  const timers = useRef<number[]>([]);

  const replay = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    const delays = reduced ? steps.map(() => 0) : steps.map((_, i) => 400 + i * 1400);
    setRevealed(0);
    steps.forEach((_, i) => {
      timers.current.push(window.setTimeout(() => setRevealed(i + 1), delays[i]));
    });
  };

  useEffect(() => {
    if (inView && !played.current) {
      played.current = true;
      replay();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView]);

  const [first, second] = steps;

  return (
    <section className="wow-scene wow-scene--secondpass" aria-labelledby="wow-h-secondpass" ref={ref}>
      <div className={`wow-fade${inView ? " is-visible" : ""}`}>
        <p className="wow-eyebrow">{sequence.title}</p>
        <h2 className="wow-h" id="wow-h-secondpass">
          {WOW_SCENES.secondPassSetup}
        </h2>
        <button type="button" className="wow-replay-play wow-secondpass-replay" onClick={replay}>
          <span aria-hidden="true">▶</span> Replay
        </button>

        <div className="wow-secondpass-stage" aria-live="polite">
          <div className={`wow-pass-block${revealed >= 1 ? " is-shown" : ""}`}>
            <span className="wow-pass-label">{first.label}</span>
            <span className="wow-pass-state">{revealed >= 1 ? first.state : ""}</span>
          </div>
          <div className={`wow-pass-gap${revealed === 1 ? " is-active" : ""}`}>
            <span className="wow-pass-gap-text">
              {revealed === 1 ? second.timing : revealed >= 2 ? second.timing : WOW_SCENES.secondPassWaiting}
            </span>
          </div>
          <div className={`wow-pass-block wow-pass-block--miss${revealed >= 2 ? " is-shown" : ""}`}>
            <span className="wow-pass-label">{second.label}</span>
            <span className="wow-pass-state">{revealed >= 2 ? second.state : ""}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function SceneWhyItMatters() {
  const [expanded, setExpanded] = useState(false);
  return (
    <section className="wow-scene wow-scene--narrow" aria-label="Why the second pass matters">
      <FadeIn>
        <p className="wow-lead">{WOW_SCENES.whyItMattersLead}</p>
        {!expanded && (
          <button type="button" className="wow-inline-link" onClick={() => setExpanded(true)}>
            Why is this weird? ↓
          </button>
        )}
        {expanded && <p className="wow-lead wow-lead--muted">{WOW_SCENES.whyItMattersMore}</p>}
      </FadeIn>
    </section>
  );
}

function SceneUnresolved({ onOpenCaseFile }: { onOpenCaseFile: () => void }) {
  return (
    <section className="wow-scene wow-scene--quiet" aria-label="The case remains open">
      <FadeIn>
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
      </FadeIn>
    </section>
  );
}

function SceneCaseFile({ rh, published }: { rh: RabbitHole; published: string }) {
  const contested =
    rh.contested_open &&
    ((rh.contested_open.intro && rh.contested_open.intro.trim()) ||
      rh.contested_open.items.length > 0 ||
      rh.contested_open.open_questions.length > 0)
      ? rh.contested_open
      : null;
  const timeline = rh.timeline && rh.timeline.length > 0 ? rh.timeline : null;

  return (
    <section className="wow-scene wow-scene--casefile" aria-labelledby="wow-h-casefile">
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
