import { useEffect, useState } from "react";

import { getRabbitHole, listRabbitHoles, type RabbitHole } from "./api";
import { HomeHero } from "./components/home/HomeHero";
import { HomeLatest } from "./components/home/HomeLatest";
import { useDocumentMeta } from "./hooks/useDocumentMeta";

/** How many recent RabbitHoles the homepage index shows once there are enough. */
const HOME_LATEST_LIMIT = 5;

/**
 * Homepage: the locked hero, then straight into the most recent published
 * RabbitHoles. No explanation block between them. Everything below the hero
 * comes from the live feed; the hero itself never waits on it.
 */
export function LibraryPage() {
  const [entries, setEntries] = useState<RabbitHole[]>([]);

  useEffect(() => {
    let live = true;
    // listRabbitHoles() resolves to [] on any error.
    listRabbitHoles(24)
      .then(async (list) => {
        if (!live || list.length === 0) return;

        // The index needs each RabbitHole's hook / short_version, which only
        // come with the full record.
        const full = await Promise.all(
          list
            .slice(0, HOME_LATEST_LIMIT)
            .map((it) => getRabbitHole(it.slug).catch(() => null)),
        );
        if (live) {
          setEntries(full.filter((rh): rh is RabbitHole => rh !== null));
        }
      })
      .catch(() => {
        /* hero still renders; the index just stays empty */
      });
    return () => {
      live = false;
    };
  }, []);

  useDocumentMeta();

  return (
    <main className="page home-page">
      <HomeHero />

      {entries.length > 0 && (
        <div className="home-below">
          <div className="home-below-inner">
            <HomeLatest items={entries} />
          </div>
        </div>
      )}
    </main>
  );
}
