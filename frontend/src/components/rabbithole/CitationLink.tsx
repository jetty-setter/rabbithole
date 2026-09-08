import type { RhCitation } from "../../api";

const SOURCE_ID = (n: number) => `rh-source-${n}`;

/** Scroll a source into view and flash it. Kept out of the component so the
 *  same behaviour can be triggered from a keyboard activation. */
function jumpToSource(n: number, e?: { preventDefault: () => void }) {
  const el = document.getElementById(SOURCE_ID(n));
  if (!el) return; // no dead scroll if the sources list isn't mounted
  e?.preventDefault();
  const reduce =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
  el.classList.remove("is-flash");
  void el.offsetWidth; // restart the animation
  el.classList.add("is-flash");
  window.setTimeout(() => el.classList.remove("is-flash"), 1700);
  try {
    window.history.replaceState(null, "", `#${SOURCE_ID(n)}`);
  } catch {
    /* replaceState can throw in sandboxed contexts — the scroll already ran */
  }
}

/** One inline citation marker. A real anchor (keyboard + right-click friendly)
 *  that also does a smooth scroll + highlight on click. Never a bare browser
 *  superscript. */
export function CitationLink({ citation }: { citation: RhCitation }) {
  return (
    <a
      href={`#${SOURCE_ID(citation.number)}`}
      className="rh-cite"
      aria-label={`Jump to source ${citation.number}`}
      onClick={(e) => jumpToSource(citation.number, e)}
    >
      {citation.number}
    </a>
  );
}

/** The citation group that follows a sentence: `¹ ²`. Renders nothing when a
 *  claim has no citations (Timeline entries often don't). */
export function Cites({ citations }: { citations: RhCitation[] }) {
  if (!citations || citations.length === 0) return null;
  return (
    <span className="rh-cites">
      {citations.map((c, i) => (
        <span key={c.source_id ?? i}>
          {i > 0 && <span className="rh-cites-sep" aria-hidden="true">·</span>}
          <CitationLink citation={c} />
        </span>
      ))}
    </span>
  );
}
