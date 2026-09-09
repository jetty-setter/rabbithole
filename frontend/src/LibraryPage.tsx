import { useEffect, useState } from "react";

import { getRabbitHole, listRabbitHoles, type RabbitHole } from "./api";
import { FeaturedRabbitHole } from "./components/home/FeaturedRabbitHole";
import { HomeHero } from "./components/home/HomeHero";
import { useDocumentMeta } from "./hooks/useDocumentMeta";

const FALLBACK_SLUG = "how-the-qwerty-keyboard-took-over";

/**
 * Homepage: the hero, then the most recent published RabbitHole as the entry
 * point (with the connections leading out of it), then a quiet line on what
 * this is. Driven entirely by the live API — no video-catalog dependency.
 */
export function LibraryPage() {
  const [featured, setFeatured] = useState<RabbitHole | null>(null);

  useEffect(() => {
    let live = true;
    listRabbitHoles(1)
      .then((items) => (items[0] ? getRabbitHole(items[0].slug) : null))
      .then((rh) => {
        if (live && rh) setFeatured(rh);
      })
      .catch(() => {
        /* homepage still works without a featured piece */
      });
    return () => {
      live = false;
    };
  }, []);

  useDocumentMeta();

  const startHref = featured ? `/rabbitholes/${featured.slug}` : `/rabbitholes/${FALLBACK_SLUG}`;

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
