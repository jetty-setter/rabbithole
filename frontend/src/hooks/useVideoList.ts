import { useState, useEffect, useCallback } from "react";
import { listVideos, type Video } from "../api";

export function useVideoList() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setVideos(await listVideos());
    } catch {
      /* keep last good list */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { videos, setVideos, loading, refresh };
}
