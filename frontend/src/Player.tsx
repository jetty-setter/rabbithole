import Hls from "hls.js";
import { useEffect, useRef, type RefObject } from "react";

/** Adaptive HLS player. Uses native HLS on Safari, hls.js everywhere else.
 *  Auto-starts on mount (best-effort — browsers may block autoplay with sound).
 *  Optionally accepts an external `videoRef` (so a parent can seek the element)
 *  and a WebVTT `captionsSrc` for closed captions. */
export function Player({
  src,
  onEnded,
  videoRef: externalRef,
  captionsSrc,
}: {
  src: string;
  onEnded?: () => void;
  videoRef?: RefObject<HTMLVideoElement>;
  captionsSrc?: string | null;
}) {
  const internalRef = useRef<HTMLVideoElement>(null);
  const videoRef = externalRef ?? internalRef;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const tryPlay = () => {
      video.play().catch(() => {
        /* autoplay blocked — user can press play */
      });
    };

    // Safari / iOS play HLS natively.
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
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
    }
  }, [src, videoRef]);

  return (
    <video
      ref={videoRef}
      controls
      playsInline
      autoPlay
      // Only opt into anonymous CORS when we actually have a caption track to
      // load. Setting it unconditionally can break native-HLS playback (Safari),
      // so videos without captions behave exactly as before.
      crossOrigin={captionsSrc ? "anonymous" : undefined}
      className="player"
      onEnded={onEnded}
    >
      {captionsSrc && (
        <track kind="captions" src={captionsSrc} srcLang="en" label="English" default />
      )}
    </video>
  );
}
