import wowSignalRaw from "./wow-signal.experience.json";
import type { Experience } from "./types";
import { validateExperience } from "./validate";

/** Every experience file the app ships, keyed by the RabbitHole slug it
 *  belongs to. Adding a new interactive RabbitHole is, in the common
 *  case, one new entry here plus one new *.experience.json file -- no
 *  new page, no new routing. */
const RAW_EXPERIENCES: Record<string, unknown> = {
  "the-wow-signal": wowSignalRaw,
};

/** Validates one raw experience payload against a slug. Pure and
 *  side-effect-free (besides the console.error, kept here rather than
 *  thrown so a malformed file can never take the article down with it)
 *  -- separated from loadExperience's static import map and cache
 *  specifically so this behaviour is directly unit-testable without
 *  mocking a JSON module import. */
export function resolveExperience(raw: unknown, slug: string): Experience | null {
  const result = validateExperience(raw);
  if (!result.ok) {
    // eslint-disable-next-line no-console
    console.error(`[experiences] "${slug}" failed validation, falling back to the plain article:`, result.errors);
    return null;
  }
  if (result.experience.slug !== slug) {
    // eslint-disable-next-line no-console
    console.error(
      `[experiences] "${slug}": experience.slug ("${result.experience.slug}") does not match, falling back to the plain article`,
    );
    return null;
  }
  return result.experience;
}

const cache = new Map<string, Experience | null>();

/** Returns the validated experience for a slug, or null if there isn't
 *  one, or if the shipped file fails validation. A RabbitHole with no
 *  experience, and one whose experience is malformed, both render
 *  identically to the plain article -- this is the one place that
 *  guarantee is enforced: every caller gets either a fully valid
 *  Experience or null, never a thrown error. */
export function loadExperience(slug: string): Experience | null {
  if (cache.has(slug)) return cache.get(slug) ?? null;
  const raw = RAW_EXPERIENCES[slug];
  const experience = raw === undefined ? null : resolveExperience(raw, slug);
  cache.set(slug, experience);
  return experience;
}
