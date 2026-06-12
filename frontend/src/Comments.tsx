import { useEffect, useState } from "react";
import { useApp } from "./App";
import { Avatar } from "./Avatar";
import {
  addComment,
  deleteComment,
  listComments,
  relativeTime,
  type Comment,
} from "./api";

export function Comments({ videoId }: { videoId: string }) {
  const { authed, isAdmin, username, requireLogin } = useApp();
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    listComments(videoId).then(setComments);
  }, [videoId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setPosting(true);
    try {
      const created = await addComment(videoId, body);
      setComments((prev) => [created, ...prev]);
      setText("");
    } finally {
      setPosting(false);
    }
  }

  async function remove(c: Comment) {
    setComments((prev) => prev.filter((x) => x.comment_id !== c.comment_id));
    await deleteComment(videoId, c.comment_id);
  }

  return (
    <section className="comments">
      <h3 className="comments-head">
        {comments.length} {comments.length === 1 ? "twitch" : "twitches"}
      </h3>

      {authed ? (
        <form className="comment-form" onSubmit={submit}>
          <Avatar name={username} />
          <div className="comment-input-wrap">
            <input
              className="comment-input"
              placeholder="Give it a twitch…"
              value={text}
              maxLength={1000}
              onChange={(e) => setText(e.target.value)}
            />
            <div className="comment-actions">
              <button
                type="submit"
                className="btn-primary"
                disabled={!text.trim() || posting}
              >
                {posting ? "Twitching…" : "Twitch"}
              </button>
            </div>
          </div>
        </form>
      ) : (
        <button className="comment-signin" onClick={requireLogin}>
          Sign in to twitch back
        </button>
      )}

      <div className="comment-list">
        {comments.length === 0 && (
          <p className="muted comment-empty">Not a whisker moving. Be the first twitch.</p>
        )}
        {comments.map((c) => {
          const canDelete = isAdmin || c.author === username;
          return (
            <div className="comment" key={c.comment_id}>
              <Avatar name={c.author} />
              <div className="comment-body">
                <div className="comment-meta">
                  <span className="comment-author">{c.author}</span>
                  <span className="comment-time">{relativeTime(c.created_at)}</span>
                </div>
                <p className="comment-text">{c.text}</p>
                {canDelete && (
                  <button className="comment-del" onClick={() => remove(c)}>
                    Delete
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
