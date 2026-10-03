import { HomeHero } from "./components/home/HomeHero";
import { HomeVideos } from "./components/home/HomeVideos";
import { useApp } from "./App";
import { useDocumentMeta } from "./hooks/useDocumentMeta";

export function LibraryPage() {
  useDocumentMeta();
  const { videos, loading, live, openUpload } = useApp();
  return (
    <main className="page home-page">
      <HomeHero />
      <div className="home-below">
        <div className="home-below-inner">
          <HomeVideos videos={videos} loading={loading} live={live} onUpload={openUpload} />
        </div>
      </div>
    </main>
  );
}
