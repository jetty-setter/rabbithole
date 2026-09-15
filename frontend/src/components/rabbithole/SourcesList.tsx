import { sourceHref, type RhSource } from "../../api";
import { SectionHeading } from "./parts";

const VISIBLE_BY_DEFAULT = 4;

function SourceRow({ s }: { s: RhSource }) {
  const href = sourceHref(s);
  const meta = [s.authors, s.publisher, s.date ?? (s.year ? String(s.year) : null)]
    .filter(Boolean)
    .join("  ·  ");
  return (
    <li className="rh-src" id={`rh-source-${s.number}`}>
      <span className="rh-src-n" aria-hidden="true">
        {s.number}
      </span>
      <div className="rh-src-body">
        {href ? (
          <a className="rh-src-title" href={href} target="_blank" rel="noreferrer noopener">
            {s.title}
          </a>
        ) : (
          <span className="rh-src-title">{s.title}</span>
        )}
        {(meta || s.type) && (
          <p className="rh-src-meta">
            {meta}
            {meta && s.type && (
              <span className="rh-src-sep" aria-hidden="true">
                {"  ·  "}
              </span>
            )}
            {s.type && <span className="rh-src-type">{s.type}</span>}
          </p>
        )}
        {s.doi && (
          <a
            className="rh-src-doi"
            href={`https://doi.org/${s.doi}`}
            target="_blank"
            rel="noreferrer noopener"
          >
            doi:{s.doi}
          </a>
        )}
        {s.note && <p className="rh-src-note">{s.note}</p>}
      </div>
    </li>
  );
}

/** Numbered 1–N in the API's order. Each `<li id="rh-source-N">` is the jump
 *  target for the matching inline citation. A clean reference list — no
 *  null fields, no exported-bibliography look. Reference material, not a
 *  visual showcase: past a handful of entries the rest sit behind a native
 *  `<details>` disclosure so the section doesn't dominate the page by
 *  default -- still real DOM nodes a citation can jump straight to, since
 *  browsers auto-expand a closed `<details>` around a scrollIntoView/
 *  fragment target. */
export function SourcesList({ sources }: { sources: RhSource[] }) {
  const visible = sources.slice(0, VISIBLE_BY_DEFAULT);
  const rest = sources.slice(VISIBLE_BY_DEFAULT);

  return (
    <section className="rh-block rh-sources" aria-labelledby="rh-h-sources">
      <SectionHeading id="rh-h-sources">Sources</SectionHeading>
      <ol className="rh-src-list">
        {visible.map((s) => (
          <SourceRow s={s} key={s.number} />
        ))}
      </ol>
      {rest.length > 0 && (
        <details className="rh-src-more">
          <summary>
            Show {rest.length} more {rest.length === 1 ? "source" : "sources"}
          </summary>
          <ol className="rh-src-list">
            {rest.map((s) => (
              <SourceRow s={s} key={s.number} />
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}
