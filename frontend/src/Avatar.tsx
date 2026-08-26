// Per-user hexagon avatar — 4 brand-cohesive looks, chosen deterministically
// from the name: violet/warm filled (light letter) + white outline (violet/warm
// letter). Only the brand's two accent colors, so avatars always match the site.
const VIOLET = "#8f3bff";
const WARM = "#e85b35";
const WHITE = "#f3f3f1";

const VARIANTS = [
  { fill: VIOLET, stroke: VIOLET, text: WHITE }, // violet, white letter
  { fill: WARM, stroke: WARM, text: WHITE }, // warm, white letter
  { fill: "none", stroke: WHITE, text: VIOLET }, // white outline, violet letter
  { fill: "none", stroke: WHITE, text: WARM }, // white outline, warm letter
];

function variantFor(name: string) {
  let h = 0;
  const s = name || "?";
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return VARIANTS[h % VARIANTS.length];
}

export function Avatar({ name, className }: { name: string | null | undefined; className?: string }) {
  const n = (name || "?").trim() || "?";
  const initial = n[0].toUpperCase();
  const { fill, stroke, text } = variantFor(n);
  return (
    <svg
      className={className ? `avatar ${className}` : "avatar"}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <polygon
        points="12,1.4 22.2,6.7 22.2,17.3 12,22.6 1.8,17.3 1.8,6.7"
        fill={fill}
        stroke={stroke}
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <text
        x="12"
        y="12.7"
        textAnchor="middle"
        dominantBaseline="central"
        fill={text}
        fontFamily="'Space Grotesk', system-ui, sans-serif"
        fontWeight="700"
        fontSize="11"
      >
        {initial}
      </text>
    </svg>
  );
}
