import { useEffect, useState } from "react";

import { getRabbitHole, type RabbitHole } from "../../../api";
import { loadExperience } from "../../registry";
import { usePrefersReducedMotion } from "../useMotion";
import { WowStagePrototype } from "./WowStagePrototype";

/** Thin dev-only page: fetches the real Wow! Signal RabbitHole + its
 *  Evidence Experience data (the same source the production page reads)
 *  purely to hand real facts -- the real artifact URL, the real measured
 *  hotspot region, the real six sample values -- to the prototype stage.
 *  Not linked from anywhere in the site; reachable only by its own route
 *  in App.tsx. Delete this file + that route to remove the prototype. */
export function WowStagePrototypePage() {
  const reduced = usePrefersReducedMotion();
  const [rh, setRh] = useState<RabbitHole | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let live = true;
    getRabbitHole("the-wow-signal")
      .then((r) => live && setRh(r))
      .catch(() => live && setError(true));
    return () => {
      live = false;
    };
  }, []);

  if (error) return <main className="page">Could not load the Wow! Signal RabbitHole.</main>;
  if (!rh) return <main className="page">Loading…</main>;

  const experience = loadExperience(rh.slug);
  const replaySequence = experience?.sequences.find((s) => s.kind === "replay");
  const region = experience?.artifacts[0]?.hotspots?.[0]?.region;
  const imageUrl = rh.media.find((m) => m.kind === "image")?.url;

  if (!experience || !replaySequence || !region || !imageUrl) {
    return <main className="page">Prototype needs the Wow! Signal experience data (artifact hotspot + replay sequence).</main>;
  }

  const samples = [...replaySequence.steps]
    .sort((a, b) => a.order - b.order)
    .map((s) => ({ label: s.label, t: s.elapsedSeconds ?? 0, value: s.value ?? 0 }));

  return (
    <main className="page" style={{ paddingTop: "5vh" }}>
      <div style={{ maxWidth: 1160, margin: "0 auto" }}>
        <p style={{ fontFamily: "var(--sans)", fontSize: 11, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--violet-light)" }}>
          Wow! Signal -- motion prototype
        </p>
        <h1 style={{ fontFamily: "var(--display)", fontSize: "clamp(28px, 3vw, 44px)", color: "var(--text)", margin: "8px 0 24px" }}>
          Real printout, real samples, one authored 24-second reconstruction
        </h1>
        <WowStagePrototype
          imageUrl={imageUrl}
          imageAlt="Scan of the 1977 Wow! Signal computer printout."
          region={region}
          samples={samples}
          reduced={reduced}
        />
      </div>
    </main>
  );
}
