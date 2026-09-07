import { useMemo, useState } from "react";
import { createExternal, type TranscriptSegment } from "./api";
import { TagEditor } from "./TagEditor";
import { useModalA11y } from "./hooks/useModalA11y";

const YT = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})|^([A-Za-z0-9_-]{11})$/;

/** Parse a pasted transcript into segments. Accepts either a JSON array of
 *  `{start, end?, text}` (real timing) or plain text (searchable, no timing —
 *  the server marks it non-seekable). */
function parseSegments(raw: string): { segments?: TranscriptSegment[]; text?: string } {
  const s = raw.trim();
  if (!s) return {};
  if (s.startsWith("[")) {
    try {
      const arr = JSON.parse(s);
      if (
        Array.isArray(arr) &&
        arr.every((x) => x && typeof x.start === "number" && typeof x.text === "string")
      ) {
        return { segments: arr.map((x) => ({ start: x.start, end: x.end ?? null, text: x.text })) };
      }
    } catch {
      /* fall through to plain text */
    }
  }
  return { text: s };
}

export function AddExternalModal({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: () => void;
}) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [creator, setCreator] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<"public" | "unlisted">("public");
  const [transcriptMode, setTranscriptMode] = useState<"none" | "imported">("none");
  const [transcriptRaw, setTranscriptRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const modalRef = useModalA11y<HTMLDivElement>(onClose);

  const detected = useMemo<"youtube" | "generic" | null>(() => {
    if (!url.trim()) return null;
    return YT.test(url.trim()) ? "youtube" : "generic";
  }, [url]);

  async function submit() {
    if (!url.trim() || !title.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const t = transcriptMode === "imported" ? parseSegments(transcriptRaw) : {};
      await createExternal({
        source_url: url.trim(),
        title: title.trim(),
        description: description.trim() || undefined,
        creator: creator.trim() || undefined,
        thumbnail_url: thumbnailUrl.trim() || undefined,
        tags,
        visibility,
        transcript_source: transcriptMode === "imported" ? "imported" : "none",
        transcript_text: t.text,
        transcript_segments: t.segments,
      });
      onAdded();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add that.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="external-modal-title"
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2 id="external-modal-title">Add external video</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="upload-fields">
          <label className="ext-label">
            Source URL
            <input
              className="search wide"
              placeholder="https://www.youtube.com/watch?v=…  or any source page"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              autoFocus
            />
          </label>
          {detected && (
            <p className="ext-detected">
              Detected: <b>{detected === "youtube" ? "YouTube (embeddable)" : "generic link"}</b>
              {detected === "generic" && " — no inline player; viewers open the source"}
            </p>
          )}

          <input
            className="search wide"
            placeholder="Title"
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
          <input
            className="search wide"
            placeholder="Creator / source (e.g. NASA Goddard)"
            value={creator}
            onChange={(e) => setCreator(e.target.value)}
          />
          <input
            className="search wide"
            placeholder="Thumbnail URL (optional — YouTube supplies one)"
            value={thumbnailUrl}
            onChange={(e) => setThumbnailUrl(e.target.value)}
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
          </div>

          <div className="ext-transcript">
            <span className="ext-label">Transcript</span>
            <div className="vis-toggle">
              <button
                type="button"
                className={transcriptMode === "none" ? "vis-opt active" : "vis-opt"}
                onClick={() => setTranscriptMode("none")}
              >
                None
              </button>
              <button
                type="button"
                className={transcriptMode === "imported" ? "vis-opt active" : "vis-opt"}
                onClick={() => setTranscriptMode("imported")}
              >
                Imported
              </button>
            </div>
            {transcriptMode === "imported" && (
              <>
                <textarea
                  className="search wide ta"
                  placeholder='Paste transcript text, or a JSON array of {"start": seconds, "text": "…"} segments for exact-moment seeking'
                  value={transcriptRaw}
                  onChange={(e) => setTranscriptRaw(e.target.value)}
                  rows={5}
                />
                <p className="ext-detected">
                  Plain text is fully searchable but not seekable. Timestamped
                  segments enable exact-moment jumps (YouTube only).
                </p>
              </>
            )}
          </div>

          {error && <p className="err">{error}</p>}
        </div>

        <button
          className="btn-primary full"
          disabled={!url.trim() || !title.trim() || busy}
          onClick={submit}
        >
          {busy ? "Adding…" : "Add external video"}
        </button>
      </div>
    </div>
  );
}
