import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useApp } from "./App";
import {
  deleteVideo,
  displayTitle,
  formatDuration,
  getVideo,
  incrementView,
  relativeTime,
  updateVideo,
  type Video,
} from "./api";
import { Player } from "./Player";
import { Comments } from "./Comments";

export function WatchPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    videos,
    authed,
    isAdmin,
    username,
    refresh,
    favorites,
    toggleFavorite,
    liked,
    toggleLike,
    requireLogin,
  } = useApp();

  const [video, setVideo] = useState<Video | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!id) return;
    setNotFound(false);
    getVideo(id)
      .then((v) => {
        setVideo(v);
        incrementView(id).catch(() => {});
      })
      .catch(() => setNotFound(true));
  }, [id]);

  const related = useMemo(
    () =>
      videos
        .filter((v) => v.status === "ready" && !!v.playback_url && v.video_id !== id)
        .slice(0, 12),
    [videos, id],
  );

  if (notFound) {
    return (
      <main className="page">
        <div className="empty">
          <h3>Video not found</h3>
          <Link to="/" className="btn-primary">
            Back to feed
          </Link>
        </div>
      </main>
    );
  }
  if (!video) {
    return (
      <main className="page">
        <p className="muted">Loading…</p>
      </main>
    );
  }

  const canManage = isAdmin || (!!username && video.owner === username);
  const faved = favorites.has(video.video_id);
  const isLiked = liked.has(video.video_id);

  function onLike() {
    if (!authed) return;
    const willLike = !liked.has(video!.video_id);
    toggleLike(video!.video_id);
    setVideo((v) => (v ? { ...v, likes: Math.max(0, (v.likes ?? 0) + (willLike ? 1 : -1)) } : v));
  }

  async function copyLink() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function startEdit() {
    if (!video) return;
    setTitle(displayTitle(video));
    setDesc(video.description || "");
    setEditing(true);
  }

  async function save() {
    if (!id) return;
    const updated = await updateVideo(id, { title, description: desc });
    setVideo(updated);
    setEditing(false);
    refresh();
  }

  async function remove() {
    if (!id) return;
    if (!confirm("Delete this video? This can't be undone.")) return;
    await deleteVideo(id);
    refresh();
    navigate("/");
  }

  return (
    <main className="page watch">
      <div className="watch-grid">
        <div className="watch-main">
          {video.playback_url && <Player src={video.playback_url} />}

          <div className="watch-meta">
            {editing ? (
              <div className="edit-form">
                <input
                  className="search wide"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Title"
                />
                <textarea
                  className="search wide ta"
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="Description"
                  rows={4}
                />
                <div className="row-gap">
                  <button className="btn-primary" onClick={save}>
                    Save
                  </button>
                  <button className="btn-ghost" onClick={() => setEditing(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h1 className="watch-title">{displayTitle(video)}</h1>
                <div className="watch-sub">
                  <span className="avatar">{(video.owner?.[0] || "R").toUpperCase()}</span>
                  <div className="watch-by">
                    <div className="watch-channel">{video.owner || "RabbitHole"}</div>
                    <div className="watch-stats">
                      {video.views ?? 0} views · {relativeTime(video.created_at)}
                    </div>
                  </div>
                  <div className="watch-actions">
                    <button
                      className={isLiked ? "btn-ghost liked" : "btn-ghost"}
                      onClick={authed ? onLike : requireLogin}
                      title={authed ? "Like this video" : "Sign in to like"}
                    >
                      {isLiked ? "♥" : "♡"} {video.likes ?? 0}
                    </button>
                    {authed && (
                      <button
                        className={faved ? "btn-ghost saved" : "btn-ghost"}
                        onClick={() => toggleFavorite(video.video_id)}
                      >
                        {faved ? "♥ Saved" : "♡ Save"}
                      </button>
                    )}
                    <button className="btn-ghost" onClick={copyLink}>
                      {copied ? "Copied ✓" : "Copy link"}
                    </button>
                    {canManage && (
                      <button className="btn-ghost" onClick={startEdit}>
                        Edit
                      </button>
                    )}
                    {canManage && (
                      <button className="btn-ghost danger-text" onClick={remove}>
                        Delete
                      </button>
                    )}
                  </div>
                </div>
                {video.description && <p className="watch-desc">{video.description}</p>}
              </>
            )}
          </div>

          <Comments videoId={video.video_id} />
        </div>

        <aside className="watch-related">
          <h3 className="related-head">Up next</h3>
          {related.map((r) => (
            <Link to={`/watch/${r.video_id}`} className="related-item" key={r.video_id}>
              <div className="related-thumb">
                {r.thumbnail_url ? <img src={r.thumbnail_url} alt="" /> : <span>🐇</span>}
                {r.duration_seconds && (
                  <span className="dur-badge">{formatDuration(r.duration_seconds)}</span>
                )}
              </div>
              <div className="related-info">
                <span className="related-title">{displayTitle(r)}</span>
                <span className="related-meta">{r.owner || "RabbitHole"}</span>
                <span className="related-meta">
                  {r.views ?? 0} views · {relativeTime(r.created_at)}
                </span>
              </div>
            </Link>
          ))}
        </aside>
      </div>
    </main>
  );
}
