import { Link } from "react-router-dom";
import { displayTitle, type Video } from "./api";

export function VideoCard({ v }: { v: Video }) {
  return (
    <Link to={`/watch/${v.video_id}`} className="vcard">
      <div className="thumb">
        {v.thumbnail_url ? <img src={v.thumbnail_url} alt="" /> : <span className="thumb-ph">🐇</span>}
        <span className="play-badge">▶</span>
      </div>
      <div className="vcard-row">
        <span className="avatar">{(v.owner?.[0] || "R").toUpperCase()}</span>
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
