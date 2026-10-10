import type { RabbitHole } from "../../../api";
import type { Experience } from "../../../experiences/types";
import { buildSourceIdIndex } from "../../../experiences/sources";
import type { EvidenceState } from "../../../experiences/useEvidenceState";
import { EvidenceComparison } from "./EvidenceComparison";
import { SequencePlayer } from "./SequencePlayer";

/** The top of the investigation: inspect the artifact (rendered in the header,
 *  so hotspots sit on the image the reader already sees), replay what it
 *  recorded, then compare explanations against one body of evidence. All of it
 *  is driven by Experience data, with no RabbitHole-specific facts here. A
 *  RabbitHole without an experience renders nothing from this; the article
 *  continues below regardless. */
export function EvidenceExperience({
  experience,
  rh,
  state,
}: {
  experience: Experience;
  rh: RabbitHole;
  state: EvidenceState;
}) {
  const sourceIndex = buildSourceIdIndex(rh);

  return (
    <section className="rh-block rh-evidence-mode" aria-labelledby="rh-h-evidence">
      <p className="rh-evidence-eyebrow">Evidence mode</p>
      <h2 className="rh-evidence-mode-title" id="rh-h-evidence">
        {experience.title}
      </h2>

      {experience.sequences.map((sequence) => (
        <div className="rh-evidence-sequence" key={sequence.id}>
          <h3 className="rh-section-h">{sequence.title}</h3>
          <SequencePlayer sequence={sequence} onSelectEvidence={state.selectEvidence} />
        </div>
      ))}

      <div className="rh-evidence-sequence">
        <h3 className="rh-section-h">Compare the explanations</h3>
        <EvidenceComparison
          experience={experience}
          sourceIndex={sourceIndex}
          activeHypothesisId={state.activeHypothesisId}
          onSelectHypothesis={state.selectHypothesis}
          selectedEvidenceId={state.selectedEvidenceId}
          onSelectEvidence={state.selectEvidence}
        />
      </div>
    </section>
  );
}
