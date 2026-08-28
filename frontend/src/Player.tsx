import Hls from "hls.js";
import { useEffect, useRef, useState, type RefObject } from "react";

const VOLUME_KEY = "rabbithole-volume";
const MUTED_KEY = "rabbithole-muted";
const CAPTIONS_KEY = "rabbithole-captions";
const HIDE_DELAY_MS = 2800;

function readStoredNumber(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

function readStoredBool(key: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return raw === "1" || raw === "true";
  } catch {
    return fallback;
  }
}

function writeStored(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode / storage disabled -- never let this break playback */
  }
}

/** iOS and other coarse-pointer devices don't let script set hardware
 *  volume -- .volume is read-only there (always 1). A visible slider that
 *  silently does nothing is worse than no slider, so we hide it on these
 *  environments and let the device's own volume control own playback. */
function volumeSliderSupported(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return true;
  const iOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (iOS) return false;
  return !(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
}

/** Seconds → m:ss, or h:mm:ss once the video runs past an hour. */
function fmtClock(s: number): string {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

const PlayIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M8 5v14l11-7z" />
  </svg>
);
const PauseIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="5" width="4" height="14" rx="1" />
    <rect x="14" y="5" width="4" height="14" rx="1" />
  </svg>
);
const FullscreenEnterIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3" />
  </svg>
);
const FullscreenExitIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 3v3a2 2 0 0 1-2 2H4M20 8h-3a2 2 0 0 1-2-2V3M15 21v-3a2 2 0 0 1 2-2h3M4 16h3a2 2 0 0 1 2 2v3" />
  </svg>
);
const PipIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="14" rx="1.5" />
    <rect x="12" y="11" width="8" height="6" rx="1" fill="currentColor" stroke="none" />
  </svg>
);

/** Adaptive HLS player with a custom RabbitHole control bar (native
 *  <video controls> pulls in Safari's own floating volume pill, which
 *  can't be styled). Uses native HLS on Safari, hls.js everywhere else.
 *  Auto-starts on mount (best-effort — browsers may block autoplay with
 *  sound). Optionally accepts an external `videoRef` (so a parent can
 *  seek the element) and a WebVTT `captionsSrc` for closed captions. */
export function Player({
  src,
  onEnded,
  videoRef: externalRef,
  captionsSrc,
  poster,
}: {
  src: string;
  onEnded?: () => void;
  videoRef?: RefObject<HTMLVideoElement>;
  captionsSrc?: string | null;
  poster?: string | null;
}) {
  const internalRef = useRef<HTMLVideoElement>(null);
  const videoRef = externalRef ?? internalRef;
  const wrapRef = useRef<HTMLDivElement>(null);

  // Safari's AVFoundation fetches HLS segments without an Origin header, so
  // CloudFront's CORS policy never fires and returns no ACAO header. Setting
  // crossOrigin="anonymous" on the video element then causes the browser's
  // CORS check to reject the 200 response (no ACAO = blocked). Workaround:
  // detect native HLS support, fetch captions via JS (which does send Origin
  // and gets ACAO:*), and hand a same-origin blob URL to the <track> element
  // so no crossOrigin attribute is needed on the <video>.
  const usesNativeHls = useRef(
    typeof document !== "undefined" &&
      document.createElement("video").canPlayType("application/vnd.apple.mpegurl") !== "",
  );
  const [captionsBlobUrl, setCaptionsBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!captionsSrc || !usesNativeHls.current) return;
    let blobUrl: string | null = null;
    fetch(captionsSrc)
      .then((r) => (r.ok ? r.blob() : Promise.reject()))
      .then((blob) => {
        blobUrl = URL.createObjectURL(blob);
        setCaptionsBlobUrl(blobUrl);
      })
      .catch(() => {});
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      setCaptionsBlobUrl(null);
    };
  }, [captionsSrc]);

  // ── Playback state, mirrored from the real <video> element ───────────
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(() => readStoredNumber(VOLUME_KEY, 1));
  const [muted, setMuted] = useState(() => readStoredBool(MUTED_KEY, false));
  const [captionsOn, setCaptionsOn] = useState(() => readStoredBool(CAPTIONS_KEY, true));
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [volumeUiSupported] = useState(volumeSliderSupported);
  const [pipSupported] = useState(
    () => typeof document !== "undefined" && "pictureInPictureEnabled" in document && document.pictureInPictureEnabled,
  );

  const scrubbingRef = useRef(false);
  const hideTimerRef = useRef<number>();
  const hoverRef = useRef(false);
  const focusWithinRef = useRef(false);

  function clearHideTimer() {
    window.clearTimeout(hideTimerRef.current);
  }

  function scheduleHide() {
    clearHideTimer();
    const v = videoRef.current;
    if (!v || v.paused) return; // never auto-hide while paused
    hideTimerRef.current = window.setTimeout(() => {
      const active = document.activeElement;
      const controls = wrapRef.current?.querySelector(".player-controls");
      if (controls && active && controls.contains(active)) {
        scheduleHide(); // a child control has focus -- don't hide under it
        return;
      }
      if (!hoverRef.current) setControlsVisible(false);
    }, HIDE_DELAY_MS);
  }

  function showControls() {
    setControlsVisible(true);
    scheduleHide();
  }

  useEffect(() => clearHideTimer, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const tryPlay = () => {
      video.play().catch(() => {
        /* autoplay blocked — user can press play */
      });
    };

    // Volume/mute is a per-video-element preference; re-apply on every new
    // source in case the underlying element resets it.
    video.volume = Math.min(1, Math.max(0, volume));
    video.muted = muted;

    if (usesNativeHls.current) {
      video.src = src;
      video.addEventListener("loadedmetadata", tryPlay, { once: true });
      return () => video.removeEventListener("loadedmetadata", tryPlay);
    }

    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, tryPlay);
      return () => hls.destroy();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }
    // volume/muted intentionally excluded: this effect re-runs on `src`
    // change, not on every volume tweak (that's handled by its own effect).
  }, [src, videoRef]);

  // ── Native <video> event wiring → React state ─────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onPlay = () => {
      setPlaying(true);
      scheduleHide();
    };
    const onPause = () => {
      setPlaying(false);
      clearHideTimer();
      setControlsVisible(true);
    };
    const onTimeUpdate = () => {
      if (!scrubbingRef.current) setCurrentTime(video.currentTime);
    };
    const onDuration = () => setDuration(Number.isFinite(video.duration) ? video.duration : 0);
    const onEndedInternal = () => {
      setPlaying(false);
      setControlsVisible(true);
      onEnded?.();
    };
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("loadedmetadata", onDuration);
    video.addEventListener("durationchange", onDuration);
    video.addEventListener("ended", onEndedInternal);
    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("loadedmetadata", onDuration);
      video.removeEventListener("durationchange", onDuration);
      video.removeEventListener("ended", onEndedInternal);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoRef, onEnded]);

  // ── Fullscreen state sync (handles Esc / browser chrome exit too) ─────
  useEffect(() => {
    function onFsChange() {
      const fsEl = document.fullscreenElement || (document as any).webkitFullscreenElement;
      setIsFullscreen(!!fsEl && fsEl === wrapRef.current);
    }
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("webkitfullscreenchange", onFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("webkitfullscreenchange", onFsChange);
    };
  }, []);

  // ── Captions: toggle the actual TextTrack + persist preference ────────
  const effectiveCaptionsSrc = usesNativeHls.current ? captionsBlobUrl : captionsSrc;
  const hasCaptions = !!effectiveCaptionsSrc;
  useEffect(() => {
    const video = videoRef.current;
    const track = video?.textTracks?.[0];
    if (!track) return;
    track.mode = captionsOn ? "showing" : "hidden";
  }, [captionsOn, effectiveCaptionsSrc, videoRef]);

  function toggleCaptions() {
    if (!hasCaptions) return;
    setCaptionsOn((on) => {
      const next = !on;
      writeStored(CAPTIONS_KEY, next ? "1" : "0");
      return next;
    });
    showControls();
  }

  // ── Actions ─────────────────────────────────────────────────────────
  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  }

  function seekBy(delta: number) {
    const v = videoRef.current;
    if (!v) return;
    const d = Number.isFinite(v.duration) ? v.duration : duration;
    v.currentTime = Math.min(Math.max(0, v.currentTime + delta), d || Infinity);
    setCurrentTime(v.currentTime);
    showControls();
  }

  function handleScrub(e: React.ChangeEvent<HTMLInputElement>) {
    const v = videoRef.current;
    const t = Number(e.target.value);
    setCurrentTime(t);
    if (v) v.currentTime = t;
  }

  function handleVolumeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = videoRef.current;
    const vol = Number(e.target.value);
    setVolume(vol);
    writeStored(VOLUME_KEY, String(vol));
    if (vol > 0 && muted) {
      setMuted(false);
      writeStored(MUTED_KEY, "0");
    }
    if (v) {
      v.volume = vol;
      v.muted = vol === 0 ? v.muted : false;
    }
    showControls();
  }

  function toggleMute() {
    const v = videoRef.current;
    setMuted((m) => {
      const next = !m;
      writeStored(MUTED_KEY, next ? "1" : "0");
      if (v) v.muted = next;
      return next;
    });
    showControls();
  }

  function toggleFullscreen() {
    const wrap = wrapRef.current as any;
    const video = videoRef.current as any;
    const fsEl = document.fullscreenElement || (document as any).webkitFullscreenElement;
    if (fsEl) {
      if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
      else if ((document as any).webkitExitFullscreen) (document as any).webkitExitFullscreen();
      return;
    }
    if (wrap?.requestFullscreen) wrap.requestFullscreen().catch(() => {});
    else if (wrap?.webkitRequestFullscreen) wrap.webkitRequestFullscreen();
    else if (video?.webkitEnterFullscreen) video.webkitEnterFullscreen(); // iOS native video fullscreen
    showControls();
  }

  async function togglePip() {
    const v = videoRef.current as any;
    if (!v) return;
    try {
      if (document.pictureInPictureElement) await (document as any).exitPictureInPicture();
      else if (v.requestPictureInPicture) await v.requestPictureInPicture();
    } catch {
      /* PiP can refuse (e.g. no user gesture context) -- not fatal */
    }
    showControls();
  }

  // ── Keyboard shortcuts, scoped to hover/focus over the player only ────
  useEffect(() => {
    function isTypingTarget(el: Element | null): boolean {
      if (!el) return false;
      const tag = el.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (el as HTMLElement).isContentEditable;
    }
    function onKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(document.activeElement)) return;
      if (!hoverRef.current && !focusWithinRef.current) return;
      const v = videoRef.current;
      if (!v) return;
      const key = e.key.toLowerCase();
      const isSpace = key === " " || key === "spacebar" || e.code === "Space";
      if (isSpace || key === "k") {
        e.preventDefault();
        togglePlay();
      } else if (key === "arrowleft") {
        e.preventDefault();
        seekBy(-5);
      } else if (key === "arrowright") {
        e.preventDefault();
        seekBy(5);
      } else if (key === "j") {
        seekBy(-15);
      } else if (key === "l") {
        seekBy(15);
      } else if (key === "m") {
        toggleMute();
      } else if (key === "c") {
        toggleCaptions();
      } else if (key === "f") {
        toggleFullscreen();
      } else {
        return;
      }
      showControls();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoRef, hasCaptions]);

  // ── Hover/focus/touch bookkeeping for auto-hide + shortcut scope ──────
  function handleMouseEnter() {
    hoverRef.current = true;
    showControls();
  }
  function handleMouseLeave() {
    hoverRef.current = false;
    scheduleHide();
  }
  function handleFocus() {
    focusWithinRef.current = true;
    showControls();
  }
  function handleBlur() {
    requestAnimationFrame(() => {
      if (wrapRef.current && !wrapRef.current.contains(document.activeElement)) {
        focusWithinRef.current = false;
      }
    });
  }
  const wasTouchRef = useRef(false);

  function handleTouchStart(e: React.TouchEvent) {
    wasTouchRef.current = true;
    if ((e.target as HTMLElement).closest(".player-controls")) return; // let the control handle its own tap
    setControlsVisible((v) => {
      const next = !v;
      if (next) scheduleHide();
      else clearHideTimer();
      return next;
    });
  }

  // Click the video itself (not a touch tap, which handleTouchStart already
  // handles as a show/hide) to toggle play/pause -- the conventional
  // click-the-video behavior that native <video controls> gave up when we
  // replaced it with the custom bar.
  function handleVideoClick() {
    if (wasTouchRef.current) {
      wasTouchRef.current = false; // this is the synthetic click after a tap
      return;
    }
    togglePlay();
    showControls();
  }

  const needsCrossOrigin = !usesNativeHls.current && !!captionsSrc;
  const pct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div
      ref={wrapRef}
      className={`player${controlsVisible ? "" : " controls-hidden"}${isFullscreen ? " is-fullscreen" : ""}`}
      onMouseEnter={handleMouseEnter}
      onMouseMove={showControls}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onTouchStart={handleTouchStart}
    >
      <video
        ref={videoRef}
        playsInline
        autoPlay
        poster={poster || undefined}
        crossOrigin={needsCrossOrigin ? "anonymous" : undefined}
        className="player-video"
        onEnded={onEnded}
        onClick={handleVideoClick}
      >
        {effectiveCaptionsSrc && (
          <track kind="captions" src={effectiveCaptionsSrc} srcLang="en" label="English" default />
        )}
      </video>

      <div className="player-controls">
        <input
          type="range"
          className="player-progress"
          min={0}
          max={duration || 0}
          step={0.1}
          value={Math.min(currentTime, duration || currentTime)}
          onChange={handleScrub}
          onPointerDown={() => {
            scrubbingRef.current = true;
            showControls();
          }}
          onPointerUp={() => {
            scrubbingRef.current = false;
          }}
          style={{ ["--player-progress-pct" as any]: `${pct}%` }}
          aria-label="Seek"
        />
        <div className="player-controls-row">
          <button type="button" className="player-btn" onClick={() => seekBy(-15)} aria-label="Back 15 seconds">
            −15
          </button>
          <button
            type="button"
            className="player-btn player-play"
            onClick={togglePlay}
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? <PauseIcon /> : <PlayIcon />}
          </button>
          <button type="button" className="player-btn" onClick={() => seekBy(15)} aria-label="Forward 15 seconds">
            +15
          </button>
          <span className="player-time">
            {fmtClock(currentTime)} / {fmtClock(duration)}
          </span>

          <span className="player-spacer" />

          <div className="player-volume">
            <button
              type="button"
              className="player-btn player-vol-btn"
              onClick={toggleMute}
              aria-label={muted ? "Unmute" : "Mute"}
              aria-pressed={muted}
            >
              {muted ? "Muted" : "Vol"}
            </button>
            {volumeUiSupported && (
              <input
                type="range"
                className="player-vol-slider"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                onChange={handleVolumeChange}
                aria-label="Volume"
              />
            )}
          </div>

          {hasCaptions && (
            <button
              type="button"
              className={captionsOn ? "player-btn player-cc on" : "player-btn player-cc"}
              onClick={toggleCaptions}
              aria-label={captionsOn ? "Turn captions off" : "Turn captions on"}
              aria-pressed={captionsOn}
            >
              CC
            </button>
          )}

          {pipSupported && (
            <button type="button" className="player-btn" onClick={togglePip} aria-label="Picture in picture">
              <PipIcon />
            </button>
          )}

          <button
            type="button"
            className="player-btn"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {isFullscreen ? <FullscreenExitIcon /> : <FullscreenEnterIcon />}
          </button>
        </div>
      </div>
    </div>
  );
}
