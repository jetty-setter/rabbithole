import type { Sequence } from "../../../experiences/types";
import { SequenceComparison } from "./SequenceComparison";
import { SequenceReplay } from "./SequenceReplay";

export const sequenceDomId = (sequenceId: string) => `rh-seq-${sequenceId}`;

/** Picks the presentation for a Sequence's `kind`, the only branch between the
 *  two V1 shapes. The data says "replay" or "comparison" and never names a
 *  component or layout. It carries a stable DOM id (see sequenceDomId) so a
 *  hotspot pointing at this sequence can scroll to it, as an inline citation
 *  jumps to its source. */
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
