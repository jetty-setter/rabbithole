import { Link } from "react-router-dom";
import { displayTitle, formatDuration, relativeTime, type Video } from "./api";
import { useApp } from "./App";
import { UpIcon, DownIcon } from "./Icons";
import { Avatar } from "./Avatar";

const PROC_LABEL: Record<string, string> = {
  pending_upload: "Queued…",
  uploaded: "Queued…",
  processing: "Transcoding…",
  failed: "Failed",
};

export function VideoCard({ v }: { v: Video }) {
  const { authed, favorites, toggleFavorite } = useApp();
  const ready = v.status === "ready" && !!v.playback_url;

  if (!ready) {
    const failed = v.status === "failed";
    return (
      <div className={failed ? "vcard processing failed" : "vcard processing"}>
        <div className="thumb proc">
          {failed ? <span className="proc-x">✕</span> : <span className="proc-spinner" />}
          <span className="proc-label">{PROC_LABEL[v.status] ?? "Processing…"}</span>
        </div>
        <div className="vcard-row">
          <Avatar name={v.owner || "RabbitHole"} />
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
    <div className="vcard">
      <Link to={`/watch/${v.video_id}`} className="vcard-stretch-link" aria-label={displayTitle(v)} />
      <div className="thumb">
        {v.thumbnail_url ? (
          <img src={v.thumbnail_url} alt="" />
        ) : (
          <img src="/RHRabbit.png?v=5" alt="" className="thumb-ph" />
        )}
        <span className="play-badge">▶</span>
        <div className="card-badges">
          {v.has_transcript && (
            <span className="mini-badge cc" title="Captions available">CC</span>
          )}
          {v.visibility === "unlisted" && (
            <span className="mini-badge" title="Unlisted — link only">Unlisted</span>
          )}
        </div>
        {v.duration_seconds && <span className="dur-badge">{formatDuration(v.duration_seconds)}</span>}
        {authed && (
          <button
            className={faved ? "fav-btn on" : "fav-btn"}
            title={faved ? "Remove from favorites" : "Save to favorites"}
            onClick={() => toggleFavorite(v.video_id)}
          >
            {faved ? "♥" : "♡"}
          </button>
        )}
      </div>
      <div className="vcard-row">
        <Avatar name={v.owner || "RabbitHole"} />
        <div className="vcard-info">
          <span className="vtitle">{displayTitle(v)}</span>
          <Link
            to={`/creator/${encodeURIComponent(v.owner || "RabbitHole")}`}
            className="vchannel vchannel-link"
          >
            {v.owner || "RabbitHole"}
          </Link>
          <span className="vmeta">
            {v.views ?? 0} views
            {v.hops ? (
              <>
                {" · "}
                <UpIcon className="meta-ico" />
                {v.hops}
              </>
            ) : null}
            {v.thumps ? (
              <>
                {" · "}
                <DownIcon className="meta-ico" />
                {v.thumps}
              </>
            ) : null}
            {relativeTime(v.created_at) ? ` · ${relativeTime(v.created_at)}` : ""}
          </span>
        </div>
      </div>
    </div>
  );
}
