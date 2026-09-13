import type { IndexItem } from "./HomeIndexRow";

/**
 * Homepage-only prototype content for the index rows beneath the Wow!
 * Signal lead feature — like WOW_SIGNAL in HomeFeatured.tsx, neither of
 * these exists as a published RabbitHole today (the API's only real record
 * is "How the QWERTY Keyboard Took Over"). `slug` already points at each
 * record's intended address, so "Read RabbitHole" starts working the
 * moment something is published there; nothing here has to change.
 *
 * Both are text-only (no `imageUrl`): this environment's network egress
 * policy blocks Wikimedia Commons and other general web hosts, so a real,
 * rights-cleared image could not be sourced and verified this pass. Add
 * `imageUrl` once a genuine archival image with documented usage rights is
 * available — HomeIndexRow already renders it when present.
 */
export const MORE_RABBITHOLES: IndexItem[] = [
  {
    slug: "the-voynich-manuscript",
    title: "The Voynich Manuscript",
    hook: "For more than a century, scholars have tried to decipher a medieval manuscript filled with an unknown script, strange diagrams, and plants that may not exist.",
    metadata: "15th century · Unknown author",
  },
  {
    slug: "the-dancing-plague-of-1518",
    title: "The Dancing Plague of 1518",
    hook: "In the summer of 1518, people in Strasbourg began dancing and did not stop. Within weeks, the unexplained outbreak had drawn in hundreds.",
    metadata: "Strasbourg · 1518",
  },
];
