import { Link } from "react-router-dom";

/**
 * The lead item in the homepage's Latest section. Static prototype content:
 * "The Wow! Signal" isn't a published RabbitHole yet, so this small object
 * stands in for it and is easy to delete later. `slug` is its intended
 * address, so the "Read RabbitHole" link works once it is published at
 * `/rabbitholes/the-wow-signal`.
 *
 * Renders only the lead feature. The "Latest" eyebrow and the index rows live
 * in <HomeLatest>.
 *
 * The visual is a crop of the real 1977 printout
 * (public/Wow_Signal_Archive_Crop_Wide.webp), not a recreation. Source: Big
 * Ear Radio Observatory, Ohio State University, August 15, 1977, via
 * Wikimedia Commons (public domain).
 */
const WOW_SIGNAL = {
  slug: "the-wow-signal",
  title: "The Wow! Signal",
  hook: "For 72 seconds in 1977, a radio telescope in Ohio picked up a signal unlike anything astronomers expected. Jerry Ehman circled the printout and wrote one word beside it: Wow! It was never detected again.",
  image: {
    src: "/Wow_Signal_Archive_Crop_Wide.webp",
    alt: 'Scan of the 1977 Wow! Signal computer printout with Jerry Ehman’s handwritten "Wow!" annotation and circled signal data.',
    caption: "Big Ear Radio Observatory · Ohio State · August 15, 1977",
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
