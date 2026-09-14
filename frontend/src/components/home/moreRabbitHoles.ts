import type { IndexItem } from "./HomeIndexRow";

/**
 * Homepage-only prototype content for the index grid beneath the Wow!
 * Signal lead feature — like WOW_SIGNAL in HomeFeatured.tsx, none of these
 * exist as a published RabbitHole today (the API's only real record is
 * "How the QWERTY Keyboard Took Over"). `slug` already points at each
 * record's intended address, so "Read RabbitHole" starts working the
 * moment something is published there; nothing here has to change.
 *
 * All four images are real archival/documentary assets (prepared and
 * provided directly for this homepage tier, not generated) rather than
 * placeholders:
 *  - Voynich: a crop of an illustrated page from the Voynich Manuscript
 *    (Beinecke Rare Book & Manuscript Library, Yale) showing its unknown
 *    script beside a botanical drawing of a plant with no known real-world
 *    match.
 *  - Dancing Plague: a period engraving depicting the 1518 Strasbourg
 *    dancing mania in a village square.
 *  - Lake Nyos: a USGS aerial photograph of the lake itself, showing the
 *    exposed shoreline rock left by the 1986 gas release.
 *  - Tunguska: an original black-and-white photograph of the Siberian
 *    forest flattened by the 1908 event.
 *
 * The homepage is curated, not a feed: this tier is a fixed 2x2 grid (see
 * the .home-latest-index CSS), not a growing list. Order here is DOM/
 * reading order, which the grid auto-places left-to-right, top-to-bottom
 * -- Voynich and Dancing Plague form row 1, Lake Nyos and Tunguska row 2.
 * Every module uses the same image-above-text composition (see
 * HomeIndexRow) -- no alternation to configure per item.
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
  {
    slug: "lake-nyos",
    title: "Lake Nyos",
    hook: "A lake released an invisible cloud that killed more than 1,700 people.",
    metadata: "Cameroon · August 21, 1986",
    imageUrl: "/RabbitHole_Lake_Nyos_USGS_Crop_v2.webp",
    imageAlt:
      "Lake Nyos in Cameroon, showing the lake surrounded by green volcanic hills and exposed rock along the shoreline.",
  },
  {
    slug: "the-tunguska-event",
    title: "The Tunguska Event",
    hook: "Something exploded over Siberia and flattened millions of trees.",
    metadata: "Siberia · June 30, 1908",
    imageUrl: "/RabbitHole_Tunguska_Original_Crop_v2.webp",
    imageAlt:
      "Black-and-white photograph of trees flattened across the Siberian landscape after the Tunguska event.",
  },
];
