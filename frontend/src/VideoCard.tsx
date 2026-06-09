import { Link } from "react-router-dom";
import { displayTitle, formatDuration, relativeTime, type Video } from "./api";
import { useApp } from "./App";

const PROC_LABEL: Record<string, string> = {
  pending_upload: "Queued…",
  uploaded: "Queued…",
  processing: "Transcoding…",
  failed: "Failed",
};

export function VideoCard({ v }: { v: Video }) {
  const { authed, favorites, toggleFavorite } = useApp();
  const ready = v.status === "ready" && !!v.playback_url;
  const initial = (v.owner?.[0] || "R").toUpperCase();

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

  const faved = favorites.has(v.video_id);

  return (
    <Link to={`/watch/${v.video_id}`} className="vcard">
      <div className="thumb">
        {v.thumbnail_url ? <img src={v.thumbnail_url} alt="" /> : <span className="thumb-ph">🐇</span>}
        <span className="play-badge">▶</span>
        {v.duration_seconds && <span className="dur-badge">{formatDuration(v.duration_seconds)}</span>}
        {authed && (
          <button
            className={faved ? "fav-btn on" : "fav-btn"}
            title={faved ? "Remove from favorites" : "Save to favorites"}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleFavorite(v.video_id);
            }}
          >
            {faved ? "♥" : "♡"}
          </button>
        )}
      </div>
      <div className="vcard-row">
        <span className="avatar">{initial}</span>
        <div className="vcard-info">
          <span className="vtitle">{displayTitle(v)}</span>
          <span className="vchannel">{v.owner || "RabbitHole"}</span>
          <span className="vmeta">
            {v.views ?? 0} views
            {v.likes ? ` · ♥ ${v.likes}` : ""}
            {relativeTime(v.created_at) ? ` · ${relativeTime(v.created_at)}` : ""}
          </span>
        </div>
      </div>
    </Link>
  );
}
