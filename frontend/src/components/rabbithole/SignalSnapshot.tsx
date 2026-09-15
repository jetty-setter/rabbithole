import type { SnapshotField } from "../../rabbitholeExtras";
import { SectionHeading } from "./parts";

/** A compact, scannable key/value summary -- the basic orientation facts a
 *  reader would otherwise have to assemble from the opening prose. Generic:
 *  any RabbitHole could supply its own field list. Editorial, not a KPI
 *  dashboard -- plain type on the page background, no card, no tiles. */
export function SignalSnapshot({ fields }: { fields: SnapshotField[] }) {
  return (
    <section className="rh-block rh-snapshot" aria-labelledby="rh-h-snapshot">
      <SectionHeading id="rh-h-snapshot">At a glance</SectionHeading>
      <dl className="rh-snapshot-grid">
        {fields.map((f, i) => (
          <div className="rh-snapshot-field" key={i}>
            <dt>{f.label}</dt>
            <dd>{f.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
