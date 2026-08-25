// Per-user hexagon avatar — 4 brand-cohesive looks, chosen deterministically
// from the name: pink/green filled (light letter) + white outline (pink/green
// letter). Only the brand's two accent colors, so avatars always match the site.
const PINK = "#cf2ce8";
const GREEN = "#8f3bff";
const WHITE = "#f3f3f1";

const VARIANTS = [
  { fill: PINK, stroke: PINK, text: WHITE }, // magenta, white letter
  { fill: GREEN, stroke: GREEN, text: WHITE }, // purple, white letter
  { fill: "none", stroke: WHITE, text: PINK }, // white outline, magenta letter
  { fill: "none", stroke: WHITE, text: GREEN }, // white outline, purple letter
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
        fontFamily="Anton, system-ui, sans-serif"
        fontSize="11"
      >
        {initial}
      </text>
    </svg>
  );
}
