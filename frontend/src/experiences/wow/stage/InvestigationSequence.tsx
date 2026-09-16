import { useLayoutEffect, useRef, useState } from "react";

import { Cites } from "../../../components/rabbithole/CitationLink";
import type { EvidenceVerdict, Experience } from "../../types";
import { resolveSourceRefs } from "../../sources";
import { canRunStageMotion, EASE, Flip, gsap } from "../motion";

const BUCKETS: { id: "supports" | "weakens" | "compatible" | "uncertain"; label: string }[] = [
  { id: "supports", label: "Supports" },
  { id: "weakens", label: "Weakens" },
  { id: "compatible", label: "Compatible" },
  { id: "uncertain", label: "Uncertain" },
];

function bucketFor(verdict: EvidenceVerdict): (typeof BUCKETS)[number]["id"] {
  if (verdict === "not_applicable") return "uncertain";
  return verdict;
}

/** THE INVESTIGATION LAB. Not a tab panel swapping paragraphs -- the same
 *  evidence tokens stay on stage the whole time and physically reorganize
 *  into SUPPORTS/WEAKENS/COMPATIBLE/UNCERTAIN columns when the active
 *  hypothesis changes, via GSAP Flip: capture every token's position
 *  before the React re-render that moves it to its new bucket, then let
 *  Flip animate each one from where it *was* to where it now sits. No
 *  fade-out/fade-in swap -- the reader's spatial memory of "where each
 *  fact lives" survives a hypothesis change because the fact itself
 *  visibly travels. */
export function InvestigationSequence({
  experience,
  sourceIndex,
  activeHypothesisId,
  onSelectHypothesis,
  reduced,
}: {
  experience: Experience;
  sourceIndex: Map<string, number>;
  activeHypothesisId: string | null;
  onSelectHypothesis: (id: string) => void;
  reduced: boolean;
}) {
  const hypothesis = experience.hypotheses.find((h) => h.id === activeHypothesisId) ?? experience.hypotheses[0];
  const rowIds = experience.matrix?.evidenceIds ?? experience.evidence.map((e) => e.id);
  const evidenceById = new Map(experience.evidence.map((e) => [e.id, e]));
  const verdictByEvidence = new Map(hypothesis.evidence.map((ev) => [ev.evidenceId, ev.verdict]));

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  // Gated on real Flip-plugin capability, not just the reduced-motion
  // preference: ResizeObserver (part of canRunStageMotion()) is absent in
  // this repo's jsdom test environment, where Flip is never registered
  // (registration itself is guarded on matchMedia existing at module-load
  // time, before a test's own beforeEach stub runs) -- calling
  // Flip.getState/.from there throws, so `reduced` alone isn't a safe gate.
  const canAnimate = !reduced && canRunStageMotion();

  const flipStateRef = useRef<ReturnType<typeof Flip.getState> | null>(null);

  const selectHypothesis = (id: string) => {
    if (canAnimate && gridRef.current) {
      flipStateRef.current = Flip.getState(gridRef.current.querySelectorAll<HTMLElement>("[data-flip-id]"));
    }
    onSelectHypothesis(id);
  };

  useLayoutEffect(() => {
    if (!canAnimate || !flipStateRef.current) return;
    const state = flipStateRef.current;
    flipStateRef.current = null;
    Flip.from(state, {
      duration: 0.6,
      ease: EASE.move,
      stagger: 0.02,
      absolute: true,
      onEnter: (els) => gsap.fromTo(els, { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.4 }),
      onLeave: (els) => gsap.to(els, { opacity: 0, scale: 0.9, duration: 0.3 }),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeHypothesisId]);

  return (
    <div className="wow-lab">
      <div className="wow-lab-tabs" role="group" aria-label="Hypotheses">
        {experience.hypotheses.map((h) => (
          <button
            type="button"
            key={h.id}
            className={`wow-lab-tab${h.id === hypothesis.id ? " is-active" : ""}`}
            aria-pressed={h.id === hypothesis.id}
            onClick={() => selectHypothesis(h.id)}
          >
            {h.label}
          </button>
        ))}
      </div>

      <p className="wow-lab-thesis">
        {hypothesis.thesis} <Cites citations={resolveSourceRefs(hypothesis.sources, sourceIndex)} />
      </p>

      <div className="wow-lab-grid" ref={gridRef}>
        {BUCKETS.map((bucket) => (
          <div className="wow-lab-bucket" key={bucket.id} data-bucket={bucket.id}>
            <p className="wow-lab-bucket-label">{bucket.label}</p>
            <div className="wow-lab-bucket-tokens">
              {rowIds
                .filter((id) => bucketFor(verdictByEvidence.get(id) ?? "uncertain") === bucket.id)
                .map((id) => {
                  const item = evidenceById.get(id);
                  if (!item) return null;
                  const isSelected = selectedId === id;
                  return (
                    <div className="wow-lab-token" key={id} data-flip-id={id}>
                      <button
                        type="button"
                        className={`wow-lab-token-btn wow-lab-token-btn--${bucket.id}`}
                        aria-expanded={isSelected}
                        onClick={() => setSelectedId(isSelected ? null : id)}
                      >
                        {item.label}
                      </button>
                      {isSelected && (
                        <p className="wow-lab-token-detail">
                          {item.statement} <Cites citations={resolveSourceRefs(item.sources, sourceIndex)} />
                        </p>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
