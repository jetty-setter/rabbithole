import Hls from "hls.js";
import { useEffect, useRef, useState, type RefObject } from "react";

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

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const tryPlay = () => {
      video.play().catch(() => {
        /* autoplay blocked — user can press play */
      });
    };

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
    }
  }, [src, videoRef]);

  // Safari gets the blob URL (no crossOrigin needed); hls.js browsers use crossOrigin="anonymous" + direct CDN URL.
  const effectiveCaptionsSrc = usesNativeHls.current ? captionsBlobUrl : captionsSrc;
  const needsCrossOrigin = !usesNativeHls.current && !!captionsSrc;

  return (
    <video
      ref={videoRef}
      controls
      playsInline
      autoPlay
      crossOrigin={needsCrossOrigin ? "anonymous" : undefined}
      className="player"
      onEnded={onEnded}
    >
      {effectiveCaptionsSrc && (
        <track kind="captions" src={effectiveCaptionsSrc} srcLang="en" label="English" default />
      )}
    </video>
  );
}
