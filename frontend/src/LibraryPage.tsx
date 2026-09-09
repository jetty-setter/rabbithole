import { useEffect, useState } from "react";

import { listRabbitHoles, type RabbitHoleListItem } from "./api";
import { HomeAbout } from "./components/home/HomeAbout";
import { HomeDiscovery } from "./components/home/HomeDiscovery";
import { HomeHero } from "./components/home/HomeHero";
import { useDocumentMeta } from "./hooks/useDocumentMeta";

/**
 * Where "Start somewhere" points before the published feed has loaded, and if
 * the request fails. QWERTY is the RabbitHole known to be live. This is a
 * resilience fallback only. The homepage is not built around it and never
 * shows it as homepage content.
 */
const FALLBACK_SLUG = "how-the-qwerty-keyboard-took-over";

/**
 * Homepage: the hero, a short statement of what RabbitHole is, and — once
 * enough RabbitHoles are published — a small editorial list to browse. The
 * hero renders immediately; everything below waits on the live feed and simply
 * stays absent until there is real content to show.
 */
export function LibraryPage() {
  const [published, setPublished] = useState<RabbitHoleListItem[] | null>(null);
  const [startSlug, setStartSlug] = useState(FALLBACK_SLUG);

  useEffect(() => {
    let live = true;
    // listRabbitHoles() swallows its own errors and resolves to [].
    listRabbitHoles(24).then((items) => {
      if (!live) return;
      setPublished(items);
      if (items.length > 0) {
        // Drop the visitor into a real published RabbitHole. Random, chosen
        // once, never surfaced in the UI.
        const pick = items[Math.floor(Math.random() * items.length)];
        setStartSlug(pick.slug);
      }
    });
    return () => {
      live = false;
    };
  }, []);

  useDocumentMeta();

  const discovery = published ?? [];

  return (
    <main className="page home-page">
      <HomeHero startHref={`/rabbitholes/${startSlug}`} />

      <div className="home-below">
        <div className="home-below-inner">
          <HomeAbout />
          {discovery.length >= 2 && (
            <HomeDiscovery items={discovery.slice(0, 5)} />
          )}
        </div>
      </div>
    </main>
  );
}
