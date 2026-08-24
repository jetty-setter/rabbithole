import { useState, useEffect, useRef, useMemo } from "react";
import { fetchCues, type Cue, type Video } from "../api";
import { activeCueIndex } from "../cues";

export function useTranscript(video: Video | null, videoRef: React.RefObject<HTMLVideoElement>) {
  const cuesRef = useRef<HTMLDivElement>(null);
  const [cues, setCues] = useState<Cue[]>([]);
  const [cueQuery, setCueQuery] = useState("");
  const [activeCue, setActiveCue] = useState(-1);

  useEffect(() => {
    setCues([]);
    setCueQuery("");
    setActiveCue(-1);
    if (video?.has_transcript && video.transcript_url) {
      fetchCues(video.transcript_url).then(setCues);
    }
  }, [video?.video_id, video?.has_transcript, video?.transcript_url]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || cues.length === 0) return;
    const onTime = () => setActiveCue(activeCueIndex(cues, v.currentTime));
    v.addEventListener("timeupdate", onTime);
    return () => v.removeEventListener("timeupdate", onTime);
  }, [cues, videoRef]);

  // Don't scroll while the user is searching — that would fight their input.
  useEffect(() => {
    if (cueQuery || activeCue < 0 || !cuesRef.current) return;
    const el = cuesRef.current.querySelector(".cue.active") as HTMLElement | null;
    el?.scrollIntoView({ block: "nearest" });
  }, [activeCue, cueQuery]);

  const shownCues = useMemo(() => {
    const q = cueQuery.trim().toLowerCase();
    return cues
      .map((c, i) => ({ ...c, i }))
      .filter((c) => !q || c.text.toLowerCase().includes(q));
  }, [cues, cueQuery]);

  return { cues, cuesRef, cueQuery, setCueQuery, activeCue, shownCues };
}
