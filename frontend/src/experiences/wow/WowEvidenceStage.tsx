import { useEffect, useLayoutEffect, useRef, useState } from "react";

import type { RabbitHole } from "../../api";
import type { MediaHotspot } from "../../components/rabbithole/RabbitHoleMedia";
import { ArtifactSequence } from "./stage/ArtifactSequence";
import { SecondPassSequence, type PassLabels } from "./stage/SecondPassSequence";
import { SignalSequence, type SignalStep } from "./stage/SignalSequence";
import { gsap } from "./motion";
import { Sonifier } from "./sonification";
import { WowReducedStage } from "./WowReducedStage";

const DURS = { artifact: 5, signal: 8, hold: 1.5, secondpass: 7 } as const;
const T_SIGNAL = DURS.artifact;
const T_HOLD = T_SIGNAL + DURS.signal;
const T_SECONDPASS = T_HOLD + DURS.hold;
const TOTAL = T_SECONDPASS + DURS.secondpass;

type Phase = "artifact" | "signal" | "hold" | "secondpass" | "done";

function phaseAt(t: number): Phase {
  if (t < T_SIGNAL) return "artifact";
  if (t < T_HOLD) return "signal";
  if (t < T_SECONDPASS) return "hold";
  if (t < TOTAL) return "secondpass";
  return "done";
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function formatT(seconds: number): string {
  return `${seconds.toFixed(1)}s`;
}

/** EVIDENCE THEATRE: the bounded, playable animated stage where the Wow!
 *  Signal observation is reconstructed -- artifact extraction, signal
 *  reconstruction, the second pass -- as one authored GSAP timeline the
 *  user drives directly (Play/Pause/Restart/scrub/chapter jump), not by
 *  scrolling the page. The timeline itself carries no visuals: it is a
 *  pure clock (`gsap.timeline` advancing a single empty tween), and every
 *  visual is a pure function of the current time `t`, so scrubbing,
 *  reversing, or resuming from any point is always safe -- there is no
 *  animation *state* to get out of sync, only a time to render from.
 *  Falls back to `WowReducedStage` (discrete, control-equivalent states)
 *  under reduced motion or when the browser can't support it. */
export function WowEvidenceStage({
  rh,
  hotspots,
  replaySteps,
  passLabels,
  reduced,
  cinematic,
}: {
  rh: RabbitHole;
  hotspots: MediaHotspot[];
  replaySteps: SignalStep[];
  passLabels: PassLabels;
  reduced: boolean;
  cinematic: boolean;
}) {
  if (!cinematic) {
    return (
      <WowReducedStage rh={rh} hotspots={hotspots} replaySteps={replaySteps} passLabels={passLabels} reduced={reduced} />
    );
  }
  return <CinematicStage rh={rh} hotspots={hotspots} replaySteps={replaySteps} passLabels={passLabels} />;
}

function CinematicStage({
  rh,
  hotspots,
  replaySteps,
  passLabels,
}: {
  rh: RabbitHole;
  hotspots: MediaHotspot[];
  replaySteps: SignalStep[];
  passLabels: PassLabels;
}) {
  const region = hotspots[0]?.region ?? { left: 50, top: 50, width: 0, height: 0 };
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const sonifierRef = useRef<Sonifier | null>(null);

  useLayoutEffect(() => {
    const tl = gsap.timeline({
      paused: true,
      onUpdate: () => setT(tl.time()),
      onComplete: () => setPlaying(false),
    });
    tl.addLabel("artifact", 0);
    tl.addLabel("signal", T_SIGNAL);
    tl.addLabel("secondpass", T_SECONDPASS);
    tl.to({}, { duration: TOTAL });
    tlRef.current = tl;
    return () => {
      tl.kill();
      tlRef.current = null;
    };
  }, []);

  useEffect(() => {
    return () => {
      sonifierRef.current?.stop();
    };
  }, []);

  const phase = phaseAt(t);

  useEffect(() => {
    if (!soundOn || !sonifierRef.current) return;
    if (phase !== "signal") {
      sonifierRef.current.update(0);
      return;
    }
    const points = replaySteps.map((s) => ({ t: s.elapsedSeconds, value: s.value }));
    const maxValue = Math.max(...points.map((p) => p.value), 1);
    const localP = clamp01((t - T_SIGNAL) / DURS.signal);
    const originalT = localP * 72;
    // Piecewise-linear read of the same samples driving the visual --
    // close enough for a restrained sonification, no extra dependency.
    let value = 0;
    for (let i = 0; i < points.length - 1; i++) {
      if (originalT >= points[i].t && originalT <= points[i + 1].t) {
        const span = points[i + 1].t - points[i].t || 1;
        const localT = (originalT - points[i].t) / span;
        value = points[i].value + (points[i + 1].value - points[i].value) * localT;
        break;
      }
    }
    sonifierRef.current.update(value / maxValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, soundOn, phase]);

  const play = () => {
    tlRef.current?.play();
    setPlaying(true);
  };
  const pause = () => {
    tlRef.current?.pause();
    setPlaying(false);
  };
  const restart = () => {
    tlRef.current?.seek(0);
    tlRef.current?.play();
    setPlaying(true);
  };
  const scrubTo = (value: number) => {
    tlRef.current?.pause();
    tlRef.current?.time(value);
    setPlaying(false);
  };
  const jumpTo = (label: string) => {
    tlRef.current?.pause();
    const time = tlRef.current?.labels?.[label] ?? 0;
    tlRef.current?.time(time);
    setPlaying(false);
  };

  const toggleSound = () => {
    if (!soundOn) {
      if (!sonifierRef.current) sonifierRef.current = new Sonifier();
      sonifierRef.current.start();
      setSoundOn(true);
    } else {
      sonifierRef.current?.stop();
      setSoundOn(false);
    }
  };

  const showArtifact = t < T_SIGNAL + 0.6;
  const showSignal = t > T_SIGNAL - 0.6 && t < T_HOLD + 0.05;
  const showSecondPass = t >= T_SECONDPASS - 0.05;

  const statusText =
    phase === "artifact"
      ? "Reconstruction: examining the archival printout."
      : phase === "signal"
        ? "Reconstruction: the signal is building."
        : phase === "hold"
          ? "Reconstruction: the signal has ended."
          : phase === "secondpass"
            ? "Reconstruction: watching for the expected second pass."
            : "Reconstruction: no second detection.";

  return (
    <div className="wow-stage">
      <p className="wow-sr-only" aria-live="polite">
        {statusText}
      </p>
      <div className="wow-stage-frame" role="img" aria-label="Animated reconstruction of the Wow! Signal observation">
        {showArtifact && (
          <ArtifactSequence
            progress={clamp01(t / DURS.artifact)}
            region={region}
            imageUrl={rh.media.find((m) => m.kind === "image")?.url ?? ""}
            imageAlt=""
          />
        )}
        {showSignal && (
          <SignalSequence progress={clamp01((t - T_SIGNAL) / DURS.signal)} steps={replaySteps} totalSeconds={72} />
        )}
        {phase === "hold" && (
          <div className="wow-stage-quiet" aria-hidden="true">
            And then it was gone.
          </div>
        )}
        {showSecondPass && (
          <SecondPassSequence progress={clamp01((t - T_SECONDPASS) / DURS.secondpass)} labels={passLabels} />
        )}
      </div>

      <div className="wow-stage-controls">
        <button type="button" className="wow-stage-play" onClick={playing ? pause : play} aria-label={playing ? "Pause" : "Play"}>
          {playing ? "Pause" : "Play"}
        </button>
        <button type="button" className="wow-stage-restart" onClick={restart}>
          Restart
        </button>
        <input
          type="range"
          className="wow-stage-scrub"
          min={0}
          max={TOTAL}
          step={0.05}
          value={t}
          onChange={(e) => scrubTo(Number(e.target.value))}
          aria-label="Scrub through the reconstruction"
        />
        <span className="wow-stage-time" aria-hidden="true">
          {formatT(t)} / {formatT(TOTAL)}
        </span>
        <button
          type="button"
          className={`wow-stage-sound${soundOn ? " is-active" : ""}`}
          onClick={toggleSound}
          aria-pressed={soundOn}
        >
          {soundOn ? "Sound on" : "Hear the data"}
        </button>
      </div>
      <p className="wow-stage-sound-note">Sonification of the recorded intensity values -- not audio of the Wow! Signal.</p>

      <div className="wow-stage-chapters" role="group" aria-label="Jump to a part of the reconstruction">
        <button type="button" className={`wow-stage-chapter${phase === "artifact" ? " is-active" : ""}`} onClick={() => jumpTo("artifact")}>
          The artifact
        </button>
        <button
          type="button"
          className={`wow-stage-chapter${phase === "signal" || phase === "hold" ? " is-active" : ""}`}
          onClick={() => jumpTo("signal")}
        >
          The signal
        </button>
        <button
          type="button"
          className={`wow-stage-chapter${phase === "secondpass" || phase === "done" ? " is-active" : ""}`}
          onClick={() => jumpTo("secondpass")}
        >
          The second pass
        </button>
      </div>
    </div>
  );
}
