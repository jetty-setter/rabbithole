import { TagEditor } from "../TagEditor";

interface EditFormProps {
  title: string;
  setTitle: (v: string) => void;
  desc: string;
  setDesc: (v: string) => void;
  editTags: string[];
  setEditTags: (tags: string[]) => void;
  editVis: "public" | "unlisted";
  setEditVis: (v: "public" | "unlisted") => void;
  onSave: () => void;
  onCancel: () => void;
}

export function EditForm({
  title,
  setTitle,
  desc,
  setDesc,
  editTags,
  setEditTags,
  editVis,
  setEditVis,
  onSave,
  onCancel,
}: EditFormProps) {
  return (
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
      <TagEditor tags={editTags} setTags={setEditTags} />
      <div className="vis-row">
        <div className="vis-toggle">
          <button
            type="button"
            className={editVis === "public" ? "vis-opt active" : "vis-opt"}
            onClick={() => setEditVis("public")}
          >
            Public
          </button>
          <button
            type="button"
            className={editVis === "unlisted" ? "vis-opt active" : "vis-opt"}
            onClick={() => setEditVis("unlisted")}
          >
            Unlisted
          </button>
        </div>
        <span className="vis-hint">
          {editVis === "public"
            ? "Shows up in the feed and search."
            : "Hidden from the feed — only people with the link can watch."}
        </span>
      </div>
      <div className="row-gap">
        <button className="btn-primary" onClick={onSave}>
          Save
        </button>
        <button className="btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
