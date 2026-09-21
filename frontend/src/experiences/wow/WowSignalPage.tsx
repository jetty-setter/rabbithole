import { useRef } from "react";

import { monthYear, type RabbitHole } from "../../api";
import { ContestedOpen } from "../../components/rabbithole/ContestedOpen";
import { KeepDigging } from "../../components/rabbithole/KeepDigging";
import { RabbitHoleMedia, type MediaHotspot } from "../../components/rabbithole/RabbitHoleMedia";
import { RabbitHoleTimeline } from "../../components/rabbithole/RabbitHoleTimeline";
import { SourcesList } from "../../components/rabbithole/SourcesList";
import { EvidenceSearch } from "../../components/rabbithole/EvidenceSearch";
import { WhatWeKnow } from "../../components/rabbithole/WhatWeKnow";
import type { Experience } from "../types";
import { buildSourceIdIndex } from "../sources";
import { useEvidenceState } from "../useEvidenceState";
import { WOW_SCENES } from "../wow-signal.scenes";
import { canRunStageMotion } from "./motion";
import { InvestigationSequence } from "./stage/InvestigationSequence";
import type { PassLabels } from "./stage/SecondPassSequence";
import type { SignalStep } from "./stage/SignalSequence";
import { usePrefersReducedMotion } from "./useMotion";
import { WowEvidenceStage } from "./WowEvidenceStage";

/** RabbitHole's flagship interactive experience. The page itself stays
 *  calm -- title, hook, the real artifact, then the case file -- with a
 *  single bounded, playable animation stage ("Evidence Theatre") in the
 *  middle doing the actual motion work: the artifact's extraction, the
 *  72-second signal reconstruction, and the second pass, all on one
 *  authored GSAP timeline the reader drives directly (Play / Pause /
 *  Restart / scrub / chapter jump). Scrolling just moves the reader
 *  through the page, the way it moves them through any article --
 *  nothing here is choreographed to scroll position. The Investigation
 *  section below the stage is its own animated moment (GSAP Flip
 *  reorganizes evidence tokens into their verdict column when the active
 *  hypothesis changes), not part of the stage's timeline.
 *
 *  Wow-specific narration lives in wow-signal.scenes.ts; Wow-specific
 *  facts live in wow-signal.experience.json; this component only
 *  composes them. */
export function WowSignalPage({ rh, experience }: { rh: RabbitHole; experience: Experience }) {
  const reduced = usePrefersReducedMotion();
  const cinematic = canRunStageMotion() && !reduced;
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

  const replaySteps: SignalStep[] = replaySequence
    ? [...replaySequence.steps]
        .sort((a, b) => a.order - b.order)
        .map((s) => ({ label: s.label, elapsedSeconds: s.elapsedSeconds ?? 0, value: s.value ?? 0, valueLabel: s.valueLabel }))
    : [];

  const cmpSteps = comparisonSequence ? [...comparisonSequence.steps].sort((a, b) => a.order - b.order) : [];
  const [firstPass, secondPass] = cmpSteps;
  const passLabels: PassLabels = {
    firstLabel: firstPass?.label ?? "First pass",
    firstState: firstPass?.state ?? "Detected",
    secondLabel: secondPass?.label ?? "Second pass",
    secondState: secondPass?.state ?? "Nothing detected",
    timing: secondPass?.timing ?? "",
    waiting: WOW_SCENES.secondPassWaiting,
    absence: WOW_SCENES.secondPassAbsence,
  };

  const caseFileRef = useRef<HTMLDivElement | null>(null);
  const scrollToCaseFile = () => {
    caseFileRef.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  };

  const published = monthYear(rh.published_at);

  return (
    <main className="page wow-exp" data-reduced-motion={reduced || undefined} data-cinematic={cinematic || undefined}>
      <SceneIntro rh={rh} title={rh.title} />

      <section className="wow-scene wow-scene--stage" aria-labelledby="wow-h-stage">
        <p className="wow-eyebrow">Reconstruct the observation</p>
        <h2 className="wow-h" id="wow-h-stage">
          The 72 seconds
        </h2>
        <p className="wow-lead">{WOW_SCENES.replayIntro}</p>
        {replaySequence && (
          <WowEvidenceStage
            rh={rh}
            hotspots={hotspots}
            replaySteps={replaySteps}
            passLabels={passLabels}
            reduced={reduced}
            cinematic={cinematic}
          />
        )}
      </section>

      <section className="wow-scene wow-scene--investigation" id="wow-investigation" aria-labelledby="wow-h-investigation">
        <p className="wow-eyebrow">{WOW_SCENES.investigationHeading}</p>
        <h2 className="wow-h" id="wow-h-investigation">
          Compare the explanations
        </h2>
        <p className="wow-lead">{WOW_SCENES.investigationIntro}</p>
        <InvestigationSequence
          experience={experience}
          sourceIndex={sourceIndex}
          activeHypothesisId={evidenceState.activeHypothesisId}
          onSelectHypothesis={evidenceState.selectHypothesis}
          reduced={reduced}
        />
      </section>

      <SceneUnresolved onOpenCaseFile={scrollToCaseFile} />

      <div ref={caseFileRef}>
        <SceneCaseFile rh={rh} published={published} />
      </div>
    </main>
  );
}

// ── calm, static page furniture (outside the stage) ────────────────────

function SceneIntro({ rh, title }: { rh: RabbitHole; title: string }) {
  return (
    <section className="wow-scene wow-scene--intro" aria-label="The Wow! Signal">
      <p className="wow-eyebrow">{WOW_SCENES.eyebrow}</p>
      <h1 className="wow-intro-title">{title}</h1>
      <p className="wow-arrival-line">{WOW_SCENES.arrivalLine}</p>
      <div className="wow-intro-artifact">
        <RabbitHoleMedia items={rh.media} />
        <p className="wow-artifact-cue">{WOW_SCENES.artifactLabel}</p>
      </div>
    </section>
  );
}

function SceneUnresolved({ onOpenCaseFile }: { onOpenCaseFile: () => void }) {
  return (
    <section className="wow-scene wow-scene--quiet" aria-label="The case remains open">
      <div className="wow-unresolved">
        {WOW_SCENES.unresolvedLines.map((line, i) => (
          <p className="wow-unresolved-line" key={i}>
            {line}
          </p>
        ))}
      </div>
      <button type="button" className="wow-stage-play wow-casefile-cta" onClick={onOpenCaseFile}>
        {WOW_SCENES.caseFileCta} ↓
      </button>
      <p className="wow-casefile-sub">{WOW_SCENES.caseFileSub}</p>
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
        {rh.sources.length > 0 && <EvidenceSearch key={rh.slug} slug={rh.slug} />}
      </div>
    </section>
  );
}
