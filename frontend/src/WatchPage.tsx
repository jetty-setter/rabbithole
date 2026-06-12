import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useApp } from "./App";
import {
  deleteVideo,
  displayTitle,
  fetchCues,
  formatDuration,
  getVideo,
  incrementView,
  relativeTime,
  updateVideo,
  type Cue,
  type Video,
} from "./api";
import { Player } from "./Player";
import { Comments } from "./Comments";
import { TagEditor } from "./TagEditor";
import { Avatar } from "./Avatar";

/** Seconds → m:ss for cue timestamps. */
function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

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
    stopDive,
    nextDive,
  } = useApp();

  const [video, setVideo] = useState<Video | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editVis, setEditVis] = useState<"public" | "unlisted">("public");
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [burst, setBurst] = useState<{ kind: "hop" | "thump"; id: number } | null>(null);
  const burstTimer = useRef<number>();

  // Transcript: the <video> element (so cues can seek it), the cues themselves,
  // an in-video search box, and the cue currently playing.
  const videoRef = useRef<HTMLVideoElement>(null);
  const cuesRef = useRef<HTMLDivElement>(null);
  const [cues, setCues] = useState<Cue[]>([]);
  const [cueQuery, setCueQuery] = useState("");
  const [activeCue, setActiveCue] = useState(-1);

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

  // Pull the caption cues once the video record says it has a transcript.
  useEffect(() => {
    setCues([]);
    setCueQuery("");
    setActiveCue(-1);
    if (video?.has_transcript && video.transcript_url) {
      fetchCues(video.transcript_url).then(setCues);
    }
  }, [video?.video_id, video?.has_transcript, video?.transcript_url]);

  // Follow playback: highlight the cue currently being spoken.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || cues.length === 0) return;
    const onTime = () => {
      const t = v.currentTime;
      let idx = -1;
      for (let i = 0; i < cues.length; i++) {
        if (cues[i].start <= t + 0.15) idx = i;
        else break;
      }
      setActiveCue(idx);
    };
    v.addEventListener("timeupdate", onTime);
    return () => v.removeEventListener("timeupdate", onTime);
  }, [cues]);

  // Keep the active line in view (but don't fight the user while they search).
  useEffect(() => {
    if (cueQuery || activeCue < 0 || !cuesRef.current) return;
    const el = cuesRef.current.querySelector(".cue.active") as HTMLElement | null;
    el?.scrollIntoView({ block: "nearest" });
  }, [activeCue, cueQuery]);

  const shownCues = useMemo(() => {
    const q = cueQuery.trim().toLowerCase();
    return cues
      .map((c, i) => ({ ...c, i }))
      .filter((c) => !q || c.text.toLowerCase().includes(q));
  }, [cues, cueQuery]);

  function seekTo(t: number) {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, t);
    v.play().catch(() => {});
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
                <TagEditor tags={editTags} setTags={setEditTags} />
                <div className="vis-row">
                  <div className="vis-toggle">
                    <button
                      type="button"
                      className={editVis === "public" ? "vis-opt active" : "vis-opt"}
                      onClick={() => setEditVis("public")}
                    >
                      Public
                    </button>
                    <button
                      type="button"
                      className={editVis === "unlisted" ? "vis-opt active" : "vis-opt"}
                      onClick={() => setEditVis("unlisted")}
                    >
                      Unlisted
                    </button>
                  </div>
                  <span className="vis-hint">
                    {editVis === "public"
                      ? "Shows up in the feed and search."
                      : "Hidden from the feed — only people with the link can watch."}
                  </span>
                </div>
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
                    <p className="muted transcript-note">No lines match “{cueQuery}”.</p>
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
