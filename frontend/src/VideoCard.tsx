import { Link } from "react-router-dom";
import { displayTitle, type Video } from "./api";

const PROC_LABEL: Record<string, string> = {
  pending_upload: "Queued…",
  uploaded: "Queued…",
  processing: "Transcoding…",
  failed: "Failed",
};

export function VideoCard({ v }: { v: Video }) {
  const ready = v.status === "ready" && !!v.playback_url;
  const initial = (v.owner?.[0] || "R").toUpperCase();

  // Not ready yet — show a live processing card (only the owner sees these).
  if (!ready) {
    const failed = v.status === "failed";
    return (
      <div className={failed ? "vcard processing failed" : "vcard processing"}>
        <div className="thumb proc">
          {failed ? <span className="proc-x">✕</span> : <span className="proc-spinner" />}
          <span className="proc-label">{PROC_LABEL[v.status] ?? "Processing…"}</span>
        </div>
        <div className="vcard-row">
          <span className="avatar">{initial}</span>
          <div className="vcard-info">
            <span className="vtitle">{displayTitle(v)}</span>
            <span className="vchannel">{v.owner || "RabbitHole"}</span>
            <span className="vmeta">
              {failed ? "Transcode failed" : "Processing — updates automatically"}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Link to={`/watch/${v.video_id}`} className="vcard">
      <div className="thumb">
        {v.thumbnail_url ? <img src={v.thumbnail_url} alt="" /> : <span className="thumb-ph">🐇</span>}
        <span className="play-badge">▶</span>
      </div>
      <div className="vcard-row">
        <span className="avatar">{initial}</span>
        <div className="vcard-info">
          <span className="vtitle">{displayTitle(v)}</span>
          <span className="vchannel">{v.owner || "RabbitHole"}</span>
          <span className="vmeta">
            {v.views ?? 0} views
            {v.duration_seconds ? ` · ${v.duration_seconds}s` : ""}
          </span>
        </div>
      </div>
    </Link>
  );
}
