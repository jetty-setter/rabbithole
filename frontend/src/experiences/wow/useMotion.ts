import { useEffect, useState } from "react";

/** True once the user's OS/browser asks for reduced motion. Live -- updates
 *  if the preference changes while the page is open. The stage reads this
 *  to fall back to WowReducedStage's discrete states while keeping every
 *  control and every fact fully present. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  return reduced;
}
