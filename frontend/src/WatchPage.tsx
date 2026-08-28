import { useMemo, useRef, useState, useEffect, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useApp } from "./App";
import {
  askVideo,
  deleteVideo,
  displayTitle,
  formatDuration,
  relativeTime,
  searchMoments,
  transcriptSectionState,
  updateVideo,
  type AskAnswer,
  type SearchMoment,
} from "./api";
import { Player } from "./Player";
import { SkeletonWatch } from "./Skeleton";
import { Comments } from "./Comments";
import { Avatar } from "./Avatar";
import { EditForm } from "./components/EditForm";
import { useVideoData } from "./hooks/useVideoData";
import { useDocumentMeta } from "./hooks/useDocumentMeta";
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
    recordTrail,
  } = useApp();

  const videoRef = useRef<HTMLVideoElement>(null);
  const { video, setVideo, notFound } = useVideoData(id, recordTrail);
  useDocumentMeta(video ? displayTitle(video) : undefined, video?.description ?? undefined);
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

  // RELATED — semantically connected moments in OTHER videos. Seeded by this
  // video's own transcript content (what it's actually about), not just its
  // title, whenever a transcript is available. Reuses the same cross-video
  // search endpoint the Search page uses; no separate topic/relation model
  // needed. Falls back to the plain video list (via `related` below) when
  // there's no transcript yet or the search turns up nothing useful.
  const [deeperMoments, setDeeperMoments] = useState<SearchMoment[] | null>(null);
  useEffect(() => {
    setDeeperMoments(null);
    if (!video || !video.has_transcript) return;
    // Wait for the transcript to finish loading so the seed reflects real
    // cue text; this effect re-fires once `cues` populates.
    if (cues.length === 0) return;
    const seed = cues.map((c) => c.text).join(" ").trim().slice(0, 1000) || displayTitle(video);
    let live = true;
    searchMoments(seed).then((results) => {
      if (!live) return;
      setDeeperMoments(
        results.filter(
          (r) =>
            r.video.video_id !== video.video_id &&
            r.video.status === "ready" &&
            !!r.video.playback_url,
        ),
      );
    });
    return () => {
      live = false;
    };
  }, [video?.video_id, video?.has_transcript, cues]);

  useEffect(() => {
    setAskQuestion("");
    setAskAnswer(null);
    setAskError(null);
  }, [video?.video_id]);

  // Right rail: RELATED / TRANSCRIPT tabs. Mode is intentionally NOT reset
  // per video -- it's meant to persist across in-app navigation for the
  // rest of the session (a plain useState does that for free, since
  // WatchPage stays mounted across :id changes; nothing is persisted to
  // storage, so it's back to "related" on a fresh page load).
  const [railMode, setRailMode] = useState<"related" | "transcript">("related");

  // Rail transcript: synchronized, auto-following cue list with a manual-
  // scroll override so reading doesn't get yanked around. Reuses the same
  // cues/activeCue/seekTo the main-page transcript section already uses --
  // no second transcript fetch, no separate search state.
  const [followPlayback, setFollowPlayback] = useState(true);
  const railCuesRef = useRef<HTMLDivElement>(null);
  const railAutoScrollRef = useRef(false);
  const railScrollGenRef = useRef(0);

  useEffect(() => {
    setFollowPlayback(true);
  }, [video?.video_id]);

  useEffect(() => () => {
    railScrollGenRef.current++; // cancel any in-flight animation on unmount
  }, []);

  // A restrained, self-driven "nearest edge" smooth scroll -- deliberately
  // NOT the browser's native scrollIntoView({behavior:"smooth"}). That
  // relies on the browser's own animation timing, which we can't observe
  // precisely: a fixed guard window long enough for a one-line follow falls
  // short on a big jump (a distant seek, a deep link) where the animation
  // is still mid-flight when the guard clears, and the tail end of our OWN
  // scroll then reads as a user scroll and wrongly suspends follow. Driving
  // scrollTop ourselves with rAF gives a duration we actually know, so the
  // guard can clear at the exact right moment every time.
  function animateRailScroll(container: HTMLElement, delta: number, duration = 320): Promise<void> {
    const gen = ++railScrollGenRef.current;
    const startTop = container.scrollTop;
    return new Promise((resolve) => {
      const start = performance.now();
      function step(now: number) {
        if (railScrollGenRef.current !== gen) {
          resolve(); // superseded by a newer scroll or an unmount
          return;
        }
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3); // ease-out
        container.scrollTop = startTop + delta * eased;
        if (t < 1) requestAnimationFrame(step);
        else resolve();
      }
      requestAnimationFrame(step);
    });
  }

  // Auto-follow: keep the active cue comfortably in view while playing,
  // unless the user is searching or has manually scrolled away from it.
  useEffect(() => {
    if (railMode !== "transcript" || !followPlayback || cueQuery.trim() || activeCue < 0) return;
    const container = railCuesRef.current;
    const target = container?.querySelector(".cue.active") as HTMLElement | null;
    if (!container || !target) return;
    const cr = container.getBoundingClientRect();
    const tr = target.getBoundingClientRect();
    const margin = 8;
    let delta = 0;
    if (tr.top < cr.top + margin) delta = tr.top - cr.top - margin;
    else if (tr.bottom > cr.bottom - margin) delta = tr.bottom - cr.bottom + margin;
    if (delta === 0) return; // already comfortably in view
    railAutoScrollRef.current = true;
    animateRailScroll(container, delta).then(() => {
      railAutoScrollRef.current = false;
    });
  }, [activeCue, cueQuery, followPlayback, railMode]);

  // A scroll we didn't cause ourselves means the user is browsing -- suspend
  // auto-follow until they explicitly ask to resume.
  function handleRailScroll() {
    if (railAutoScrollRef.current) return;
    if (followPlayback) setFollowPlayback(false);
  }

  function seekFromRail(t: number) {
    seekTo(t);
    setFollowPlayback(true);
  }

  // "Ask this video" — RAG Q&A grounded only in this video's own transcript.
  const [askQuestion, setAskQuestion] = useState("");
  const [askAnswer, setAskAnswer] = useState<AskAnswer | null>(null);
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);

  async function submitAsk(e: FormEvent) {
    e.preventDefault();
    if (!video || !askQuestion.trim() || asking) return;
    setAsking(true);
    setAskError(null);
    setAskAnswer(null);
    try {
      setAskAnswer(await askVideo(video.video_id, askQuestion.trim()));
    } catch (err) {
      setAskError(err instanceof Error ? err.message : "Couldn't get an answer.");
    } finally {
      setAsking(false);
    }
  }

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
  const transcriptState = transcriptSectionState(video);

  return (
    <main className="page watch">
      <div className="watch-grid">
        <div className="watch-main">
          <div className="player-stage">
            {video.playback_url && (
              <div className="player-wrap">
                <Player
                  src={video.playback_url}
                  videoRef={videoRef}
                  captionsSrc={video.captions_url}
                  poster={video.thumbnail_url}
                />
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
                    <Link
                      to={`/creator/${encodeURIComponent(video.owner || "RabbitHole")}`}
                      className="watch-channel"
                    >
                      {video.owner || "RabbitHole"}
                    </Link>
                    <div className="watch-stats">
                      {video.views ?? 0} views · {relativeTime(video.created_at)}
                    </div>
                  </div>
                  <div className="watch-actions">
                    <div className="vote">
                      <button
                        className={isHopped ? "vote-btn yay on" : "vote-btn yay"}
                        onClick={() => onReact("hop")}
                        aria-label="Yay"
                        aria-pressed={isHopped}
                      >
                        <span className="vote-label">Yay</span>
                        <span className="vote-count">{video.hops ?? 0}</span>
                      </button>
                      <span className="vote-sep" />
                      <button
                        className={isThumped ? "vote-btn nay on" : "vote-btn nay"}
                        onClick={() => onReact("thump")}
                        aria-label="Nay"
                        aria-pressed={isThumped}
                      >
                        <span className="vote-label">Nay</span>
                        <span className="vote-count">{video.thumps ?? 0}</span>
                      </button>
                    </div>
                    {authed && (
                      <button
                        className={faved ? "btn-ghost saved" : "btn-ghost"}
                        onClick={() => toggleFavorite(vid)}
                      >
                        {faved ? "✓ Saved" : "Save"}
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

          {video.has_transcript && (
            <section className="feature-panel ask-video">
              <h2 className="feature-head">Ask this video</h2>
              <form className="ask-form" onSubmit={submitAsk}>
                <input
                  className="ask-input"
                  placeholder="What do you want to know?"
                  value={askQuestion}
                  onChange={(e) => setAskQuestion(e.target.value)}
                  maxLength={500}
                  disabled={asking}
                />
                <button className="btn-primary ask-btn" type="submit" disabled={asking || !askQuestion.trim()}>
                  {asking ? "Asking…" : "Ask"}
                </button>
              </form>
              <p className="ask-hint">Answers are based on this video's transcript.</p>
              {asking && (
                <p className="muted ask-note">
                  <span className="proc-spinner sm" /> Reading the transcript…
                </p>
              )}
              {askError && <p className="ask-error">{askError}</p>}
              {askAnswer && (
                <div className="ask-answer">
                  <p className="ask-answer-text">{askAnswer.answer}</p>
                  {askAnswer.citations.length > 0 && (
                    <div className="ask-citations">
                      {askAnswer.citations.map((c) => (
                        <button
                          key={c.start}
                          className="ask-citation"
                          onClick={() => seekTo(c.start)}
                          title={c.text}
                        >
                          {fmtTime(c.start)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          <section className="transcript">
            <div className="transcript-head">
              <h3 className="related-head">Transcript</h3>
              {transcriptState === "ready" && cues.length > 0 && (
                <input
                  className="transcript-search"
                  placeholder="Find a word or phrase…"
                  value={cueQuery}
                  onChange={(e) => setCueQuery(e.target.value)}
                />
              )}
            </div>
            {transcriptState === "transcribing" ? (
              <p className="muted transcript-note">
                <span className="proc-spinner sm" /> Transcribing this video…
              </p>
            ) : transcriptState === "no_speech" ? (
              <p className="muted transcript-note">No spoken audio was detected in this video.</p>
            ) : transcriptState === "unavailable" ? (
              <p className="muted transcript-note">Transcript unavailable.</p>
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

          <Comments videoId={vid} />
        </div>

        <aside className="watch-related">
          <div className="rail-tabs" role="tablist" aria-label="Related videos or transcript">
            <button
              type="button"
              role="tab"
              id="rail-tab-related"
              aria-controls="rail-panel-related"
              aria-selected={railMode === "related"}
              className={railMode === "related" ? "rail-tab active" : "rail-tab"}
              onClick={() => setRailMode("related")}
            >
              Related
            </button>
            <button
              type="button"
              role="tab"
              id="rail-tab-transcript"
              aria-controls="rail-panel-transcript"
              aria-selected={railMode === "transcript"}
              className={railMode === "transcript" ? "rail-tab active" : "rail-tab"}
              onClick={() => setRailMode("transcript")}
            >
              Transcript
            </button>
          </div>

          <div
            id="rail-panel-related"
            role="tabpanel"
            aria-labelledby="rail-tab-related"
            className="rail-panel-related"
            hidden={railMode !== "related"}
          >
            <p className="related-sub">Connected moments from across RabbitHole.</p>
            {deeperMoments && deeperMoments.length > 0
              ? deeperMoments.map((r) => (
                  <Link
                    to={`/watch/${r.video.video_id}?t=${Math.floor(r.start)}`}
                    className="related-item deeper-moment"
                    key={r.video.video_id}
                  >
                    <div className="related-thumb">
                      {r.video.thumbnail_url ? (
                        <img src={r.video.thumbnail_url} alt="" />
                      ) : (
                        <img src="/RHRabbit.png?v=5" alt="" className="thumb-ph" />
                      )}
                      <span className="dur-badge">{fmtTime(r.start)}</span>
                    </div>
                    <div className="related-info">
                      <span className="related-title">{displayTitle(r.video)}</span>
                      <span className="deeper-snippet">“…{r.snippet}…”</span>
                    </div>
                  </Link>
                ))
              : related.map((r) => (
                  <Link to={`/watch/${r.video_id}`} className="related-item" key={r.video_id}>
                    <div className="related-thumb">
                      {r.thumbnail_url ? <img src={r.thumbnail_url} alt="" /> : <img src="/RHRabbit.png?v=5" alt="" className="thumb-ph" />}
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
          </div>

          <div
            id="rail-panel-transcript"
            role="tabpanel"
            aria-labelledby="rail-tab-transcript"
            className="rail-panel-transcript"
            hidden={railMode !== "transcript"}
          >
            {transcriptState === "ready" && cues.length > 0 && (
              <input
                className="transcript-search"
                placeholder="Find a word or phrase…"
                value={cueQuery}
                onChange={(e) => setCueQuery(e.target.value)}
              />
            )}
            {transcriptState === "transcribing" ? (
              <p className="muted transcript-note">
                <span className="proc-spinner sm" /> Transcribing this video…
              </p>
            ) : transcriptState === "no_speech" ? (
              <p className="muted transcript-note">No spoken audio was detected in this video.</p>
            ) : transcriptState === "unavailable" ? (
              <p className="muted transcript-note">Transcript unavailable.</p>
            ) : cues.length === 0 ? (
              <p className="muted transcript-note">No speech detected in this clip.</p>
            ) : (
              <>
                {!followPlayback && !cueQuery.trim() && (
                  <button type="button" className="follow-playback" onClick={() => setFollowPlayback(true)}>
                    Follow video
                  </button>
                )}
                <div
                  className="watch-related-transcript"
                  ref={railCuesRef}
                  onScroll={handleRailScroll}
                >
                  {shownCues.length === 0 ? (
                    <p className="muted transcript-note">No lines match "{cueQuery}".</p>
                  ) : (
                    shownCues.map((c) => (
                      <button
                        key={c.i}
                        className={c.i === activeCue ? "cue active" : "cue"}
                        aria-current={c.i === activeCue ? "true" : undefined}
                        onClick={() => seekFromRail(c.start)}
                      >
                        <span className="cue-time">{fmtTime(c.start)}</span>
                        <span className="cue-text">{c.text}</span>
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
