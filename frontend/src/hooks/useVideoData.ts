import { useState, useEffect } from "react";
import { getVideo, incrementView, type Video } from "../api";

export function useVideoData(id: string | undefined, recordTrail: (id: string) => void) {
  const [video, setVideo] = useState<Video | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    setNotFound(false);
    setVideo(null);
    getVideo(id)
      .then((v) => {
        setVideo(v);
        incrementView(id).catch(() => {});
        recordTrail(id);
      })
      .catch(() => setNotFound(true));
  }, [id]);

  return { video, setVideo, notFound };
}
