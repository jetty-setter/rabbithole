import { useEffect, useRef, useState } from "react";
import { Routes, Route, Outlet, useOutletContext } from "react-router-dom";
import {
  getMe,
  setToken,
  listVideos,
  listFavorites,
  addFavorite,
  removeFavorite,
  listReactions,
  setReaction,
  vote,
  WS_URL,
  type AuthUser,
  type Reaction,
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
  hopped: Set<string>;
  thumped: Set<string>;
  react: (id: string, reaction: "hop" | "thump") => void;
  // Dive mode — "down the rabbit hole"
  diveActive: boolean;
  diveDepth: number;
  startDive: (fromId: string) => void;
  stopDive: () => void;
  nextDive: (currentId: string) => string | null;
}

export const useApp = () => useOutletContext<AppCtx>();

// Anonymous votes live in localStorage so a browser remembers its own choice
// (and can't trivially double-count) without needing an account.
const ANON_KEY = "rh_votes";
type AnonVotes = Record<string, "hop" | "thump">;
function loadAnonVotes(): AnonVotes {
  try {
    return JSON.parse(localStorage.getItem(ANON_KEY) || "{}");
  } catch {
    return {};
  }
}
function saveAnonVote(id: string, r: "hop" | "thump" | null) {
  const m = loadAnonVotes();
  if (r) m[id] = r;
  else delete m[id];
  localStorage.setItem(ANON_KEY, JSON.stringify(m));
}

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
  const [hopped, setHopped] = useState<Set<string>>(new Set());
  const [thumped, setThumped] = useState<Set<string>>(new Set());

  const [diveActive, setDiveActive] = useState(false);
  const [diveDepth, setDiveDepth] = useState(0);
  const visitedRef = useRef<Set<string>>(new Set());

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
    listReactions().then((r) => {
      setHopped(new Set(r.hopped));
      setThumped(new Set(r.thumped));
    });
  }

  function hydrateAnonReactions() {
    const m = loadAnonVotes();
    setHopped(new Set(Object.keys(m).filter((k) => m[k] === "hop")));
    setThumped(new Set(Object.keys(m).filter((k) => m[k] === "thump")));
  }

  useEffect(() => {
    refresh();
    getMe().then((u) => {
      setUser(u);
      if (u) loadFavorites();
      else hydrateAnonReactions();
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
    hydrateAnonReactions();
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

  // Hop = approve, Thump = disapprove. Mutually exclusive; clicking the
  // active one clears it. Counts update optimistically.
  function react(id: string, reaction: "hop" | "thump") {
    const wasHop = hopped.has(id);
    const wasThump = thumped.has(id);
    const from: Reaction = wasHop ? "hop" : wasThump ? "thump" : null;
    const next: Reaction =
      reaction === "hop" ? (wasHop ? null : "hop") : wasThump ? null : "thump";

    setHopped((prev) => {
      const s = new Set(prev);
      next === "hop" ? s.add(id) : s.delete(id);
      return s;
    });
    setThumped((prev) => {
      const s = new Set(prev);
      next === "thump" ? s.add(id) : s.delete(id);
      return s;
    });

    const dHop = (next === "hop" ? 1 : 0) - (wasHop ? 1 : 0);
    const dThump = (next === "thump" ? 1 : 0) - (wasThump ? 1 : 0);
    setVideos((prev) =>
      prev.map((v) =>
        v.video_id === id
          ? {
              ...v,
              hops: Math.max(0, (v.hops ?? 0) + dHop),
              thumps: Math.max(0, (v.thumps ?? 0) + dThump),
            }
          : v,
      ),
    );

    if (authed) {
      setReaction(id, next); // server tracks per-user
    } else {
      saveAnonVote(id, next); // browser remembers its own vote
      vote(id, from, next);
    }
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

  // Pick the next video to fall into — prefers ones you haven't seen this dive.
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
    hopped,
    thumped,
    react,
    diveActive,
    diveDepth,
    startDive,
    stopDive,
    nextDive,
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
        <Sidebar
          open={sidebarOpen}
          authed={authed}
          isAdmin={isAdmin}
          onToggle={() => setSidebarOpen((o) => !o)}
        />
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
