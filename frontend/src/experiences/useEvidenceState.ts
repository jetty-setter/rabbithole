import { useMemo, useState } from "react";

export interface EvidenceState {
  /** The one piece of state every module reads and writes: a hotspot, a
   *  sequence step's "see the evidence" link, and the evidence
   *  comparison itself can all select (and clear) the same evidence
   *  item, so drilling into a fact in one place is reflected wherever
   *  else that fact appears. */
  selectedEvidenceId: string | null;
  selectEvidence: (evidenceId: string | null) => void;
  /** Which hypothesis the comparison currently shows. Kept alongside
   *  selectedEvidenceId (rather than as EvidenceComparison's own local
   *  state) so the same "one shared state object" pattern can extend to
   *  it later -- e.g. a future hotspot that points at a specific
   *  hypothesis -- without restructuring. */
  activeHypothesisId: string | null;
  selectHypothesis: (hypothesisId: string) => void;
}

/** Shared interaction state for one Evidence Experience, lifted to
 *  RabbitHolePage so the artifact's hotspots (rendered inside
 *  RabbitHoleHeader) and the sequence/comparison modules (rendered below
 *  it) read and write the same selection instead of being isolated
 *  islands. `initialHypothesisId` is normally the experience's first
 *  hypothesis, so the comparison has something selected before any
 *  interaction. */
export function useEvidenceState(initialHypothesisId: string | null): EvidenceState {
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(null);
  const [activeHypothesisId, setActiveHypothesisId] = useState<string | null>(initialHypothesisId);

  return useMemo<EvidenceState>(
    () => ({
      selectedEvidenceId,
      selectEvidence: (id) => setSelectedEvidenceId(id),
      activeHypothesisId,
      selectHypothesis: (id) => setActiveHypothesisId(id),
    }),
    [selectedEvidenceId, activeHypothesisId],
  );
}
