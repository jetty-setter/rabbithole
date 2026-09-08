import type { CredibilityState } from "../../api";

/** A small epistemic label. Never rendered for Established claims (in
 *  "What we know") — the default carries no chip. Not colour-only: each
 *  variant also carries its word and a distinct outline. The palette is
 *  restrained on purpose — this is an epistemic signal, not an alarm. */
export function StateChip({ state }: { state: CredibilityState | "established" }) {
  const label: Record<string, string> = {
    established: "Established",
    contested: "Contested",
    unsupported: "Unsupported",
    debunked: "Debunked",
  };
  return (
    <span className={`rh-chip rh-chip--${state}`} data-state={state}>
      {label[state]}
    </span>
  );
}

/** The "why this isn't the whole story" line under a contested claim or a
 *  non-Established fact. Quiet, but clearly the limitation. */
export function Limitation({ text }: { text: string }) {
  return (
    <p className="rh-limit">
      <span className="rh-limit-tag">The limit</span>
      {text}
    </p>
  );
}

/** A hung section heading. On desktop it sits in the left margin; on mobile
 *  it stacks above its content. `id` gives inline citations / the sources
 *  jump a stable anchor. */
export function SectionHeading({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <h2 className="rh-section-h" id={id}>
      <span className="rh-section-h-tick" aria-hidden="true" />
      {children}
    </h2>
  );
}
