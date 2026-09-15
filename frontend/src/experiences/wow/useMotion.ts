import { useEffect, useRef, useState } from "react";

/** True once the user's OS/browser asks for reduced motion. Live -- updates
 *  if the preference changes while the page is open. Every scene in the
 *  Wow! Signal experience reads this to skip continuous animation while
 *  keeping every control and every fact fully present. */
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

/** Tracks whether an element is substantially in the viewport, for
 *  scroll-driven scene reveals. Not scroll-hijacking -- the browser's own
 *  scroll is untouched; this only toggles a class used for a CSS
 *  opacity/transform transition. Defaults to `true` before the observer
 *  has run a first check, so content is never hidden if IntersectionObserver
 *  is unavailable or slow to attach. */
export function useInView<T extends HTMLElement>(threshold = 0.35) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    setInView(false);
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, inView };
}
