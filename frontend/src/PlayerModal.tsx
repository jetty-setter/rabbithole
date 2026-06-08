import { Player } from "./Player";
import type { Video } from "./api";

export function PlayerModal({ video, onClose }: { video: Video; onClose: () => void }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="player-modal" onClick={(e) => e.stopPropagation()}>
        <button className="icon-btn player-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        {video.playback_url && <Player src={video.playback_url} />}
        <div className="player-meta">
          <h2>{video.filename}</h2>
          <div className="meta-row">
            {video.duration_seconds && <span className="chip">⏱ {video.duration_seconds}s</span>}
            {video.cost_usd && <span className="chip">${video.cost_usd}</span>}
            <span className="chip">HLS · adaptive bitrate</span>
          </div>
        </div>
      </div>
    </div>
  );
}
