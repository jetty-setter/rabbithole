import type { Sequence } from "../../../experiences/types";
import { SequenceComparison } from "./SequenceComparison";
import { SequenceReplay } from "./SequenceReplay";

export const sequenceDomId = (sequenceId: string) => `rh-seq-${sequenceId}`;

/** Picks the right presentation for a Sequence's `kind` -- the only
 *  branch point between the two V1 sequence shapes. The data never names
 *  a component or a layout; it only says "replay" or "comparison", and
 *  the renderer owns everything visual from there. Carries a stable DOM
 *  id (see sequenceDomId) so a hotspot pointing at this sequence can
 *  scroll straight to it, the same way an inline citation jumps to its
 *  source. */
export function SequencePlayer({
  sequence,
  onSelectEvidence,
}: {
  sequence: Sequence;
  onSelectEvidence?: (evidenceId: string) => void;
}) {
  return (
    <div id={sequenceDomId(sequence.id)}>
      {sequence.kind === "replay" ? (
        <SequenceReplay sequence={sequence} onSelectEvidence={onSelectEvidence} />
      ) : (
        <SequenceComparison sequence={sequence} onSelectEvidence={onSelectEvidence} />
      )}
    </div>
  );
}
