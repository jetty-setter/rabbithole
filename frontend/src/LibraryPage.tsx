import { HomeHero } from "./components/home/HomeHero";
import { HomeVideos } from "./components/home/HomeVideos";
import { useApp } from "./App";
import { useDocumentMeta } from "./hooks/useDocumentMeta";

export function LibraryPage() {
  useDocumentMeta();
  const { videos, loading, live, openUpload, openExternal, isAdmin, username, catalogError, refresh } = useApp();
  return (
    <main className="page home-page">
      <HomeHero videos={videos} />
      <div className="home-below">
        <div className="home-below-inner">
          {catalogError && <p role="alert">The video catalog could not be loaded. <button className="btn-ghost" onClick={refresh}>Try again</button></p>}
          {(!catalogError || videos.length > 0) && <HomeVideos videos={videos} loading={loading} live={live} onUpload={openUpload} onAddExternal={isAdmin ? openExternal : undefined} username={username} isAdmin={isAdmin} />}
        </div>
      </div>
    </main>
  );
}
