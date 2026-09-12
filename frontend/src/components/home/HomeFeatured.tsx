import { Link } from "react-router-dom";

/**
 * The lead item in the homepage's Latest section — currently static
 * prototype content.
 *
 * "The Wow! Signal" is not yet a published RabbitHole: the only record the
 * API has today is "How the QWERTY Keyboard Took Over". Rather than invent
 * a fake backend entry, this is temporary copy for the homepage's featured
 * slot, kept in one small object so it's obvious what to delete once a real
 * record exists. `slug` already points at that record's intended address —
 * the "Read RabbitHole" link starts working the moment something is
 * published at `/rabbitholes/the-wow-signal`; nothing here has to change.
 * QWERTY itself is untouched and still reachable directly and via search —
 * it's just no longer the thing the homepage leads with.
 *
 * This component renders only the lead feature (title, hook, action,
 * visual). The "Latest" eyebrow and any subsequent, tighter index rows for
 * further published RabbitHoles live in the wrapping <HomeLatest>.
 *
 * The visual is a crop of the real 1977 printout (Wow_Signal_Archive_Crop_
 * Wide.webp, in public/) rather than a typeset recreation — an actual
 * historical artifact reads as more honest here than a designed graphic.
 * Source: Big Ear Radio Observatory, Ohio State University, August 15,
 * 1977. Via Wikimedia Commons, listed there as public domain / ineligible
 * for copyright (factual data + a handwritten annotation).
 */
const WOW_SIGNAL = {
  slug: "the-wow-signal",
  title: "The Wow! Signal",
  hook: "For 72 seconds in 1977, a radio telescope in Ohio picked up a signal unlike anything astronomers expected. Jerry Ehman circled the printout and wrote one word beside it: Wow! It was never detected again.",
  image: {
    src: "/Wow_Signal_Archive_Crop_Wide.webp",
    alt: 'Scan of the 1977 Wow! Signal computer printout with Jerry Ehman’s handwritten "Wow!" annotation and circled signal data.',
    caption: "Big Ear Radio Observatory · August 15, 1977",
  },
};

export function HomeFeatured() {
  return (
    <article className="home-featured">
      <div className="home-featured-grid">
        <div className="home-featured-text">
          <h2 className="home-featured-title">{WOW_SIGNAL.title}</h2>
          <p className="home-featured-hook">{WOW_SIGNAL.hook}</p>
          <Link
            to={`/rabbitholes/${WOW_SIGNAL.slug}`}
            className="home-featured-action"
          >
            Read RabbitHole
          </Link>
        </div>
        <div className="home-featured-visual">
          <img
            src={WOW_SIGNAL.image.src}
            alt={WOW_SIGNAL.image.alt}
            className="home-featured-image"
            loading="lazy"
          />
          <p className="home-featured-caption">{WOW_SIGNAL.image.caption}</p>
        </div>
      </div>
    </article>
  );
}
