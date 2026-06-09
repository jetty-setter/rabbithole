import { useEffect, useState } from "react";
import { Routes, Route, Outlet, useOutletContext } from "react-router-dom";
import { getMe, setToken, listVideos, WS_URL, type AuthUser, type Video } from "./api";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { UploadModal } from "./UploadModal";
import { LoginModal } from "./LoginModal";
import { LibraryPage } from "./LibraryPage";
import { WatchPage } from "./WatchPage";
import { AdminPage } from "./AdminPage";

export interface AppCtx {
  videos: Video[];
  refresh: () => void;
  live: boolean;
  authed: boolean;
  isAdmin: boolean;
  username: string | null;
  requireLogin: () => void;
  query: string;
}

export const useApp = () => useOutletContext<AppCtx>();

function Layout() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [live, setLive] = useState(false);
  const [query, setQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);

  const authed = !!user;
  const isAdmin = !!user?.is_admin;

  async function refresh() {
    try {
      setVideos(await listVideos());
    } catch {
      /* keep last good list */
    }
  }

  useEffect(() => {
    refresh();
    getMe().then(setUser);
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
    setUser(null);
  }

  const ctx: AppCtx = {
    videos,
    refresh,
    live,
    authed,
    isAdmin,
    username: user?.username ?? null,
    requireLogin: () => setLoginOpen(true),
    query,
  };

  return (
    <>
      <Header
        authed={authed}
        username={user?.username ?? null}
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
          isAdmin={isAdmin}
          onUpload={() => setUploadOpen(true)}
          onLogin={() => setLoginOpen(true)}
        />
        <div className="main">
          <Outlet context={ctx} />
        </div>
      </div>
      {uploadOpen && <UploadModal onClose={() => setUploadOpen(false)} onUploaded={refresh} />}
      {loginOpen && (
        <LoginModal
          onClose={() => setLoginOpen(false)}
          onSuccess={(u) => {
            setUser(u);
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
        <Route path="/watch/:id" element={<WatchPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Route>
    </Routes>
  );
}
