import Hls from "hls.js";
import { useEffect, useRef } from "react";

/** Adaptive HLS player. Uses native HLS on Safari, hls.js everywhere else. */
export function Player({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Safari / iOS play HLS natively.
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      return;
    }

    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(src);
      hls.attachMedia(video);
      return () => hls.destroy();
    }
  }, [src]);

  return <video ref={videoRef} controls playsInline className="player" />;
}
