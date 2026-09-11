import { Link } from "react-router-dom";

/**
 * Homepage "Latest" feature — currently static prototype content.
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
 */
const WOW_SIGNAL = {
  slug: "the-wow-signal",
  title: "The Wow! Signal",
  hook: "For 72 seconds in 1977, a radio telescope in Ohio detected a signal so unusual that astronomer Jerry Ehman circled the printout and wrote one word beside it: Wow! It was never detected again.",
};

export function HomeFeatured() {
  return (
    <section className="home-featured" aria-label="Latest">
      <p className="home-featured-eyebrow">Latest</p>
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
        {/* The recorded signal strength code from the original printout,
            not a decorative graphic — this is the one piece of real
            visual material a typographic-only treatment can use honestly. */}
        <div className="home-featured-visual" aria-hidden="true">
          <p className="home-featured-code">6EQUJ5</p>
          <p className="home-featured-caption">
            Big Ear Radio Observatory &middot; Ohio State &middot; August 15,
            1977
          </p>
        </div>
      </div>
    </section>
  );
}
