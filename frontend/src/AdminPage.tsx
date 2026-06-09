import { useApp } from "./App";
import { STATUS_LABEL } from "./api";

export function AdminPage() {
  const { videos, live, authed, isAdmin, requireLogin } = useApp();

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
          <span className="hstat-num green">${cost.toFixed(4)}</span>
          <span className="hstat-l">Compute cost</span>
        </div>
      </div>

      <p className="hood-note">
        Event-driven pipeline on AWS — S3 · EventBridge · SQS · Fargate (ffmpeg) · CloudFront.
        Workers autoscale 0→N on queue depth and scale back to zero when idle.
      </p>

      <h2 className="admin-sub">All videos</h2>
      <div className="table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Video</th>
              <th>Status</th>
              <th>Duration</th>
              <th>Cost</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {videos.map((v) => (
              <tr key={v.video_id}>
                <td>{v.filename}</td>
                <td>
                  <span className={`tag s-${v.status}`}>{STATUS_LABEL[v.status] ?? v.status}</span>
                </td>
                <td>{v.duration_seconds ? `${v.duration_seconds}s` : "—"}</td>
                <td>{v.cost_usd ? `$${v.cost_usd}` : "—"}</td>
                <td>{v.created_at ? new Date(v.created_at).toLocaleString() : "—"}</td>
              </tr>
            ))}
            {videos.length === 0 && (
              <tr>
                <td colSpan={5} className="table-empty">
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
