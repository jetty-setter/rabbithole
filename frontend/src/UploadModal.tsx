import { useRef, useState } from "react";
import { createUpload, suggestMetadata, uploadToS3 } from "./api";
import { extractFrames } from "./extractFrames";
import { TagEditor } from "./TagEditor";

export function UploadModal({
  onClose,
  onUploaded,
}: {
  onClose: () => void;
  onUploaded: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<"public" | "unlisted">("public");
  const [drag, setDrag] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [suggested, setSuggested] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function chooseFile(f: File | null) {
    setSuggested(false);
    setTitle("");
    setDescription("");
    setTags([]);
    if (!f) return;

    // No accept attr on the input: macOS Photos blocks library items when accept="video/*", so we validate here.
    const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
    const isVideo =
      f.type.startsWith("video/") ||
      ["mov", "mp4", "m4v", "webm", "mkv", "avi", "hevc", "heif", "3gp"].includes(ext);
    if (!isVideo) {
      setError("Please select a video file.");
      return;
    }
    setError(null);
    setFile(f);
    setSuggesting(true);
    try {
      const frames = await extractFrames(f);
      if (frames.length) {
        const s = await suggestMetadata(frames);
        if (s) {
          setTitle((t) => (t.trim() ? t : s.title));
          setDescription((d) => (d.trim() ? d : s.description));
          if (s.tags?.length) setTags(s.tags);
          setSuggested(!!(s.title || s.description || s.tags?.length));
        }
      }
    } catch {
      /* fall back to the server-side auto-titler on publish */
    } finally {
      setSuggesting(false);
    }
  }

  async function start() {
    if (!file) return;
    setError(null);
    setProgress(0);
    try {
      // file.type is often empty for Photos-library items in Safari.
      // Fall back to extension-based guessing; server validates anyway.
      const ext = file.name.split(".").pop()?.toLowerCase();
      const contentType =
        file.type ||
        (ext === "mov" ? "video/quicktime" : ext === "webm" ? "video/webm" : "video/mp4");
      const ticket = await createUpload(
        file.name,
        contentType,
        title,
        description,
        tags,
        visibility,
      );
      await uploadToS3(ticket.upload_url, file, setProgress, contentType);
      onUploaded();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
      setProgress(null);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Feed the rabbit</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div
          className={drag ? "dropzone drag" : "dropzone"}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            const f = e.dataTransfer.files?.[0];
            if (f) chooseFile(f);
          }}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            hidden
            onChange={(e) => chooseFile(e.target.files?.[0] ?? null)}
          />
          {file ? (
            <span className="dz-file">{file.name}</span>
          ) : (
            <>
              <span className="dz-icon">⬆</span>
              <span>
                Drag a video here, or <b>browse</b>
              </span>
              <span style={{ fontSize: "0.75rem", opacity: 0.55, marginTop: 4 }}>
                Drag from Photos app · or browse Movies folder
              </span>
            </>
          )}
        </div>

        {file && (
          <div className="upload-fields">
            {suggesting && (
              <div className="ai-suggest-note loading">
                <span className="proc-spinner sm" /> Reading your video to suggest a title…
              </div>
            )}
            {!suggesting && suggested && (
              <div className="ai-suggest-note">✦ AI suggestion — edit anything you like</div>
            )}
            <input
              className="search wide"
              placeholder="Title — leave blank and the AI will name it ✦"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <textarea
              className="search wide ta"
              placeholder="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
            <TagEditor tags={tags} setTags={setTags} />
            <div className="vis-row">
              <div className="vis-toggle">
                <button
                  type="button"
                  className={visibility === "public" ? "vis-opt active" : "vis-opt"}
                  onClick={() => setVisibility("public")}
                >
                  Public
                </button>
                <button
                  type="button"
                  className={visibility === "unlisted" ? "vis-opt active" : "vis-opt"}
                  onClick={() => setVisibility("unlisted")}
                >
                  Unlisted
                </button>
              </div>
              <span className="vis-hint">
                {visibility === "public"
                  ? "Shows up in the feed and search."
                  : "Hidden from the feed — only people with the link can watch."}
              </span>
            </div>
          </div>
        )}

        {progress !== null && (
          <div className="bar">
            <div className="fill" style={{ width: `${progress}%` }} />
          </div>
        )}
        {error && <p className="err">{error}</p>}

        <button className="btn-primary full" disabled={!file || progress !== null} onClick={start}>
          {progress !== null ? `Uploading… ${progress}%` : "Upload & transcode"}
        </button>
      </div>
    </div>
  );
}
