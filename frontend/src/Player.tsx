import Hls from "hls.js";
import { useEffect, useRef } from "react";

/** Adaptive HLS player. Uses native HLS on Safari, hls.js everywhere else.
 *  Auto-starts on mount (best-effort — browsers may block autoplay with sound). */
export function Player({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

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
  }, [src]);

  return <video ref={videoRef} controls playsInline autoPlay className="player" />;
}
