import { Link } from "react-router-dom";
import { displayTitle, type Video } from "./api";

/**
 * "Start with an idea." — one hand-curated example of curiosity moving
 * through ideas: an entry video, then four idea steps, then "Keep going".
 *
 * This is editorial, NOT derived from tag popularity, and it is not the
 * Map, a graph, or a recommendation. Every id/slug below points at real,
 * live content (the Abandoned / Uncanny homepage batch). If the entry
 * video can't be resolved from the catalog, the whole section renders
 * nothing rather than breaking Home.
 */
type Step = { label: string; slug: string; eg?: string };

const ENTRY_VIDEO_ID = "d0b96a5d5f944a979170870b18e68d3d"; // Dead Mall: Owings Mills Mall
const STEPS: Step[] = [
  { label: "Abandoned Places", slug: "abandoned-places", eg: "Postcards from Pripyat" },
  { label: "Liminal Spaces", slug: "liminal-spaces", eg: "The Backrooms" },
  { label: "Nostalgia", slug: "nostalgia" },
  { label: "Childhood Environments", slug: "childhood-environments" },
];
const KEEP_GOING_SLUG = "found-footage-time-capsules";

export function CuriosityPath({ videos }: { videos: Video[] }) {
  const entry = videos.find((v) => v.video_id === ENTRY_VIDEO_ID);
  if (!entry) return null;

  const entryBy = entry.source_name || entry.owner || "RabbitHole";

  return (
    <nav className="cpath" aria-label="Start with an idea — a curiosity path">
      <ol className="cpath-track">
        <li className="cpath-item cpath-start">
          <Link
            to={`/watch/${entry.video_id}`}
            className="cpath-start-link"
            aria-label={`Start here: ${displayTitle(entry)}, by ${entryBy}`}
          >
            <span className="cpath-start-thumb">
              {entry.thumbnail_url ? (
                <img src={entry.thumbnail_url} alt="" loading="lazy" />
              ) : (
                <img src="/RHRabbit.png?v=5" alt="" className="thumb-ph" />
              )}
              <span className="cpath-play" aria-hidden="true">▶</span>
            </span>
            <span className="cpath-start-body">
              <span className="cpath-start-eyebrow">Start here</span>
              <span className="cpath-start-title">{displayTitle(entry)}</span>
              <span className="cpath-start-by">{entryBy}</span>
            </span>
          </Link>
        </li>

        {STEPS.map((s) => (
          <li className="cpath-item cpath-step" key={s.slug}>
            <span className="cpath-arrow" aria-hidden="true">→</span>
            <Link
              to={`/tunnels/${encodeURIComponent(s.slug)}`}
              className="cpath-step-link"
              aria-label={s.eg ? `${s.label} — for example, ${s.eg}` : s.label}
            >
              <span className="cpath-step-name">{s.label}</span>
              {s.eg && <span className="cpath-step-eg" aria-hidden="true">{s.eg}</span>}
            </Link>
          </li>
        ))}

        <li className="cpath-item cpath-more">
          <span className="cpath-arrow" aria-hidden="true">→</span>
          <Link
            to={`/tunnels/${encodeURIComponent(KEEP_GOING_SLUG)}`}
            className="cpath-more-link"
          >
            Keep going <span aria-hidden="true">→</span>
          </Link>
        </li>
      </ol>
    </nav>
  );
}
