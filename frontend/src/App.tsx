import { useEffect, useState } from "react";
import { Routes, Route, Outlet, useOutletContext } from "react-router-dom";
import {
  getMe,
  setToken,
  listVideos,
  listFavorites,
  addFavorite,
  removeFavorite,
  listLikes,
  likeVideo,
  unlikeVideo,
  WS_URL,
  type AuthUser,
  type Video,
} from "./api";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { UploadModal } from "./UploadModal";
import { LoginModal } from "./LoginModal";
import { LibraryPage } from "./LibraryPage";
import { TrendingPage } from "./TrendingPage";
import { FavoritesPage } from "./FavoritesPage";
import { MyVideosPage } from "./MyVideosPage";
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
  favorites: Set<string>;
  toggleFavorite: (id: string) => void;
  liked: Set<string>;
  toggleLike: (id: string) => void;
}

export const useApp = () => useOutletContext<AppCtx>();

function Layout() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginMode, setLoginMode] = useState<"login" | "signup">("login");
  const [live, setLive] = useState(false);
  const [query, setQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [liked, setLiked] = useState<Set<string>>(new Set());

  const authed = !!user;
  const isAdmin = !!user?.is_admin;

  async function refresh() {
    try {
      setVideos(await listVideos());
    } catch {
      /* keep last good list */
    }
  }

  function loadFavorites() {
    listFavorites().then((f) => setFavorites(new Set(f)));
    listLikes().then((l) => setLiked(new Set(l)));
  }

  useEffect(() => {
    refresh();
    getMe().then((u) => {
      setUser(u);
      if (u) loadFavorites();
    });
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
    setFavorites(new Set());
    setLiked(new Set());
  }

  function toggleFavorite(id: string) {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        removeFavorite(id);
      } else {
        next.add(id);
        addFavorite(id);
      }
      return next;
    });
  }

  function toggleLike(id: string) {
    const willLike = !liked.has(id);
    setLiked((prev) => {
      const next = new Set(prev);
      if (willLike) {
        next.add(id);
        likeVideo(id);
      } else {
        next.delete(id);
        unlikeVideo(id);
      }
      return next;
    });
    // Reflect the public count immediately.
    setVideos((prev) =>
      prev.map((v) =>
        v.video_id === id
          ? { ...v, likes: Math.max(0, (v.likes ?? 0) + (willLike ? 1 : -1)) }
          : v,
      ),
    );
  }

  const ctx: AppCtx = {
    videos,
    refresh,
    live,
    authed,
    isAdmin,
    username: user?.username ?? null,
    requireLogin: () => {
      setLoginMode("login");
      setLoginOpen(true);
    },
    query,
    favorites,
    toggleFavorite,
    liked,
    toggleLike,
  };

  return (
    <>
      <Header
        authed={authed}
        username={user?.username ?? null}
        onToggleSidebar={() => setSidebarOpen((o) => !o)}
        onUpload={() => setUploadOpen(true)}
        onLogin={() => {
          setLoginMode("login");
          setLoginOpen(true);
        }}
        onSignup={() => {
          setLoginMode("signup");
          setLoginOpen(true);
        }}
        onLogout={logout}
        query={query}
        setQuery={setQuery}
      />
      <div className="shell">
        <Sidebar open={sidebarOpen} authed={authed} isAdmin={isAdmin} />
        <div className="main">
          <Outlet context={ctx} />
        </div>
      </div>
      {uploadOpen && <UploadModal onClose={() => setUploadOpen(false)} onUploaded={refresh} />}
      {loginOpen && (
        <LoginModal
          initialMode={loginMode}
          onClose={() => setLoginOpen(false)}
          onSuccess={(u) => {
            setUser(u);
            loadFavorites();
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
        <Route path="/trending" element={<TrendingPage />} />
        <Route path="/favorites" element={<FavoritesPage />} />
        <Route path="/mine" element={<MyVideosPage />} />
        <Route path="/watch/:id" element={<WatchPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Route>
    </Routes>
  );
}
