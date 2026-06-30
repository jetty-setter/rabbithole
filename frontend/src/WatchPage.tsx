import { useMemo, useRef, useState, useEffect } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useApp } from "./App";
import {
  deleteVideo,
  displayTitle,
  formatDuration,
  relativeTime,
  updateVideo,
} from "./api";
import { Player } from "./Player";
import { SkeletonWatch } from "./Skeleton";
import { Comments } from "./Comments";
import { Avatar } from "./Avatar";
import { EditForm } from "./components/EditForm";
import { useVideoData } from "./hooks/useVideoData";
import { useTranscript } from "./hooks/useTranscript";

/** Seconds → m:ss for cue timestamps. */
function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function WatchPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const startAt = Number(searchParams.get("t") || 0);
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
    stopDive,
    nextDive,
    recordTrail,
  } = useApp();

  const videoRef = useRef<HTMLVideoElement>(null);
  const { video, setVideo, notFound } = useVideoData(id, recordTrail);
  const { cues, cuesRef, cueQuery, setCueQuery, activeCue, shownCues } = useTranscript(
    video,
    videoRef,
  );

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editVis, setEditVis] = useState<"public" | "unlisted">("public");
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

  // Deep-link from search → jump the player to ?t= once it has metadata.
  useEffect(() => {
    if (!startAt || !video) return;
    const v = videoRef.current;
    if (!v) return;
    const seek = () => {
      v.currentTime = startAt;
    };
    if (v.readyState >= 1) seek();
    else v.addEventListener("loadedmetadata", seek, { once: true });
    return () => v.removeEventListener("loadedmetadata", seek);
  }, [startAt, video]);

  const related = useMemo(
    () =>
      videos
        .filter((v) => v.status === "ready" && !!v.playback_url && v.video_id !== id)
        .slice(0, 12),
    [videos, id],
  );

  function seekTo(t: number) {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, t);
    v.play().catch(() => {});
  }

  function onReact(kind: "hop" | "thump") {
    if (!video) return;
    const vid = video.video_id;
    const wasHop = hopped.has(vid);
    const wasThump = thumped.has(vid);
    const next = kind === "hop" ? (wasHop ? null : "hop") : wasThump ? null : "thump";
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
    if (!video) return;
    const n = nextDive(video.video_id);
    if (n) navigate(`/watch/${n}`);
    else stopDive();
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
    setEditTags(video.tags || []);
    setEditVis(video.visibility === "unlisted" ? "unlisted" : "public");
    setEditing(true);
  }

  async function save() {
    if (!id) return;
    const updated = await updateVideo(id, {
      title,
      description: desc,
      tags: editTags,
      visibility: editVis,
    });
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
    return <SkeletonWatch />;
  }

  const vid = video.video_id;
  const canManage = isAdmin || (!!username && video.owner === username);
  const faved = favorites.has(vid);
  const isHopped = hopped.has(vid);
  const isThumped = thumped.has(vid);

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
                <Player
                  src={video.playback_url}
                  onEnded={onEnded}
                  videoRef={videoRef}
                  captionsSrc={video.captions_url}
                />
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
              <EditForm
                title={title}
                setTitle={setTitle}
                desc={desc}
                setDesc={setDesc}
                editTags={editTags}
                setEditTags={setEditTags}
                editVis={editVis}
                setEditVis={setEditVis}
                onSave={save}
                onCancel={() => setEditing(false)}
              />
            ) : (
              <>
                <h1 className="watch-title">
                  {displayTitle(video)}
                  {video.visibility === "unlisted" && (
                    <span className="unlisted-badge" title="Hidden from the feed — only people with the link can watch">
                      Unlisted
                    </span>
                  )}
                </h1>
                <div className="watch-sub">
                  <Avatar name={video.owner || "RabbitHole"} />
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

          {(video.has_transcript || video.transcribing) && (
            <section className="transcript">
              <div className="transcript-head">
                <h3 className="related-head">Transcript</h3>
                {cues.length > 0 && (
                  <input
                    className="transcript-search"
                    placeholder="Search this video…"
                    value={cueQuery}
                    onChange={(e) => setCueQuery(e.target.value)}
                  />
                )}
              </div>
              {video.transcribing && cues.length === 0 ? (
                <p className="muted transcript-note">
                  <span className="proc-spinner sm" /> Transcribing audio…
                </p>
              ) : cues.length === 0 ? (
                <p className="muted transcript-note">No speech detected in this clip.</p>
              ) : (
                <div className="transcript-cues" ref={cuesRef}>
                  {shownCues.length === 0 ? (
                    <p className="muted transcript-note">No lines match "{cueQuery}".</p>
                  ) : (
                    shownCues.map((c) => (
                      <button
                        key={c.i}
                        className={c.i === activeCue ? "cue active" : "cue"}
                        onClick={() => seekTo(c.start)}
                      >
                        <span className="cue-time">{fmtTime(c.start)}</span>
                        <span className="cue-text">{c.text}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </section>
          )}

          <Comments videoId={vid} />
        </div>

        <aside className="watch-related">
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
