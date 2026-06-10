/** RabbitHole reaction art.
 *  - HopIcon / ThumpIcon: the mascot line-art (used big, in the reaction buttons).
 *  - HopGlyph: a tiny solid bunny that still reads at ~13px (card meta). */

// Bump when the art changes — busts any cached copy of the same filename.
const ART_V = "2";

// The mascot mid-hop — excited — approval.
export function HopIcon({ className }: { className?: string }) {
  return <img src={`/hop.png?v=${ART_V}`} alt="" className={className} />;
}

// The mascot mid-thump — angry stomp — disapproval.
export function ThumpIcon({ className }: { className?: string }) {
  return <img src={`/thump.png?v=${ART_V}`} alt="" className={className} />;
}

// Small up/down chevrons for the feed-card vote counts (match the watch vote).
export function UpIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 14l6-6 6 6" />
    </svg>
  );
}

export function DownIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 10l6 6 6-6" />
    </svg>
  );
}

// Tiny solid bunny silhouette — legible at small sizes (feed-card hop count).
export function HopGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <g>
        <ellipse cx="14.4" cy="5.4" rx="1.5" ry="4.3" transform="rotate(-13 14.4 5.4)" />
        <ellipse cx="18.1" cy="5.8" rx="1.5" ry="4.3" transform="rotate(11 18.1 5.8)" />
        <circle cx="16.4" cy="11.2" r="3.5" />
        <ellipse cx="10.3" cy="16.2" rx="6.7" ry="6" />
        <circle cx="3.9" cy="16.8" r="2.1" />
      </g>
    </svg>
  );
}
