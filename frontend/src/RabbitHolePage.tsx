import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { getRabbitHole, type RabbitHole } from "./api";
import { BeamExplainer } from "./components/rabbithole/BeamExplainer";
import { ContestedOpen } from "./components/rabbithole/ContestedOpen";
import { EvidenceExplorer } from "./components/rabbithole/EvidenceExplorer";
import { KeepDigging } from "./components/rabbithole/KeepDigging";
import { RabbitHoleHeader } from "./components/rabbithole/RabbitHoleHeader";
import { RabbitHoleTimeline } from "./components/rabbithole/RabbitHoleTimeline";
import { SignalReplay } from "./components/rabbithole/SignalReplay";
import { SourcesList } from "./components/rabbithole/SourcesList";
import { WhatWeKnow } from "./components/rabbithole/WhatWeKnow";
import { useDocumentMeta } from "./hooks/useDocumentMeta";
import { RABBITHOLE_EXTRAS } from "./rabbitholeExtras";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; rh: RabbitHole }
  | { status: "not_found" }
  | { status: "error" };

/** The public RabbitHole reader page (`/rabbitholes/:slug`). Content comes
 *  entirely from the live API — nothing here is specific to any one
 *  RabbitHole. Optional sections that the API omits simply don't render. */
export function RabbitHolePage() {
  const { slug } = useParams<{ slug: string }>();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  // Set once the reader engages the interactive signal replay -- passed
  // down to highlight the real 6EQUJ5 sequence in the archival printout.
  const [signalEngaged, setSignalEngaged] = useState(false);

  useEffect(() => {
    if (!slug) return;
    let live = true;
    setState({ status: "loading" });
    getRabbitHole(slug)
      .then((rh) => {
        if (!live) return;
        setState(rh ? { status: "ready", rh } : { status: "not_found" });
      })
      .catch(() => live && setState({ status: "error" }));
    return () => {
      live = false;
    };
  }, [slug]);

  useDocumentMeta(
    state.status === "ready" ? state.rh.title : undefined,
    state.status === "ready" ? state.rh.subtitle ?? undefined : undefined,
  );

  if (state.status === "loading") return <RabbitHoleSkeleton />;
  if (state.status === "not_found") return <RabbitHoleMissing />;
  if (state.status === "error") return <RabbitHoleError />;

  const rh = state.rh;
  const contested =
    rh.contested_open &&
    ((rh.contested_open.intro && rh.contested_open.intro.trim()) ||
      rh.contested_open.items.length > 0 ||
      rh.contested_open.open_questions.length > 0)
      ? rh.contested_open
      : null;
  const timeline = rh.timeline && rh.timeline.length > 0 ? rh.timeline : null;
  const extras = RABBITHOLE_EXTRAS[rh.slug];

  return (
    <main className="page rh-page">
      <article className="rh">
        <RabbitHoleHeader
          rh={rh}
          mediaHighlight={
            extras?.signalSpecimen
              ? { region: extras.signalSpecimen.highlightRegion, active: signalEngaged }
              : undefined
          }
        />

        {/* The top half's three visual moments: the real archival printout
            (in the header above), the signal replay, then the detected-
            vs-missing second-pass comparison -- before the article
            returns to its normal reading flow. */}
        {extras?.signalSpecimen && (
          <SignalReplay
            spec={extras.signalSpecimen}
            onEngage={() => setSignalEngaged(true)}
          />
        )}
        {extras?.beamExplainer && <BeamExplainer spec={extras.beamExplainer} />}

        {rh.short_version && (
          <section className="rh-block rh-short" aria-labelledby="rh-h-short">
            <h2 className="rh-short-label" id="rh-h-short">
              The short version
            </h2>
            <p className="rh-short-text">{rh.short_version}</p>
          </section>
        )}

        {rh.what_we_know.length > 0 && <WhatWeKnow facts={rh.what_we_know} />}
        {contested &&
          (extras ? <EvidenceExplorer data={contested} /> : <ContestedOpen data={contested} />)}
        {timeline && <RabbitHoleTimeline entries={timeline} />}
        {rh.keep_digging.length > 0 && <KeepDigging connections={rh.keep_digging} />}
        {rh.sources.length > 0 && <SourcesList sources={rh.sources} />}
      </article>
    </main>
  );
}

// ── states ───────────────────────────────────────────────────────────

function RabbitHoleSkeleton() {
  return (
    <main className="page rh-page" aria-busy="true">
      <div className="rh rh-skeleton" aria-hidden="true">
        <div className="sk rh-sk-eyebrow" />
        <div className="sk rh-sk-title" />
        <div className="sk rh-sk-title short" />
        <div className="sk rh-sk-sub" />
        <div className="sk rh-sk-meta" />
        <div className="rh-sk-hook">
          <div className="sk rh-sk-line" />
          <div className="sk rh-sk-line" />
          <div className="sk rh-sk-line short" />
        </div>
        <div className="rh-sk-block">
          <div className="sk rh-sk-line" style={{ width: "40%" }} />
          <div className="sk rh-sk-line" />
          <div className="sk rh-sk-line" />
          <div className="sk rh-sk-line short" />
        </div>
      </div>
    </main>
  );
}

function RabbitHoleMissing() {
  return (
    <main className="page rh-page">
      <div className="rh rh-state">
        <p className="rh-eyebrow">RabbitHole</p>
        <h1 className="rh-state-title">This one hasn&rsquo;t been dug yet</h1>
        <p className="rh-state-text">
          There&rsquo;s no RabbitHole at this address. It may be a draft, or the link
          may be wrong.
        </p>
        <Link to="/" className="rh-state-link">
          Back to the surface
        </Link>
      </div>
    </main>
  );
}

function RabbitHoleError() {
  return (
    <main className="page rh-page">
      <div className="rh rh-state">
        <p className="rh-eyebrow">RabbitHole</p>
        <h1 className="rh-state-title">Something went wrong loading this</h1>
        <p className="rh-state-text">
          The RabbitHole couldn&rsquo;t be reached. Try again in a moment.
        </p>
        <button className="rh-state-link" onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    </main>
  );
}
