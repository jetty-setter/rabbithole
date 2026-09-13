import { HomeHero } from "./components/home/HomeHero";
import { HomeLatest } from "./components/home/HomeLatest";
import { MORE_RABBITHOLES } from "./components/home/moreRabbitHoles";
import { useDocumentMeta } from "./hooks/useDocumentMeta";

export function LibraryPage() {
  useDocumentMeta();
  return (
    <main className="page home-page">
      <HomeHero />
      <div className="home-below">
        <div className="home-below-inner">
          <HomeLatest items={MORE_RABBITHOLES} />
        </div>
      </div>
    </main>
  );
}
