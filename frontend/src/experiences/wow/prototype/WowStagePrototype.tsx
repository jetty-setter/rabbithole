import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import { gsap } from "../motion";
import { SHOTS, StageEngine, TOTAL_DURATION, type StageRegion, type StageSample } from "./StageEngine";
import "./wowStagePrototype.css";

function formatT(seconds: number): string {
  return `${seconds.toFixed(1)}s`;
}

function sampleMasterTime(sampleT: number, totalObservation: number): number {
  return SHOTS.signal + (sampleT / totalObservation) * (SHOTS.end - SHOTS.signal);
}

/** Standalone motion prototype for the Wow! Signal reconstruction --
 *  intentionally isolated from the production Wow! Signal experience
 *  (WowSignalPage / WowEvidenceStage) so it can be reviewed and iterated
 *  on without any risk to what's already shipped. Delete this directory
 *  plus its route in App.tsx to remove it entirely.
 *
 *  React owns lifecycle/state (this component); Three.js
 *  (StageEngine.ts) owns the visual environment and runs its own
 *  persistent render loop; GSAP owns the authored timeline, used purely
 *  as a scrubbable clock (no visual targets of its own); the DOM owns
 *  controls and their accessible equivalents. */
export function WowStagePrototype({
  imageUrl,
  imageAlt,
  region,
  samples,
  reduced,
}: {
  imageUrl: string;
  imageAlt: string;
  region: StageRegion;
  samples: StageSample[];
  reduced: boolean;
}) {
  const totalObservation = samples[samples.length - 1]?.t ?? 72;
  const maxValue = Math.max(...samples.map((s) => s.value), 1);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<StageEngine | null>(null);
  const tRef = useRef(0);
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  const [tDisplay, setTDisplay] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [anchor, setAnchor] = useState({ xPct: 50, yPct: 50, opacity: 0, scale: 0.55 });
  const [engineReady, setEngineReady] = useState(false);

  useLayoutEffect(() => {
    const tl = gsap.timeline({
      paused: true,
      onUpdate: () => {
        tRef.current = tl.time();
        setTDisplay(tl.time());
      },
      onComplete: () => setPlaying(false),
    });
    tl.to({}, { duration: TOTAL_DURATION });
    tlRef.current = tl;
    return () => {
      tl.kill();
      tlRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (reduced || !canvasRef.current || !containerRef.current) return;
    let disposed = false;
    const loader = new THREE.TextureLoader();
    loader.load(imageUrl, (texture) => {
      if (disposed || !canvasRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const engine = new StageEngine({
        canvas: canvasRef.current,
        texture,
        region,
        samples,
        width: rect.width,
        height: rect.height,
        getT: () => tRef.current,
        onAnchorChange: setAnchor,
      });
      engineRef.current = engine;
      engine.start();
      setEngineReady(true);
    });

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry || !engineRef.current) return;
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) engineRef.current.setSize(width, height);
    });
    ro.observe(containerRef.current);

    return () => {
      disposed = true;
      ro.disconnect();
      engineRef.current?.dispose();
      engineRef.current = null;
      setEngineReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  const play = () => {
    if ((tlRef.current?.time() ?? 0) >= TOTAL_DURATION) tlRef.current?.seek(0);
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
  const seekToSample = (sampleT: number) => {
    scrubTo(sampleMasterTime(sampleT, totalObservation));
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current || !engineRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    engineRef.current.setPointer(nx, ny);
  };
  const onPointerLeave = () => {
    engineRef.current?.setPointer(0, 0);
  };

  const activeSampleIdx = useMemo(() => {
    if (tDisplay < SHOTS.signal) return -1;
    const revealT = clamp01((tDisplay - SHOTS.signal) / (SHOTS.end - SHOTS.signal)) * totalObservation;
    let idx = 0;
    // Small epsilon: seeking to a sample's own master time and mapping it
    // back to revealT is a floating-point round trip, so without slack the
    // just-clicked sample can land a hair under its own threshold and the
    // highlight falls back to the previous one.
    for (let i = 0; i < samples.length; i++) {
      if (samples[i].t <= revealT + 0.02) idx = i;
    }
    return idx;
  }, [tDisplay, samples, totalObservation]);

  if (reduced) {
    return (
      <ReducedPrototypeStage imageUrl={imageUrl} imageAlt={imageAlt} region={region} samples={samples} maxValue={maxValue} />
    );
  }

  return (
    <div className="wsp">
      <p className="wsp-note">Standalone motion prototype -- not the production Wow! Signal experience.</p>
      <div
        className="wsp-frame"
        ref={containerRef}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        role="img"
        aria-label="Animated reconstruction: the real 1977 printout, the 6EQUJ5 sequence extracted, and the 72-second signal rebuilt from its six real intensity samples."
      >
        <canvas ref={canvasRef} className="wsp-canvas" />
        {!engineReady && <div className="wsp-loading" aria-hidden="true" />}
        <div
          className="wsp-anchor"
          aria-hidden="true"
          style={{
            left: `${anchor.xPct}%`,
            top: `${anchor.yPct}%`,
            opacity: anchor.opacity,
            transform: `translate(-50%, -50%) scale(${anchor.scale})`,
          }}
        >
          {["6", "E", "Q", "U", "J", "5"].map((c) => (
            <span key={c}>{c}</span>
          ))}
        </div>
        {tDisplay >= SHOTS.extract - 1 && (
          <div className="wsp-signal-row" aria-hidden="true">
            {samples.map((s, i) => (
              <button
                key={s.label}
                type="button"
                tabIndex={-1}
                className={`wsp-signal-glyph${i === activeSampleIdx ? " is-lit" : ""}`}
                style={{ left: `${2 + (s.t / totalObservation) * 96}%` }}
                onClick={() => seekToSample(s.t)}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
        {tDisplay >= SHOTS.end - 0.3 && <div className="wsp-black-hold" aria-hidden="true" />}
      </div>

      <div className="wsp-controls">
        <button type="button" className="wsp-play" onClick={playing ? pause : play} aria-label={playing ? "Pause" : "Play"}>
          {playing ? "Pause" : "Play"}
        </button>
        <button type="button" className="wsp-restart" onClick={restart}>
          Restart
        </button>
        <input
          type="range"
          className="wsp-scrub"
          min={0}
          max={TOTAL_DURATION}
          step={0.05}
          value={tDisplay}
          onPointerDown={() => engineRef.current?.setScrubbing(true)}
          onPointerUp={() => engineRef.current?.setScrubbing(false)}
          onChange={(e) => scrubTo(Number(e.target.value))}
          aria-label="Scrub through the reconstruction"
        />
        <span className="wsp-time" aria-hidden="true">
          {formatT(tDisplay)} / {formatT(TOTAL_DURATION)}
        </span>
      </div>

      <div className="wsp-samples" role="group" aria-label="Jump to a sample">
        {samples.map((s, i) => (
          <button
            key={s.label}
            type="button"
            className={`wsp-sample-btn${i === activeSampleIdx ? " is-active" : ""}`}
            aria-pressed={i === activeSampleIdx}
            onClick={() => seekToSample(s.t)}
          >
            {s.label}
            <small>{`${s.value.toFixed(0)}x`}</small>
          </button>
        ))}
      </div>

      <p className="wsp-sr-summary">
        Six real samples over 72 seconds: {samples.map((s) => `${s.label} approximately ${s.value.toFixed(0)} times background`).join(", ")}.
      </p>
    </div>
  );
}

function ReducedPrototypeStage({
  imageUrl,
  imageAlt,
  region,
  samples,
  maxValue,
}: {
  imageUrl: string;
  imageAlt: string;
  region: StageRegion;
  samples: StageSample[];
  maxValue: number;
}) {
  const [activeIdx, setActiveIdx] = useState(0);
  const active = samples[activeIdx];
  return (
    <div className="wsp wsp--reduced">
      <p className="wsp-note">Standalone motion prototype -- not the production Wow! Signal experience.</p>
      <div className="wsp-reduced-artifact">
        <img src={imageUrl} alt={imageAlt} />
        <div
          className="wsp-reduced-hotspot"
          style={{ left: `${region.left}%`, top: `${region.top}%`, width: `${region.width}%`, height: `${region.height}%` }}
        />
      </div>
      <div className="wsp-samples" role="group" aria-label="The six samples">
        {samples.map((s, i) => (
          <button
            key={s.label}
            type="button"
            className={`wsp-sample-btn${i === activeIdx ? " is-active" : ""}`}
            aria-pressed={i === activeIdx}
            onClick={() => setActiveIdx(i)}
          >
            {s.label}
          </button>
        ))}
      </div>
      <p className="wsp-reduced-readout">
        <strong>{active.label}</strong> — approximately {active.value.toFixed(0)}× background ({((active.value / maxValue) * 100).toFixed(0)}% of peak).
      </p>
    </div>
  );
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
