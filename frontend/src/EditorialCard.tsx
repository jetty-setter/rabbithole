import { Link } from "react-router-dom";
import { displayTitle, formatDuration, type Video } from "./api";

/** Premium, image-forward card for the homepage grid — category label, bold
 *  display title, play + duration. Deliberately minimal: no vote/save chrome
 *  on the face (that lives on the watch page), so the photography does the work. */
export function EditorialCard({ v }: { v: Video }) {
  const cat = v.tags?.[0];

  return (
    <Link to={`/watch/${v.video_id}`} className="ecard">
      <div className="ecard-thumb">
        {v.thumbnail_url ? (
          <img src={v.thumbnail_url} alt="" />
        ) : (
          <img src="/RHRabbit.png?v=5" alt="" className="thumb-ph" />
        )}
      </div>
      {cat && <span className="ecard-cat">{cat}</span>}
      <h3 className="ecard-title">{displayTitle(v)}</h3>
      <div className="ecard-meta">
        <span className="ecard-play" aria-hidden="true">
          <svg viewBox="0 0 10 10" fill="currentColor"><path d="M1 0l8 5-8 5z" /></svg>
        </span>
        {v.duration_seconds ? (
          <span className="ecard-dur">{formatDuration(v.duration_seconds)}</span>
        ) : (
          <span className="ecard-dur">{v.owner || "RabbitHole"}</span>
        )}
      </div>
    </Link>
  );
}
