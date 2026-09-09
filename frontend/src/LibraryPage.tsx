import { useEffect, useState } from "react";

import { getRabbitHole, type RabbitHole } from "./api";
import { FeaturedRabbitHole } from "./components/home/FeaturedRabbitHole";
import { HomeHero } from "./components/home/HomeHero";
import { useDocumentMeta } from "./hooks/useDocumentMeta";

/**
 * The RabbitHole the homepage leads with. Pinned for now — deliberately not
 * "the newest published one", which is too volatile for the front door. When
 * the API grows a homepage-featured field/config, this is the single line to
 * replace: fetch that slug instead of this constant.
 */
const HOME_FEATURED_SLUG = "how-the-qwerty-keyboard-took-over";

/**
 * Homepage: the hero, then the pinned featured RabbitHole as the entry point
 * (with the connections leading out of it), then a quiet line on what this
 * is. Driven entirely by the live API — no video-catalog dependency.
 */
export function LibraryPage() {
  const [featured, setFeatured] = useState<RabbitHole | null>(null);

  useEffect(() => {
    let live = true;
    getRabbitHole(HOME_FEATURED_SLUG)
      .then((rh) => {
        if (live && rh) setFeatured(rh);
      })
      .catch(() => {
        /* hero still renders; the featured block just stays absent */
      });
    return () => {
      live = false;
    };
  }, []);

  useDocumentMeta();

  // The CTA always points at the pinned RabbitHole, even before (or if) its
  // full detail loads.
  const startHref = `/rabbitholes/${HOME_FEATURED_SLUG}`;

  return (
    <main className="page home-page">
      <HomeHero startHref={startHref} />

      <div className="home-below">
        <div className="home-below-inner">
          {featured && <FeaturedRabbitHole rh={featured} />}

          <section className="home-what" aria-label="What RabbitHole is">
            <ol className="home-what-steps">
              <li>Start with something that catches your eye.</li>
              <li>Follow the connections between subjects.</li>
              <li>Keep going until it stops being interesting.</li>
            </ol>
            <p className="home-what-note">
              Every RabbitHole is short, and every claim is sourced.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
