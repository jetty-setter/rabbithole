import { useEffect, useRef } from "react";

/**
 * Inline player for embeddable External content (YouTube today).
 *
 * Uses YouTube's *official* IFrame Player API — the only clean way to drive
 * play/seek from a transcript cue or a search deep-link. No provider media
 * is downloaded, cached, or rehosted: this is YouTube's own privacy-enhanced
 * (`youtube-nocookie.com`) player. If the API script can't load, it falls
 * back to a plain nocookie <iframe> that still honours a `?t=` start time.
 */

interface YTPlayer {
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  playVideo(): void;
  destroy(): void;
}
interface YTNamespace {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId: string;
      host?: string;
      playerVars?: Record<string, string | number>;
      events?: { onReady?: () => void };
    },
  ) => YTPlayer;
}
declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const API_SRC = "https://www.youtube.com/iframe_api";
const readyWaiters: Array<() => void> = [];

/** Load the IFrame API once for the whole app; resolve when `window.YT` is usable. */
function loadYouTubeApi(): Promise<YTNamespace | null> {
  return new Promise((resolve) => {
    if (window.YT?.Player) return resolve(window.YT);
    readyWaiters.push(() => resolve(window.YT ?? null));
    if (document.querySelector(`script[src="${API_SRC}"]`)) return;
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      readyWaiters.splice(0).forEach((fn) => fn());
    };
    const s = document.createElement("script");
    s.src = API_SRC;
    s.async = true;
    s.onerror = () => readyWaiters.splice(0).forEach((fn) => fn());
    document.head.appendChild(s);
  });
}

export function EmbedPlayer({
  videoId,
  embedUrl,
  title,
  startAt = 0,
  registerSeek,
}: {
  /** YouTube video id — preferred; drives the official player. */
  videoId?: string | null;
  /** Provider embed URL — the fallback <iframe> src. */
  embedUrl: string;
  title: string;
  startAt?: number;
  registerSeek?: (fn: ((seconds: number) => void) | null) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    let player: YTPlayer | null = null;
    let cancelled = false;

    if (videoId) {
      loadYouTubeApi().then((YT) => {
        if (cancelled || !YT || !hostRef.current) return;
        player = new YT.Player(hostRef.current, {
          videoId,
          host: "https://www.youtube-nocookie.com",
          playerVars: {
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
            start: Math.floor(startAt) || 0,
          },
          events: {
            onReady: () => {
              if (startAt > 0) player?.seekTo(startAt, true);
            },
          },
        });
        registerSeek?.((seconds: number) => {
          player?.seekTo(Math.max(0, seconds), true);
          player?.playVideo();
        });
      });
    } else {
      // Fallback: raw iframe. Deep-link start works; runtime seeking doesn't.
      registerSeek?.(null);
    }

    return () => {
      cancelled = true;
      registerSeek?.(null);
      try {
        player?.destroy();
      } catch {
        /* player may already be gone */
      }
    };
  }, [videoId, startAt, registerSeek]);

  const fallbackSrc = startAt > 0 ? `${embedUrl}&start=${Math.floor(startAt)}` : embedUrl;

  return (
    <div className="player-wrap embed-player">
      {videoId ? (
        <div ref={hostRef} className="embed-player-host" />
      ) : (
        <iframe
          ref={iframeRef}
          src={fallbackSrc}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      )}
    </div>
  );
}
