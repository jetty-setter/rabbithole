import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getCreator, relativeTime, type Creator } from "./api";
import { Avatar } from "./Avatar";
import { VideoCard } from "./VideoCard";

/** A creator's public profile — their videos, aggregate stats, and an
 *  "expertise" topic list built from the tags across their own videos. */
export function CreatorPage() {
  const { username } = useParams();
  const [creator, setCreator] = useState<Creator | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    setCreator(null);
    setNotFound(false);
    if (!username) return;
    let live = true;
    getCreator(username).then((c) => {
      if (!live) return;
      if (c) setCreator(c);
      else setNotFound(true);
    });
    return () => {
      live = false;
    };
  }, [username]);

  if (notFound) {
    return (
      <main className="page">
        <div className="empty">
          <h3>No creator here</h3>
          <p className="muted">Nobody by that name has posted anything public.</p>
          <Link to="/" className="btn-primary">
            Back to the surface
          </Link>
        </div>
      </main>
    );
  }

  if (!creator) {
    return (
      <main className="page">
        <p className="muted transcript-note">
          <span className="proc-spinner sm" /> Loading profile…
        </p>
      </main>
    );
  }

  const joined = relativeTime(creator.joined);

  return (
    <main className="page">
      <div className="creator-head">
        <Avatar name={creator.username} className="lg" />
        <div className="creator-id">
          <h1>{creator.username}</h1>
          {joined && <p className="muted">Joined {joined}</p>}
        </div>
      </div>

      <div className="creator-stats">
        <div className="creator-stat">
          <span className="creator-stat-n">{creator.video_count}</span>
          <span className="creator-stat-label">video{creator.video_count === 1 ? "" : "s"}</span>
        </div>
        <div className="creator-stat">
          <span className="creator-stat-n">{creator.total_views}</span>
          <span className="creator-stat-label">views</span>
        </div>
        <div className="creator-stat">
          <span className="creator-stat-n">{creator.total_hops}</span>
          <span className="creator-stat-label">hops</span>
        </div>
      </div>

      {creator.topics.length > 0 && (
        <div className="creator-topics">
          <h3 className="related-head">Knows about</h3>
          <div className="tunnel-cloud">
            {creator.topics.map((t) => (
              <Link key={t.tag} to={`/tunnels/${encodeURIComponent(t.tag)}`} className="tunnel-chip">
                <span className="tunnel-tag">#{t.tag}</span>
                <span className="tunnel-count">{t.count}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <h3 className="related-head creator-videos-head">Videos</h3>
      {creator.videos.length === 0 ? (
        <div className="empty">
          <p>Nothing public yet.</p>
        </div>
      ) : (
        <div className="grid">
          {creator.videos.map((v) => (
            <VideoCard key={v.video_id} v={v} />
          ))}
        </div>
      )}
    </main>
  );
}
