// Per-user circular avatar, deterministic from the name: dark fill, cream
// outline, initial in one of two tones from the brand's violet family.
// Circular to match the organic mark/hero language.
const VIOLET = "#9a82f2";
const VIOLET_LIGHT = "#c4b5fd";
const CREAM = "#fbf5e8";
const FILL = "#131316";

const VARIANTS = [VIOLET, VIOLET_LIGHT];

function variantFor(name: string) {
  let h = 0;
  const s = name || "?";
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return VARIANTS[h % VARIANTS.length];
}

export function Avatar({ name, className }: { name: string | null | undefined; className?: string }) {
  const n = (name || "?").trim() || "?";
  const initial = n[0].toUpperCase();
  const letterColor = variantFor(n);
  return (
    <svg
      className={className ? `avatar ${className}` : "avatar"}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10.6" fill={FILL} stroke={CREAM} strokeWidth="1.3" />
      <text
        x="12"
        y="12.7"
        textAnchor="middle"
        dominantBaseline="central"
        fill={letterColor}
        fontFamily="'Space Grotesk', system-ui, sans-serif"
        fontWeight="700"
        fontSize="11"
      >
        {initial}
      </text>
    </svg>
  );
}
