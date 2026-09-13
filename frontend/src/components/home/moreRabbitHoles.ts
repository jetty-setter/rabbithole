import type { IndexItem } from "./HomeIndexRow";

/**
 * Homepage-only prototype content for the index rows beneath the Wow!
 * Signal lead feature — like WOW_SIGNAL in HomeFeatured.tsx, neither of
 * these exists as a published RabbitHole today (the API's only real record
 * is "How the QWERTY Keyboard Took Over"). `slug` already points at each
 * record's intended address, so "Read RabbitHole" starts working the
 * moment something is published there; nothing here has to change.
 *
 * Both images are real archival assets (prepared and provided directly for
 * this homepage tier, not generated) rather than placeholders:
 *  - Voynich: a crop of an illustrated page from the Voynich Manuscript
 *    (Beinecke Rare Book & Manuscript Library, Yale) showing its unknown
 *    script beside a botanical drawing of a plant with no known real-world
 *    match.
 *  - Dancing Plague: a period engraving depicting the 1518 Strasbourg
 *    dancing mania in a village square.
 *
 * The homepage is curated, not a feed: the intended total is 1 lead
 * feature + 3 of these large rows. There's room for one more here once a
 * third story has real content and rights-cleared (or intentionally
 * text-only) imagery -- don't add one speculatively. `imageSide` on
 * IndexItem can pin a new item's side explicitly if simple left/right
 * alternation isn't the right call for it.
 */
export const MORE_RABBITHOLES: IndexItem[] = [
  {
    slug: "the-voynich-manuscript",
    title: "The Voynich Manuscript",
    hook: "Nobody has convincingly read it.",
    metadata: "15th century · Unknown author",
    imageUrl: "/Voynich_Manuscript_Archive_Crop.webp",
    imageAlt:
      "A page from the Voynich Manuscript, showing lines of unidentified handwritten script beside a watercolor drawing of an unidentified plant.",
  },
  {
    slug: "the-dancing-plague-of-1518",
    title: "The Dancing Plague of 1518",
    hook: "Hundreds danced. No one agrees why.",
    metadata: "Strasbourg · 1518",
    imageUrl: "/engraved_dancing_plague_in_a_village_square.webp",
    imageAlt:
      "A period engraving of townspeople dancing together in a village square during the 1518 Strasbourg dancing plague.",
  },
];
