import { useState } from "react";
import { deleteVideo, STATUS_LABEL, type Video } from "./api";

function prettyTitle(name: string): string {
  return name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
}

export function VideoCard({
  v,
  onPlay,
  onDeleted,
  canManage,
}: {
  v: Video;
  onPlay: () => void;
  onDeleted: () => void;
  canManage: boolean;
}) {
  const ready = v.status === "ready" && !!v.playback_url;
  const [copied, setCopied] = useState(false);

  async function copyLink(e: React.MouseEvent) {
    e.stopPropagation();
    if (!v.playback_url) return;
    await navigator.clipboard.writeText(v.playback_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function remove(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Delete "${v.filename}"? This can't be undone.`)) return;
    await deleteVideo(v.video_id);
    onDeleted();
  }

  return (
    <div className={ready ? "vcard play" : "vcard"} onClick={() => ready && onPlay()}>
      <div className="thumb">
        {v.thumbnail_url ? <img src={v.thumbnail_url} alt="" /> : <span className="thumb-ph">🐇</span>}
        {ready && <span className="play-badge">▶</span>}
        {v.status !== "ready" && (
          <span className={`ov-status s-${v.status}`}>{STATUS_LABEL[v.status] ?? v.status}</span>
        )}
      </div>

      <div className="vcard-row">
        <span className="avatar">R</span>
        <div className="vcard-info">
          <span className="vtitle">{prettyTitle(v.filename)}</span>
          <span className="vchannel">RabbitHole</span>
          <span className="vmeta">
            {ready
              ? v.duration_seconds && `${v.duration_seconds}s`
              : STATUS_LABEL[v.status] ?? v.status}
          </span>
        </div>
        {(ready || canManage) && (
          <div className="vcard-actions">
            {ready && (
              <button className="act" title="Copy share link" onClick={copyLink}>
                {copied ? "✓" : "🔗"}
              </button>
            )}
            {canManage && (
              <button className="act danger" title="Delete" onClick={remove}>
                🗑
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
