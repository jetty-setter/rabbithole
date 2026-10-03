import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  displayTitle,
  formatDuration,
  normalizeTag,
  pickFeatured,
  relativeTime,
  type Video,
} from "../../api";
import { EditorialCard } from "../../EditorialCard";
import { publicVideos } from "../../discovery";

/** Statuses a video passes through before it can be watched. Order matters:
 *  it drives the stage tracker in "In the pipeline". */
const PIPELINE_STAGES = [
  { key: "queued", label: "Queued", statuses: ["pending_upload", "uploaded"] },
  { key: "transcoding", label: "Transcoding", statuses: ["processing"] },
  { key: "ready", label: "Ready", statuses: ["ready"] },
] as const;

function stageIndex(status: string): number {
  const i = PIPELINE_STAGES.findIndex((s) => (s.statuses as readonly string[]).includes(status));
  return i === -1 ? 0 : i;
}

const GRID_SIZE = 8;
const TOPIC_COUNT = 14;

export interface HomeVideosProps {
  videos: Video[];
  loading: boolean;
  /** True while the WebSocket status channel is connected. */
  live: boolean;
  /** Opens the upload flow (or sign-in first, for guests). */
  onUpload: () => void;
  onAddExternal?: () => void;
  username?: string | null;
  isAdmin?: boolean;
}

/** The video-first body of the homepage, under the hero: the featured
 *  video, anything still moving through the processing pipeline, the
 *  newest and most-watched videos, and the topics they cover. */
export function HomeVideos({ videos, loading, live, onUpload, onAddExternal, username, isAdmin }: HomeVideosProps) {
  const ready = useMemo(
    () =>
      publicVideos(videos)
        .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || "")),
    [videos],
  );

  const inPipeline = useMemo(
    () => videos.filter((v) => ["pending_upload", "uploaded", "processing"].includes(v.status) && (isAdmin || (!!username && v.owner === username))),
    [videos, isAdmin, username],
  );

  const featured = pickFeatured(ready);
  const rest = ready.filter((v) => v.video_id !== featured?.video_id);
  const justAdded = rest.slice(0, GRID_SIZE);

  // Only worth a second grid once "Just added" can't already show the whole
  // library -- otherwise it just repeats the same cards in a different order.
  const mostWatched = useMemo(
    () =>
      rest.length <= GRID_SIZE
        ? []
        : ready
            .filter((v) => (v.views ?? 0) > 0)
            .sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
            .slice(0, GRID_SIZE),
    [ready, rest.length],
  );

  const topics = useMemo(() => {
    const counts = new Map<string, number>();
    for (const v of ready) {
      for (const raw of v.tags ?? []) {
        const tag = normalizeTag(raw);
        if (tag) counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, TOPIC_COUNT);
  }, [ready]);

  if (loading && videos.length === 0) {
    return (
      <div className="hv" aria-busy="true">
        <div className="hv-featured hv-featured-loading" aria-hidden="true">
          <div className="sk hv-featured-media" />
          <div className="hv-featured-body">
            <div className="sk sk-line tall" style={{ width: "80%" }} />
            <div className="sk sk-line" style={{ width: "95%", marginTop: 16 }} />
            <div className="sk sk-line" style={{ width: "70%" }} />
          </div>
        </div>
      </div>
    );
  }

  if (ready.length === 0 && inPipeline.length === 0) {
    return (
      <div className="hv">
        <section className="hv-empty" aria-labelledby="hv-empty-title">
          <h2 id="hv-empty-title">No videos yet</h2>
          <p>Strange science. Hidden history. Things you didn&rsquo;t know you wanted to watch.</p>
          {onAddExternal && <button type="button" className="hv-upload" onClick={onAddExternal}>Add a YouTube find</button>}
          <button type="button" className="hv-upload" onClick={onUpload}>
            Upload a video
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="hv">
      {featured && <FeaturedVideo v={featured} />}
      {onAddExternal && <div className="hv-editor-actions"><button type="button" className="hv-upload" onClick={onAddExternal}>Add a YouTube find</button><span>A link, a reason to watch, and a few connecting topics.</span></div>}

      {inPipeline.length > 0 && <Pipeline videos={inPipeline} live={live} />}

      {justAdded.length > 0 && (
        <section className="hv-section" aria-labelledby="hv-new">
          <header className="hv-section-head">
            <h2 id="hv-new">Just added</h2>
            <button type="button" className="hv-upload" onClick={onUpload}>
              Upload a video
            </button>
          </header>
          <div className="home-grid">
            {justAdded.map((v) => (
              <EditorialCard key={v.video_id} v={v} />
            ))}
          </div>
          {rest.length > GRID_SIZE && (
            <Link to="/fresh" className="hv-more">
              See everything new
            </Link>
          )}
        </section>
      )}

      {mostWatched.length > 0 && (
        <section className="hv-section" aria-labelledby="hv-top">
          <header className="hv-section-head">
            <h2 id="hv-top">Most watched</h2>
          </header>
          <div className="home-grid">
            {mostWatched.map((v) => (
              <EditorialCard key={v.video_id} v={v} />
            ))}
          </div>
          <Link to="/trending" className="hv-more">
            See what&rsquo;s trending
          </Link>
        </section>
      )}

      {topics.length > 0 && (
        <section className="hv-section" aria-labelledby="hv-topics">
          <header className="hv-section-head">
            <h2 id="hv-topics">Topics</h2>
          </header>
          <ul className="hv-topics">
            {topics.map(([tag, count]) => (
              <li key={tag}>
                <Link to={`/tunnels/${encodeURIComponent(tag)}`} className="tunnel-chip">
                  {tag}
                  <span className="hv-topic-count">{count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function FeaturedVideo({ v }: { v: Video }) {
  const title = displayTitle(v);
  const facts = [
    v.duration_seconds ? formatDuration(v.duration_seconds) : null,
    typeof v.views === "number" ? `${v.views.toLocaleString()} ${v.views === 1 ? "view" : "views"}` : null,
    v.created_at ? relativeTime(v.created_at) : null,
  ].filter(Boolean) as string[];

  return (
    <section className="hv-featured" aria-labelledby="hv-featured-title">
      <Link to={`/watch/${v.video_id}`} className="hv-featured-media" tabIndex={-1} aria-hidden="true">
        {v.thumbnail_url ? (
          <img src={v.thumbnail_url} alt="" />
        ) : (
          <img src="/RHRabbit.png?v=5" alt="" className="thumb-ph" />
        )}
        <span className="hv-featured-play">
          <svg viewBox="0 0 10 10" fill="currentColor">
            <path d="M1.5 0.5l8 4.5-8 4.5z" />
          </svg>
        </span>
      </Link>

      <div className="hv-featured-body">
        <p className="hv-featured-kicker">Featured video</p>
        <h2 id="hv-featured-title" className="hv-featured-title">
          <Link to={`/watch/${v.video_id}`}>{title}</Link>
        </h2>
        {v.description && <p className="hv-featured-desc">{v.description}</p>}
        {v.owner && <p className="hv-source">From {v.source_name || v.owner}{v.source_type === "external" ? ` · ${v.provider === "youtube" ? "YouTube" : "Watch at source"}` : " · Uploaded to RabbitHole"}</p>}
        {facts.length > 0 && (
          <ul className="hv-facts">
            {facts.map((f) => (
              <li key={f}>{f}</li>
            ))}
            {v.has_transcript && <li>Captions and searchable transcript</li>}
          </ul>
        )}
        <Link to={`/watch/${v.video_id}`} className="hv-watch">
          Watch
        </Link>
      </div>
    </section>
  );
}

function Pipeline({ videos, live }: { videos: Video[]; live: boolean }) {
  return (
    <section className="hv-section hv-pipeline" aria-labelledby="hv-pipe">
      <header className="hv-section-head">
        <h2 id="hv-pipe">In the pipeline</h2>
        <span className={live ? "hv-live on" : "hv-live"}>
          {live ? "Live status" : "Checking for updates"}
        </span>
      </header>
      <ul className="hv-pipe-list">
        {videos.map((v) => {
          const at = stageIndex(v.status);
          return (
            <li key={v.video_id} className="hv-pipe-item">
              <span className="hv-pipe-title">{displayTitle(v)}</span>
              <ol className="hv-stages" aria-label={`Processing status: ${PIPELINE_STAGES[at].label}`}>
                {PIPELINE_STAGES.map((s, i) => (
                  <li
                    key={s.key}
                    className={i < at ? "done" : i === at ? "current" : undefined}
                    aria-current={i === at ? "step" : undefined}
                  >
                    {s.label}
                  </li>
                ))}
              </ol>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
