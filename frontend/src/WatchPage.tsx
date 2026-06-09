import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useApp } from "./App";
import { deleteVideo, displayTitle, getVideo, incrementView, updateVideo, type Video } from "./api";
import { Player } from "./Player";

export function WatchPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin, username, refresh } = useApp();

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
                  {video.views ?? 0} views
                  {video.created_at ? ` · ${new Date(video.created_at).toLocaleDateString()}` : ""}
                </div>
              </div>
              <div className="watch-actions">
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
    </main>
  );
}
