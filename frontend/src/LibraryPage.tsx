import { HomeFeatured } from "./components/home/HomeFeatured";
import { HomeHero } from "./components/home/HomeHero";
import { useDocumentMeta } from "./hooks/useDocumentMeta";

export function LibraryPage() {
  useDocumentMeta();
  return (
    <main className="page home-page">
      <HomeHero />
      <div className="home-below">
        <div className="home-below-inner">
          <HomeFeatured />
        </div>
      </div>
    </main>
  );
}
