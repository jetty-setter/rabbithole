import { sourceHref, type RhSource } from "../../api";
import { SectionHeading } from "./parts";

/** Numbered 1–N in the API's order. Each `<li id="rh-source-N">` is the jump
 *  target for the matching inline citation. A clean reference list — no
 *  null fields, no exported-bibliography look. */
export function SourcesList({ sources }: { sources: RhSource[] }) {
  return (
    <section className="rh-block rh-sources" aria-labelledby="rh-h-sources">
      <SectionHeading id="rh-h-sources">Sources</SectionHeading>
      <ol className="rh-src-list">
        {sources.map((s) => {
          const href = sourceHref(s);
          const meta = [s.authors, s.publisher, s.date ?? (s.year ? String(s.year) : null)]
            .filter(Boolean)
            .join("  ·  ");
          return (
            <li className="rh-src" id={`rh-source-${s.number}`} key={s.number}>
              <span className="rh-src-n" aria-hidden="true">
                {s.number}
              </span>
              <div className="rh-src-body">
                {href ? (
                  <a
                    className="rh-src-title"
                    href={href}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
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
        })}
      </ol>
    </section>
  );
}
