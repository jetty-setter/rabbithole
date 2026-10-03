import { useState, useEffect, useCallback } from "react";
import { listVideos, type Video } from "../api";

export function useVideoList() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setVideos(await listVideos());
      setError(false);
    } catch {
      setError(true); // Preserve the last good list while exposing the failed refresh.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { videos, setVideos, loading, refresh, error };
}
