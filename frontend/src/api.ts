const API_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

const TOKEN_KEY = "rh_token";
export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY);
export const setToken = (t: string | null): void => {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
};

function authHeaders(): Record<string, string> {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export interface AuthUser {
  username: string;
  is_admin: boolean;
}

export async function login(username: string, password: string): Promise<AuthUser> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error("Invalid username or password");
  const data = await res.json();
  setToken(data.token);
  return { username: data.username, is_admin: data.is_admin };
}

export async function signup(username: string, password: string): Promise<AuthUser> {
  const res = await fetch(`${API_URL}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (res.status === 409) throw new Error("That username is taken");
  if (res.status === 422) throw new Error("Username 3+ chars, password 6+ chars");
  if (!res.ok) throw new Error("Could not create account");
  const data = await res.json();
  setToken(data.token);
  return { username: data.username, is_admin: data.is_admin };
}

export async function listFavorites(): Promise<string[]> {
  if (!getToken()) return [];
  const res = await fetch(`${API_URL}/favorites`, { headers: { ...authHeaders() } });
  if (!res.ok) return [];
  return (await res.json()).favorites ?? [];
}

export async function addFavorite(id: string): Promise<void> {
  await fetch(`${API_URL}/favorites/${id}`, { method: "POST", headers: { ...authHeaders() } });
}

export async function removeFavorite(id: string): Promise<void> {
  await fetch(`${API_URL}/favorites/${id}`, { method: "DELETE", headers: { ...authHeaders() } });
}

export async function listReactions(): Promise<{ hopped: string[]; thumped: string[] }> {
  if (!getToken()) return { hopped: [], thumped: [] };
  const res = await fetch(`${API_URL}/reactions`, { headers: { ...authHeaders() } });
  if (!res.ok) return { hopped: [], thumped: [] };
  const d = await res.json();
  return { hopped: d.hopped ?? [], thumped: d.thumped ?? [] };
}

export async function setReaction(id: string, reaction: Reaction): Promise<void> {
  await fetch(`${API_URL}/videos/${id}/reaction`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ reaction }),
  });
}

/** Anonymous vote — moves the public counters by the transition. No auth. */
export async function vote(id: string, from: Reaction, to: Reaction): Promise<void> {
  await fetch(`${API_URL}/videos/${id}/vote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ from, to }),
  });
}

export async function listComments(id: string): Promise<Comment[]> {
  const res = await fetch(`${API_URL}/videos/${id}/comments`);
  if (!res.ok) return [];
  return res.json();
}

export async function addComment(id: string, text: string): Promise<Comment> {
  const res = await fetch(`${API_URL}/videos/${id}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`comment failed (${res.status})`);
  return res.json();
}

export async function deleteComment(videoId: string, commentId: string): Promise<void> {
  await fetch(`${API_URL}/videos/${videoId}/comments/${encodeURIComponent(commentId)}`, {
    method: "DELETE",
    headers: { ...authHeaders() },
  });
}

export async function getMe(): Promise<AuthUser | null> {
  if (!getToken()) return null;
  const res = await fetch(`${API_URL}/auth/me`, { headers: { ...authHeaders() } });
  if (!res.ok) {
    setToken(null);
    return null;
  }
  return res.json();
}

export interface Video {
  video_id: string;
  filename: string;
  status: string;
  created_at: string;
  playback_url?: string | null;
  thumbnail_url?: string | null;
  duration_seconds?: string | null;
  cost_usd?: string | null;
  owner?: string | null;
  title?: string | null;
  description?: string | null;
  views?: number;
  hops?: number;
  thumps?: number;
  tags?: string[];
  ai_generated?: boolean;
  has_transcript?: boolean;
  transcribing?: boolean;
  transcript_url?: string | null;
  captions_url?: string | null;
  visibility?: string;
}

export interface Cue {
  start: number;
  end: number;
  text: string;
}

/** Fetch the caption cues (served from the streaming CDN). Best-effort. */
export async function fetchCues(url: string): Promise<Cue[]> {
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export type Reaction = "hop" | "thump" | null;

export interface Comment {
  video_id: string;
  comment_id: string;
  author: string;
  text: string;
  created_at: string;
}

export const WS_URL: string | undefined = import.meta.env.VITE_WS_URL;

export const STATUS_LABEL: Record<string, string> = {
  pending_upload: "Awaiting upload",
  uploaded: "Queued",
  processing: "Transcoding",
  ready: "Ready",
  failed: "Failed",
};

export async function deleteVideo(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/videos/${id}`, {
    method: "DELETE",
    headers: { ...authHeaders() },
  });
  if (!res.ok && res.status !== 204) throw new Error(`delete failed (${res.status})`);
}

export interface UploadTicket {
  video_id: string;
  upload_url: string;
  key: string;
}

export async function createUpload(
  filename: string,
  contentType: string,
  title?: string,
  description?: string,
  tags?: string[],
  visibility?: string,
): Promise<UploadTicket> {
  const res = await fetch(`${API_URL}/uploads`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({
      filename,
      content_type: contentType,
      title,
      description,
      tags,
      visibility,
    }),
  });
  if (!res.ok) throw new Error(`createUpload failed (${res.status})`);
  return res.json();
}

export interface Suggestion {
  title: string;
  description: string;
  tags: string[];
}

/** Ask the AI for a title/description from browser-extracted frames. */
export async function suggestMetadata(frames: string[]): Promise<Suggestion | null> {
  const res = await fetch(`${API_URL}/ai/suggest`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ frames }),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function listVideos(): Promise<Video[]> {
  // Send auth when we have it so owners see their own unlisted videos in feeds.
  const res = await fetch(`${API_URL}/videos`, { headers: { ...authHeaders() } });
  if (!res.ok) throw new Error(`listVideos failed (${res.status})`);
  return res.json();
}

export async function getVideo(id: string): Promise<Video> {
  const res = await fetch(`${API_URL}/videos/${id}`);
  if (!res.ok) throw new Error(`not found (${res.status})`);
  return res.json();
}

export async function updateVideo(
  id: string,
  body: { title?: string; description?: string; tags?: string[]; visibility?: string },
): Promise<Video> {
  const res = await fetch(`${API_URL}/videos/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`update failed (${res.status})`);
  return res.json();
}

export async function incrementView(id: string): Promise<void> {
  await fetch(`${API_URL}/videos/${id}/view`, { method: "POST" });
}

/** Display title: the set title, else a prettified filename. */
export function displayTitle(v: { title?: string | null; filename: string }): string {
  const t = (v.title || "").trim();
  if (t) return t;
  return v.filename.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
}

/** Seconds string -> "m:ss". */
export function formatDuration(s?: string | null): string {
  const n = Number(s);
  if (!n || Number.isNaN(n)) return "";
  const m = Math.floor(n / 60);
  const sec = Math.round(n % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

/** ISO timestamp -> "3 days ago". */
export function relativeTime(iso?: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const day = 86400000;
  const units: [number, string][] = [
    [365 * day, "year"],
    [30 * day, "month"],
    [7 * day, "week"],
    [day, "day"],
    [3600000, "hour"],
    [60000, "minute"],
  ];
  for (const [ms, name] of units) {
    const v = Math.floor(diff / ms);
    if (v >= 1) return `${v} ${name}${v > 1 ? "s" : ""} ago`;
  }
  return "just now";
}

/** PUT the file straight to S3 using the presigned URL, reporting progress. */
export function uploadToS3(
  url: string,
  file: File,
  onProgress: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type || "video/mp4");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`S3 upload failed (${xhr.status})`));
    xhr.onerror = () => reject(new Error("S3 upload network error"));
    xhr.send(file);
  });
}
