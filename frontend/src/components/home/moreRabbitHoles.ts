import type { IndexItem } from "./HomeIndexRow";

/**
 * Prototype content for the homepage index grid under the Wow! Signal lead,
 * like WOW_SIGNAL in HomeFeatured.tsx. None of these are published
 * RabbitHoles yet. Each `slug` is its intended address, so "Read RabbitHole"
 * works as soon as one is published.
 *
 * The images are real archival assets: the Voynich Manuscript (Beinecke
 * Library, Yale), a period engraving of the 1518 dancing plague, a USGS aerial
 * photo of Lake Nyos, and a photo of the forest flattened at Tunguska.
 *
 * Order is reading order in the two-column grid: Voynich and Dancing Plague
 * on row 1, Lake Nyos and Tunguska on row 2.
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
      "Lake Nyos in Cameroon, surrounded by green volcanic hills with exposed rock along the shoreline.",
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
