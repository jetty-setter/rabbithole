import { useEffect, useMemo, useRef, useState } from "react";
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
    hopped,
    thumped,
    react,
    diveActive,
    diveDepth,
    startDive,
    stopDive,
    nextDive,
  } = useApp();

  const [video, setVideo] = useState<Video | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [burst, setBurst] = useState<{ kind: "hop" | "thump"; id: number } | null>(null);
  const burstTimer = useRef<number>();

  useEffect(() => () => window.clearTimeout(burstTimer.current), []);

  function fireBurst(kind: "hop" | "thump") {
    setBurst({ kind, id: Date.now() });
    window.clearTimeout(burstTimer.current);
    burstTimer.current = window.setTimeout(() => setBurst(null), 1100);
  }

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
          <h3>Lost down the hole</h3>
          <p className="muted">That video isn't here.</p>
          <Link to="/" className="btn-primary">
            Back to the surface
          </Link>
        </div>
      </main>
    );
  }
  if (!video) {
    return (
      <main className="page">
        <p className="muted">Digging it up…</p>
      </main>
    );
  }

  const vid = video.video_id;
  const canManage = isAdmin || (!!username && video.owner === username);
  const faved = favorites.has(vid);
  const isHopped = hopped.has(vid);
  const isThumped = thumped.has(vid);

  function onReact(kind: "hop" | "thump") {
    const wasHop = hopped.has(vid);
    const wasThump = thumped.has(vid);
    const next =
      kind === "hop" ? (wasHop ? null : "hop") : wasThump ? null : "thump";
    react(vid, kind);
    if (next === kind) fireBurst(kind);
    const dHop = (next === "hop" ? 1 : 0) - (wasHop ? 1 : 0);
    const dThump = (next === "thump" ? 1 : 0) - (wasThump ? 1 : 0);
    setVideo((v) =>
      v
        ? {
            ...v,
            hops: Math.max(0, (v.hops ?? 0) + dHop),
            thumps: Math.max(0, (v.thumps ?? 0) + dThump),
          }
        : v,
    );
  }

  function fallDeeper() {
    const n = nextDive(vid);
    if (n) navigate(`/watch/${n}`);
    else stopDive();
  }

  function beginDive() {
    startDive(vid);
    const n = nextDive(vid);
    if (n) navigate(`/watch/${n}`);
  }

  function onEnded() {
    if (diveActive) fallDeeper();
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
      {diveActive && (
        <div className="dive-hud">
          <span className="dive-depth">🕳️ You're {diveDepth} {diveDepth === 1 ? "hole" : "holes"} deep</span>
          <span className="dive-note">Auto-falling when this ends…</span>
          <div className="dive-hud-actions">
            <button className="dive-deeper" onClick={fallDeeper}>
              Deeper ▼
            </button>
            <button className="dive-surface" onClick={stopDive}>
              Surface ▲
            </button>
          </div>
        </div>
      )}

      <div className="watch-grid">
        <div className="watch-main">
          <div className="player-stage">
            {video.playback_url && (
              <div className={burst?.kind === "thump" ? "player-wrap shake" : "player-wrap"}>
                <Player src={video.playback_url} onEnded={onEnded} />
              </div>
            )}
            {burst && (
              <div className={`burst burst-${burst.kind}`} key={burst.id}>
                <span className="burst-mascot" />
              </div>
            )}
          </div>

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
                    <div className="vote">
                      <button
                        className={isHopped ? "vote-btn up on" : "vote-btn up"}
                        onClick={() => onReact("hop")}
                        title="Hop it up"
                        aria-label="Hop it up"
                      >
                        <svg
                          className="vote-ico"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M6 14l6-6 6 6" />
                        </svg>
                        <span className="vote-count">{video.hops ?? 0}</span>
                      </button>
                      <span className="vote-sep" />
                      <button
                        className={isThumped ? "vote-btn down on" : "vote-btn down"}
                        onClick={() => onReact("thump")}
                        title="Thump it down"
                        aria-label="Thump it down"
                      >
                        <svg
                          className="vote-ico"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M6 10l6 6 6-6" />
                        </svg>
                        <span className="vote-count">{video.thumps ?? 0}</span>
                      </button>
                    </div>
                    {authed && (
                      <button
                        className={faved ? "btn-ghost saved" : "btn-ghost"}
                        onClick={() => toggleFavorite(vid)}
                      >
                        {faved ? "✓ Stashed" : "Stash"}
                      </button>
                    )}
                    <button className="btn-ghost" onClick={copyLink}>
                      {copied ? "Copied ✓" : "Copy link"}
                    </button>
                    {canManage && (
                      <div className="owner-menu">
                        <button
                          className="btn-ghost kebab"
                          onClick={() => setMenuOpen((o) => !o)}
                          aria-label="More actions"
                        >
                          ⋯
                        </button>
                        {menuOpen && (
                          <>
                            <div className="menu-backdrop" onClick={() => setMenuOpen(false)} />
                            <div className="act-menu">
                              <button
                                className="menu-item"
                                onClick={() => {
                                  setMenuOpen(false);
                                  startEdit();
                                }}
                              >
                                Edit
                              </button>
                              <button
                                className="menu-item danger-text"
                                onClick={() => {
                                  setMenuOpen(false);
                                  remove();
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                {video.description && <p className="watch-desc">{video.description}</p>}
                {video.tags && video.tags.length > 0 && (
                  <div className="tag-row">
                    {video.tags.map((t) => (
                      <span className="tag" key={t}>
                        #{t}
                      </span>
                    ))}
                    {video.ai_generated && (
                      <span className="tag ai-tag" title="Title, description, and tags auto-generated by AI from a video frame">
                        ✦ auto
                      </span>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          <Comments videoId={vid} />
        </div>

        <aside className="watch-related">
          {diveActive ? (
            <button className="dive-cta diving" onClick={fallDeeper}>
              <span className="dive-cta-big">Keep falling ▼</span>
              <span className="dive-cta-sub">{diveDepth} {diveDepth === 1 ? "hole" : "holes"} deep</span>
            </button>
          ) : (
            <button className="dive-cta" onClick={beginDive}>
              <span className="dive-cta-big">▼ Down the rabbit hole</span>
              <span className="dive-cta-sub">Auto-play a never-ending descent</span>
            </button>
          )}

          <h3 className="related-head">Deeper</h3>
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
