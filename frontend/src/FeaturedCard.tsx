import { Link } from "react-router-dom";
import { displayTitle, formatDuration, relativeTime, type Video } from "./api";
import { Avatar } from "./Avatar";

/** Big editorial hero at the top of the feed — deliberately not a grid tile. */
export function FeaturedCard({ v }: { v: Video }) {
  return (
    <Link to={`/watch/${v.video_id}`} className="featured">
      <div className="featured-thumb">
        {v.thumbnail_url ? (
          <img src={v.thumbnail_url} alt="" />
        ) : (
          <img src="/RHRabbit.png?v=5" alt="" className="thumb-ph" />
        )}
        <div className="card-badges">
          {v.has_transcript && (
            <span className="mini-badge cc" title="Captions available">CC</span>
          )}
          {v.visibility === "unlisted" && (
            <span className="mini-badge" title="Unlisted — link only">Unlisted</span>
          )}
        </div>
        {v.duration_seconds && (
          <span className="dur-badge">{formatDuration(v.duration_seconds)}</span>
        )}
      </div>
      <div className="featured-info">
        <span className="featured-eyebrow">Featured</span>
        <h2 className="featured-title">{displayTitle(v)}</h2>
        {v.description && <p className="featured-desc">{v.description}</p>}
        <div className="featured-by">
          <Avatar name={v.owner || "RabbitHole"} />
          <span>
            {v.owner || "RabbitHole"} · {relativeTime(v.created_at) || "just now"}
          </span>
        </div>
      </div>
    </Link>
  );
}
