import { useEffect, useRef, useState } from "react";
import { createUpload, listVideos, uploadToS3, WS_URL, type Video } from "./api";
import { Player } from "./Player";

const STATUS_LABEL: Record<string, string> = {
  pending_upload: "Awaiting upload",
  uploaded: "Uploaded",
  processing: "Transcoding",
  ready: "Ready",
  failed: "Failed",
};

export default function App() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [selected, setSelected] = useState<Video | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    try {
      setVideos(await listVideos());
    } catch {
      /* keep last good list on transient errors */
    }
  }

  // Initial load + slow poll as a fallback for the WebSocket.
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 15000);
    return () => clearInterval(t);
  }, []);

  // Real-time status: refresh immediately whenever the server pushes a change.
  useEffect(() => {
    if (!WS_URL) return;
    let ws: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout>;

    const connect = () => {
      ws = new WebSocket(WS_URL!);
      ws.onopen = () => setLive(true);
      ws.onmessage = () => refresh();
      ws.onclose = () => {
        setLive(false);
        retry = setTimeout(connect, 3000);
      };
      ws.onerror = () => ws?.close();
    };

    connect();
    return () => {
      clearTimeout(retry);
      ws?.close();
    };
  }, []);

  async function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Choose a video file first.");
      return;
    }
    setBusy(true);
    setError(null);
    setProgress(0);
    try {
      const ticket = await createUpload(file.name, file.type || "video/mp4");
      await uploadToS3(ticket.upload_url, file, setProgress);
      if (fileRef.current) fileRef.current.value = "";
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  const readyCount = videos.filter((v) => v.status === "ready").length;
  const totalCost = videos.reduce((sum, v) => sum + Number(v.cost_usd ?? 0), 0);

  return (
    <div className="wrap">
      <header className="head">
        <h1>🐇 RabbitHole</h1>
        <p>Upload a video — it's transcoded into adaptive HLS and streamed back.</p>
      </header>

      <section className="stats">
        <div className="stat">
          <span className="stat-num">{videos.length}</span>
          <span className="stat-label">Videos</span>
        </div>
        <div className="stat">
          <span className="stat-num">{readyCount}</span>
          <span className="stat-label">Ready</span>
        </div>
        <div className="stat">
          <span className="stat-num">${totalCost.toFixed(4)}</span>
          <span className="stat-label">Transcode cost</span>
        </div>
        <div className="stat">
          <span className={live ? "dot live" : "dot"} />
          <span className="stat-label">{live ? "Live" : "Polling"}</span>
        </div>
      </section>

      {selected?.playback_url && (
        <section className="card">
          <div className="player-head">
            <h2>{selected.filename}</h2>
            <button className="ghost" onClick={() => setSelected(null)}>
              Close
            </button>
          </div>
          <Player src={selected.playback_url} />
        </section>
      )}

      <section className="card uploader">
        <input ref={fileRef} type="file" accept="video/*" disabled={busy} />
        <button onClick={handleUpload} disabled={busy}>
          {busy ? "Uploading…" : "Upload"}
        </button>
        {progress !== null && (
          <div className="bar">
            <div className="fill" style={{ width: `${progress}%` }} />
          </div>
        )}
        {error && <p className="err">{error}</p>}
      </section>

      <section className="card">
        <h2>Library</h2>
        {videos.length === 0 ? (
          <p className="muted">No videos yet. Upload one above.</p>
        ) : (
          <ul className="list">
            {videos.map((v) => {
              const ready = v.status === "ready" && !!v.playback_url;
              return (
                <li
                  key={v.video_id}
                  className={ready ? "row clickable" : "row"}
                  onClick={() => ready && setSelected(v)}
                >
                  <div className="thumb">
                    {v.thumbnail_url ? (
                      <img src={v.thumbnail_url} alt="" />
                    ) : (
                      <span className="thumb-ph">🐇</span>
                    )}
                  </div>
                  <span className="name">{v.filename}</span>
                  {v.cost_usd && <span className="cost">${v.cost_usd}</span>}
                  <span className={`status s-${v.status}`}>
                    {STATUS_LABEL[v.status] ?? v.status}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
