import { Cites } from "../CitationLink";
import { StateChip } from "../parts";
import type { EvidenceVerdict, Experience } from "../../../experiences/types";
import { resolveSourceRefs } from "../../../experiences/sources";

const VERDICT_LABEL: Record<EvidenceVerdict, string> = {
  supports: "Supports",
  weakens: "Weakens",
  compatible: "Compatible",
  uncertain: "Uncertain",
  not_applicable: "N/A",
};

/** "Which explanation best fits the evidence?" -- the evidence stays put;
 *  only the hypothesis changes. A row of hypothesis buttons switches one
 *  shared list of evidence, each row showing how that evidence bears on
 *  the selected hypothesis (Supports / Weakens / Compatible / Uncertain /
 *  N/A) -- read at a glance across the whole list, not one paragraph at
 *  a time. Selecting a row reveals its full statement and citations.
 *  Generic: reads Experience data only, no Wow-specific strings. */
export function EvidenceComparison({
  experience,
  sourceIndex,
  activeHypothesisId,
  onSelectHypothesis,
  selectedEvidenceId,
  onSelectEvidence,
}: {
  experience: Experience;
  sourceIndex: Map<string, number>;
  activeHypothesisId: string | null;
  onSelectHypothesis: (id: string) => void;
  selectedEvidenceId: string | null;
  onSelectEvidence: (id: string | null) => void;
}) {
  const hypothesis = experience.hypotheses.find((h) => h.id === activeHypothesisId) ?? experience.hypotheses[0];
  const evidenceById = new Map(experience.evidence.map((e) => [e.id, e]));
  const verdictByEvidence = new Map(hypothesis.evidence.map((ev) => [ev.evidenceId, ev.verdict]));
  const rowIds = experience.matrix?.evidenceIds ?? experience.evidence.map((e) => e.id);

  return (
    <div className="rh-evidence-compare">
      <div className="rh-explorer-tabs" role="group" aria-label="Hypotheses">
        {experience.hypotheses.map((h) => (
          <button
            type="button"
            key={h.id}
            className={`rh-explorer-tab${h.id === hypothesis.id ? " is-active" : ""}`}
            aria-pressed={h.id === hypothesis.id}
            onClick={() => onSelectHypothesis(h.id)}
          >
            {h.label}
          </button>
        ))}
      </div>

      <div className="rh-evidence-hyp" aria-live="polite">
        <div className="rh-explorer-standing">
          <span className="rh-explorer-standing-label">Current standing</span>
          <StateChip state={hypothesis.status} />
        </div>
        <p className="rh-evidence-hyp-thesis">
          {hypothesis.thesis} <Cites citations={resolveSourceRefs(hypothesis.sources, sourceIndex)} />
        </p>
      </div>

      <ul className="rh-evidence-list">
        {rowIds.map((id) => {
          const item = evidenceById.get(id);
          if (!item) return null;
          const verdict = verdictByEvidence.get(id) ?? "uncertain";
          const isSelected = id === selectedEvidenceId;
          return (
            <li className="rh-evidence-row" key={id}>
              <button
                type="button"
                className="rh-evidence-row-btn"
                aria-expanded={isSelected}
                onClick={() => onSelectEvidence(isSelected ? null : id)}
              >
                <span className={`rh-evidence-verdict rh-evidence-verdict--${verdict}`}>
                  {VERDICT_LABEL[verdict]}
                </span>
                <span className="rh-evidence-label">{item.label}</span>
              </button>
              {isSelected && (
                <p className="rh-evidence-statement">
                  {item.statement} <Cites citations={resolveSourceRefs(item.sources, sourceIndex)} />
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
