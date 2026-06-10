import { useState } from "react";

/** Editable hashtag chips — used in the upload modal and the watch-page edit
 *  form so both behave identically. */
export function TagEditor({
  tags,
  setTags,
  max = 8,
}: {
  tags: string[];
  setTags: (t: string[]) => void;
  max?: number;
}) {
  const [tagInput, setTagInput] = useState("");

  function addTag(raw: string) {
    const t = raw.trim().replace(/^#+/, "").toLowerCase().slice(0, 30);
    if (t && !tags.includes(t) && tags.length < max) setTags([...tags, t]);
    setTagInput("");
  }

  return (
    <div className="tag-editor">
      {tags.map((t) => (
        <span className="tag-chip" key={t}>
          #{t}
          <button
            type="button"
            className="tag-x"
            aria-label={`Remove ${t}`}
            onClick={() => setTags(tags.filter((x) => x !== t))}
          >
            ✕
          </button>
        </span>
      ))}
      {tags.length < max && (
        <input
          className="tag-input"
          placeholder={tags.length ? "add tag" : "Add tags…"}
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === ",") && tagInput.trim()) {
              e.preventDefault();
              addTag(tagInput);
            } else if (e.key === "Backspace" && !tagInput && tags.length) {
              setTags(tags.slice(0, -1));
            }
          }}
          onBlur={() => tagInput.trim() && addTag(tagInput)}
        />
      )}
    </div>
  );
}
