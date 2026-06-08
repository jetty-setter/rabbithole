import { useRef, useState } from "react";
import { createUpload, uploadToS3 } from "./api";

export function UploadModal({
  onClose,
  onUploaded,
}: {
  onClose: () => void;
  onUploaded: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function start() {
    if (!file) return;
    setError(null);
    setProgress(0);
    try {
      const ticket = await createUpload(file.name, file.type || "video/mp4");
      await uploadToS3(ticket.upload_url, file, setProgress);
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
            if (f) setFile(f);
          }}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            hidden
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {file ? (
            <span className="dz-file">{file.name}</span>
          ) : (
            <>
              <span className="dz-icon">⬆</span>
              <span>
                Drag a video down the hole, or <b>browse</b>
              </span>
            </>
          )}
        </div>

        {progress !== null && (
          <div className="bar">
            <div className="fill" style={{ width: `${progress}%` }} />
          </div>
        )}
        {error && <p className="err">{error}</p>}

        <button
          className="btn-primary full"
          disabled={!file || progress !== null}
          onClick={start}
        >
          {progress !== null ? `Uploading… ${progress}%` : "Upload & transcode"}
        </button>
      </div>
    </div>
  );
}
