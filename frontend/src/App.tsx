import { useEffect, useState } from "react";
import { Routes, Route, Outlet, useOutletContext } from "react-router-dom";
import { getToken, setToken, listVideos, WS_URL, type Video } from "./api";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { UploadModal } from "./UploadModal";
import { PlayerModal } from "./PlayerModal";
import { LoginModal } from "./LoginModal";
import { LibraryPage } from "./LibraryPage";
import { AdminPage } from "./AdminPage";

export interface AppCtx {
  videos: Video[];
  refresh: () => void;
  live: boolean;
  play: (v: Video) => void;
  authed: boolean;
  requireLogin: () => void;
  query: string;
}

export const useApp = () => useOutletContext<AppCtx>();

function Layout() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [selected, setSelected] = useState<Video | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [live, setLive] = useState(false);
  const [query, setQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [token, setTok] = useState<string | null>(() => getToken());
  const authed = !!token;

  async function refresh() {
    try {
      setVideos(await listVideos());
    } catch {
      /* keep last good list */
    }
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 15000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!WS_URL) return;
    let ws: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout>;
    const connect = () => {
      ws = new WebSocket(WS_URL!);
      ws.onopen = () => setLive(true);
      ws.onmessage = () => refresh();
      ws.onclose = () => {
        setLive(false);
        retry = setTimeout(connect, 3000);
      };
      ws.onerror = () => ws?.close();
    };
    connect();
    return () => {
      clearTimeout(retry);
      ws?.close();
    };
  }, []);

  function logout() {
    setToken(null);
    setTok(null);
  }

  const ctx: AppCtx = {
    videos,
    refresh,
    live,
    play: setSelected,
    authed,
    requireLogin: () => setLoginOpen(true),
    query,
  };

  return (
    <>
      <Header
        authed={authed}
        onToggleSidebar={() => setSidebarOpen((o) => !o)}
        onUpload={() => setUploadOpen(true)}
        onLogin={() => setLoginOpen(true)}
        onLogout={logout}
        query={query}
        setQuery={setQuery}
      />
      <div className="shell">
        <Sidebar
          open={sidebarOpen}
          authed={authed}
          onUpload={() => setUploadOpen(true)}
          onLogin={() => setLoginOpen(true)}
        />
        <div className="main">
          <Outlet context={ctx} />
        </div>
      </div>
      {uploadOpen && <UploadModal onClose={() => setUploadOpen(false)} onUploaded={refresh} />}
      {selected?.playback_url && (
        <PlayerModal video={selected} onClose={() => setSelected(null)} />
      )}
      {loginOpen && (
        <LoginModal
          onClose={() => setLoginOpen(false)}
          onSuccess={(t) => {
            setTok(t);
            setLoginOpen(false);
          }}
        />
      )}
    </>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<LibraryPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Route>
    </Routes>
  );
}
