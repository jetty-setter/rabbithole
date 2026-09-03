import { Fragment, useState } from "react";
import { useApp } from "./App";
import {
  STATUS_LABEL,
  setFeatured,
  getThumbnailCandidates,
  selectThumbnail,
  type ThumbnailCandidates,
  type Video,
} from "./api";
import { SkeletonAdmin } from "./Skeleton";

function fmtClock(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function AdminPage() {
  const { videos, live, authed, isAdmin, requireLogin, loading, refresh } = useApp();
  const [pendingFeature, setPendingFeature] = useState<string | null>(null);
  const [featureError, setFeatureError] = useState<string | null>(null);

  // Thumbnail frame picker — one video's candidates expanded inline at a time.
  const [thumbFor, setThumbFor] = useState<string | null>(null);
  const [thumbData, setThumbData] = useState<ThumbnailCandidates | null>(null);
  const [thumbLoading, setThumbLoading] = useState(false);
  const [thumbBusy, setThumbBusy] = useState(false);
  const [thumbError, setThumbError] = useState<string | null>(null);

  async function toggleFeatured(v: Video) {
    setPendingFeature(v.video_id);
    setFeatureError(null);
    try {
      await setFeatured(v.video_id, !v.featured);
      refresh();
    } catch {
      setFeatureError(
        v.featured
          ? "Couldn't clear the Featured video. Try again."
          : "Couldn't feature that video. Try again.",
      );
    } finally {
      setPendingFeature(null);
    }
  }

  async function openThumb(v: Video) {
    if (thumbFor === v.video_id) {
      setThumbFor(null);
      return;
    }
    setThumbFor(v.video_id);
    setThumbData(null);
    setThumbError(null);
    setThumbLoading(true);
    try {
      setThumbData(await getThumbnailCandidates(v.video_id));
    } catch {
      setThumbError("Couldn't load candidate frames for this video.");
    } finally {
      setThumbLoading(false);
    }
  }

  async function chooseThumb(v: Video, body: { mode: "manual"; index: number } | { mode: "auto" }) {
    setThumbBusy(true);
    setThumbError(null);
    try {
      await selectThumbnail(v.video_id, body);
      setThumbData(await getThumbnailCandidates(v.video_id));
      refresh();
    } catch {
      setThumbError("Couldn't update the thumbnail. Try again.");
    } finally {
      setThumbBusy(false);
    }
  }

  if (!isAdmin) {
    return (
      <main className="page">
        <div className="empty">
          <h3>Admins only</h3>
          <p>{authed ? "You don't have access to operations." : "Sign in as an admin to view operations."}</p>
          {!authed && (
            <button className="btn-primary" onClick={requireLogin}>
              Sign in
            </button>
          )}
        </div>
      </main>
    );
  }

  if (loading && videos.length === 0) return <SkeletonAdmin />;

  const ready = videos.filter((v) => v.status === "ready").length;
  const processing = videos.filter((v) =>
    ["processing", "uploaded", "pending_upload"].includes(v.status),
  ).length;
  const failed = videos.filter((v) => v.status === "failed").length;
  const cost = videos.reduce((s, v) => s + Number(v.cost_usd ?? 0), 0);

  return (
    <main className="page">
      <div className="admin-head">
        <h1>Operations</h1>
        <span className="hstat-dot">
          <span className={live ? "dot live" : "dot"} />
          {live ? "Real-time connected" : "Polling"}
        </span>
      </div>

      <div className="hood-stats">
        <div className="hstat">
          <span className="hstat-num">{videos.length}</span>
          <span className="hstat-l">Total videos</span>
        </div>
        <div className="hstat">
          <span className="hstat-num">{ready}</span>
          <span className="hstat-l">Ready</span>
        </div>
        <div className="hstat">
          <span className="hstat-num">{processing}</span>
          <span className="hstat-l">In pipeline</span>
        </div>
        <div className="hstat">
          <span className="hstat-num">{failed}</span>
          <span className="hstat-l">Failed</span>
        </div>
        <div className="hstat">
          <span className="hstat-num accent">${cost.toFixed(4)}</span>
          <span className="hstat-l">Compute cost</span>
        </div>
      </div>

      <p className="hood-note">
        Event-driven pipeline on AWS — S3 · EventBridge · SQS · Fargate (ffmpeg) · CloudFront.
        Workers autoscale 0→N on queue depth and scale back to zero when idle.
      </p>

      <h2 className="admin-sub">All videos</h2>
      {featureError && <p className="err">{featureError}</p>}
      <div className="table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Video</th>
              <th>Status</th>
              <th>Homepage</th>
              <th>Thumbnail</th>
              <th>Duration</th>
              <th>Cost</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {videos.map((v) => (
              <Fragment key={v.video_id}>
                <tr>
                  <td>{v.filename}</td>
                  <td>
                    <span className={`tag s-${v.status}`}>{STATUS_LABEL[v.status] ?? v.status}</span>
                  </td>
                  <td>
                    {v.status === "ready" ? (
                      <button
                        type="button"
                        className={v.featured ? "feature-toggle on" : "feature-toggle"}
                        onClick={() => toggleFeatured(v)}
                        disabled={pendingFeature !== null}
                        aria-pressed={!!v.featured}
                        title={
                          v.featured
                            ? "This is the homepage Featured video — click to clear it"
                            : "Make this the homepage Featured video (replaces the current one)"
                        }
                      >
                        {v.featured ? "Featured on homepage" : "Feature on homepage"}
                      </button>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    {v.status === "ready" ? (
                      <button
                        type="button"
                        className="thumb-pick-btn"
                        onClick={() => openThumb(v)}
                        aria-expanded={thumbFor === v.video_id}
                      >
                        {thumbFor === v.video_id ? "Close" : "Change thumbnail"}
                        {v.thumbnail_source === "manual" && (
                          <span className="thumb-manual-tag" title="An admin picked this frame">
                            manual
                          </span>
                        )}
                      </button>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{v.duration_seconds ? `${v.duration_seconds}s` : "—"}</td>
                  <td>{v.cost_usd ? `$${v.cost_usd}` : "—"}</td>
                  <td>{v.created_at ? new Date(v.created_at).toLocaleString() : "—"}</td>
                </tr>
                {thumbFor === v.video_id && (
                  <tr className="thumb-pick-row">
                    <td colSpan={7}>
                      <div className="thumb-pick">
                        <div className="thumb-pick-head">
                          <span>
                            Pick the frame that makes the best thumbnail. The video keeps whichever
                            you choose until you reset it.
                          </span>
                          <button
                            type="button"
                            className="thumb-reset-btn"
                            onClick={() => chooseThumb(v, { mode: "auto" })}
                            disabled={
                              thumbBusy ||
                              thumbLoading ||
                              !thumbData ||
                              thumbData.source === "auto"
                            }
                          >
                            Use automatic selection
                          </button>
                        </div>
                        {thumbError && <p className="err">{thumbError}</p>}
                        {thumbLoading && <p className="thumb-pick-note">Loading frames…</p>}
                        {!thumbLoading && thumbData && thumbData.candidates.length === 0 && (
                          <p className="thumb-pick-note">
                            No candidate frames were generated for this video (it predates smart
                            thumbnails, or frame extraction failed). Re-run the backfill to
                            generate them.
                          </p>
                        )}
                        {!thumbLoading && thumbData && thumbData.candidates.length > 0 && (
                          <ul className="thumb-cand-grid">
                            {thumbData.candidates.map((c) => (
                              <li key={c.index}>
                                <button
                                  type="button"
                                  className={c.is_current ? "thumb-cand is-current" : "thumb-cand"}
                                  aria-pressed={c.is_current}
                                  disabled={thumbBusy}
                                  onClick={() =>
                                    chooseThumb(v, { mode: "manual", index: c.index })
                                  }
                                >
                                  {c.url ? (
                                    <img src={c.url} alt={`Frame at ${fmtClock(c.timestamp)}`} />
                                  ) : (
                                    <span className="thumb-cand-noimg" />
                                  )}
                                  <span className="thumb-cand-meta">
                                    <span className="thumb-cand-time">{fmtClock(c.timestamp)}</span>
                                    {c.is_current && (
                                      <span className="thumb-cand-flag">✓ Current</span>
                                    )}
                                    {c.is_auto && !c.is_current && (
                                      <span className="thumb-cand-flag muted">Auto pick</span>
                                    )}
                                  </span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {videos.length === 0 && (
              <tr>
                <td colSpan={7} className="table-empty">
                  No videos yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
