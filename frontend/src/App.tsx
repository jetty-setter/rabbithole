import { useEffect, useRef, useState } from "react";
import { Routes, Route, Outlet, useNavigate, useLocation, useOutletContext } from "react-router-dom";
import {
  getMe,
  setToken,
  listFavorites,
  addFavorite,
  removeFavorite,
  listReactions,
  WS_URL,
  type AuthUser,
  type Video,
} from "./api";
import { useReactions, hydrateAnonReactions } from "./hooks/useReactions";
import { useVideoList } from "./hooks/useVideoList";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { UploadModal } from "./UploadModal";
import { LoginModal } from "./LoginModal";
import { LibraryPage } from "./LibraryPage";
import { TrendingPage } from "./TrendingPage";
import { FreshPage } from "./FreshPage";
import { TunnelsPage } from "./TunnelsPage";
import { TrailPage } from "./TrailPage";
import { DenPage } from "./DenPage";
import { SearchPage } from "./SearchPage";
import { FavoritesPage } from "./FavoritesPage";
import { MyVideosPage } from "./MyVideosPage";
import { WatchPage } from "./WatchPage";
import { AdminPage } from "./AdminPage";

export interface AppCtx {
  videos: Video[];
  loading: boolean;
  refresh: () => void;
  live: boolean;
  authed: boolean;
  isAdmin: boolean;
  username: string | null;
  requireLogin: () => void;
  query: string;
  favorites: Set<string>;
  toggleFavorite: (id: string) => void;
  hopped: Set<string>;
  thumped: Set<string>;
  react: (id: string, reaction: "hop" | "thump") => void;
  diveActive: boolean;
  diveDepth: number;
  startDive: (fromId: string) => void;
  stopDive: () => void;
  nextDive: (currentId: string) => string | null;
  trail: string[];
  recordTrail: (id: string) => void;
  clearTrail: () => void;
}

export const useApp = () => useOutletContext<AppCtx>();

// Watch history ("Trail") — local-only, most-recent-first video ids. Works
// signed-out and never leaves the browser.
const TRAIL_KEY = "rh_trail";
function loadTrail(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(TRAIL_KEY) || "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { videos, setVideos, loading, refresh } = useVideoList();
  const { hopped, setHopped, thumped, setThumped, react: reactCore } = useReactions();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginMode, setLoginMode] = useState<"login" | "signup">("login");
  const [live, setLive] = useState(false);
  const [query, setQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [trail, setTrail] = useState<string[]>(loadTrail);

  const [diveActive, setDiveActive] = useState(false);
  const [diveDepth, setDiveDepth] = useState(0);
  const visitedRef = useRef<Set<string>>(new Set());
  const tumbleHistoryRef = useRef<Set<string>>(new Set());

  const authed = !!user;
  const isAdmin = !!user?.is_admin;

  function loadFavorites() {
    listFavorites().then((f) => setFavorites(new Set(f)));
    listReactions().then((r) => {
      setHopped(new Set(r.hopped));
      setThumped(new Set(r.thumped));
    });
  }

  useEffect(() => {
    getMe().then((u) => {
      setUser(u);
      if (u) loadFavorites();
      else {
        const anon = hydrateAnonReactions();
        setHopped(anon.hopped);
        setThumped(anon.thumped);
      }
    });
    const t = setInterval(refresh, 15000);
    return () => clearInterval(t);
  }, [refresh]);

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
    const anon = hydrateAnonReactions();
    setHopped(anon.hopped);
    setThumped(anon.thumped);
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

  function react(id: string, reaction: "hop" | "thump") {
    reactCore(id, reaction, authed, setVideos);
  }

  function startDive(fromId: string) {
    visitedRef.current = new Set([fromId]);
    setDiveDepth(0);
    setDiveActive(true);
  }

  function stopDive() {
    setDiveActive(false);
    setDiveDepth(0);
  }

  function nextDive(currentId: string): string | null {
    visitedRef.current.add(currentId);
    const ready = videos.filter(
      (v) => v.status === "ready" && !!v.playback_url && v.video_id !== currentId,
    );
    if (ready.length === 0) return null;
    const fresh = ready.filter((v) => !visitedRef.current.has(v.video_id));
    const pool = fresh.length ? fresh : ready;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    setDiveDepth((d) => d + 1);
    return pick.video_id;
  }

  function recordTrail(id: string) {
    setTrail((prev) => {
      const next = [id, ...prev.filter((x) => x !== id)].slice(0, 60);
      localStorage.setItem(TRAIL_KEY, JSON.stringify(next));
      return next;
    });
  }

  function clearTrail() {
    localStorage.removeItem(TRAIL_KEY);
    setTrail([]);
  }

  // Intentional not random-random: never repeats until you've seen everything,
  // and biases toward videos sharing a tag with the current one.
  function tumble() {
    const ready = videos.filter((v) => v.status === "ready" && !!v.playback_url);
    if (!ready.length) return;

    const match = location.pathname.match(/^\/watch\/(.+)$/);
    const currentId = match ? match[1] : null;
    const current = currentId ? ready.find((v) => v.video_id === currentId) : null;

    const pool = ready.filter((v) => v.video_id !== currentId);
    if (!pool.length) return;

    let fresh = pool.filter((v) => !tumbleHistoryRef.current.has(v.video_id));
    if (!fresh.length) {
      tumbleHistoryRef.current = new Set(currentId ? [currentId] : []);
      fresh = pool;
    }

    let candidates = fresh;
    const curTags = new Set((current?.tags || []).map((t) => t.toLowerCase()));
    if (curTags.size) {
      const related = fresh.filter((v) =>
        (v.tags || []).some((t) => curTags.has(t.toLowerCase())),
      );
      if (related.length && Math.random() < 0.7) candidates = related;
    }

    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    tumbleHistoryRef.current.add(pick.video_id);
    navigate(`/watch/${pick.video_id}`);
  }

  const ctx: AppCtx = {
    videos,
    loading,
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
    hopped,
    thumped,
    react,
    diveActive,
    diveDepth,
    startDive,
    stopDive,
    nextDive,
    trail,
    recordTrail,
    clearTrail,
  };

  return (
    <>
      <Header
        authed={authed}
        username={user?.username ?? null}
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
        <div className="main">
          <div className="route-fade" key={location.pathname}>
            <Outlet context={ctx} />
          </div>
        </div>
        <Sidebar
          open={sidebarOpen}
          authed={authed}
          isAdmin={isAdmin}
          onToggle={() => setSidebarOpen((o) => !o)}
          onTumble={tumble}
        />
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
        <Route path="/fresh" element={<FreshPage />} />
        <Route path="/trending" element={<TrendingPage />} />
        <Route path="/tunnels" element={<TunnelsPage />} />
        <Route path="/tunnels/:tag" element={<TunnelsPage />} />
        <Route path="/trail" element={<TrailPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/den" element={<DenPage />} />
        <Route path="/favorites" element={<FavoritesPage />} />
        <Route path="/mine" element={<MyVideosPage />} />
        <Route path="/watch/:id" element={<WatchPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Route>
    </Routes>
  );
}
