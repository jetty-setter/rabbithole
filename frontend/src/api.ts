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

export async function demoLogin(): Promise<AuthUser> {
  const res = await fetch(`${API_URL}/auth/demo`);
  if (!res.ok) throw new Error("demo login failed");
  const data = await res.json();
  setToken(data.token);
  return { username: data.username, is_admin: data.is_admin };
}

export async function getMe(): Promise<AuthUser | null> {
  if (!getToken()) {
    // Auto-login as the demo viewer so favorites/reactions work on first visit
    try {
      return await demoLogin();
    } catch {
      return null;
    }
  }
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
  // Smart-thumbnail provenance: "auto" = frame chosen by the scoring pass,
  // "manual" = an admin picked a specific frame. Absent on legacy records.
  thumbnail_source?: "auto" | "manual" | null;
  thumbnail_timestamp?: number | null;
  // Curated homepage Featured slot. Server enforces exactly one at a time;
  // absent on legacy records — treat as false.
  featured?: boolean;
  // Authoritative transcript state; has_transcript/transcribing are always
  // derived from this on the API side (ready -> has_transcript, transcribing
  // -> transcribing), kept for existing code that already branches on them.
  // Absent on legacy records — treat the same as "unavailable".
  transcript_status?: "pending" | "transcribing" | "ready" | "no_speech" | "failed";
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

export interface SearchMoment {
  video: Video;
  start: number;
  snippet: string;
  score: number;
}

/** Cross-video semantic search — best moment per matching video. */
export async function searchMoments(q: string): Promise<SearchMoment[]> {
  const res = await fetch(`${API_URL}/search?q=${encodeURIComponent(q)}`);
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data.results) ? data.results : [];
}

export interface AskCitation {
  start: number;
  text: string;
}

export interface AskAnswer {
  answer: string;
  citations: AskCitation[];
}

/** RAG Q&A scoped to one video's own transcript. */
export async function askVideo(videoId: string, question: string): Promise<AskAnswer> {
  const res = await fetch(`${API_URL}/videos/${videoId}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.detail || `ask failed (${res.status})`);
  }
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

export interface Topic {
  tag: string;
  count: number;
}

export interface Creator {
  username: string;
  joined?: string | null;
  video_count: number;
  total_views: number;
  total_hops: number;
  topics: Topic[];
  videos: Video[];
}

/** A creator's public profile — their videos, aggregate stats, and topics
 * derived from the tags across their own videos. Returns null on 404. */
export async function getCreator(username: string): Promise<Creator | null> {
  const res = await fetch(`${API_URL}/creators/${encodeURIComponent(username)}`);
  if (!res.ok) return null;
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

/** Admin: designate (featured=true) or clear (featured=false) the single
 *  homepage Featured video. The server clears any previous Featured record. */
export async function setFeatured(id: string, featured: boolean): Promise<Video> {
  const res = await fetch(`${API_URL}/videos/${id}/featured`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ featured }),
  });
  if (!res.ok) throw new Error(`feature failed (${res.status})`);
  return res.json();
}

export interface ThumbnailCandidate {
  index: number;
  timestamp: number;
  score: number;
  url: string | null;
  is_auto: boolean;
  is_current: boolean;
}

export interface ThumbnailCandidates {
  candidates: ThumbnailCandidate[];
  source: "auto" | "manual";
  current_index: number | null;
  auto_index: number | null;
}

/** Admin: the generated candidate frames for the thumbnail picker. */
export async function getThumbnailCandidates(id: string): Promise<ThumbnailCandidates> {
  const res = await fetch(`${API_URL}/videos/${id}/thumbnail/candidates`, {
    headers: { ...authHeaders() },
  });
  if (!res.ok) throw new Error(`thumbnail candidates failed (${res.status})`);
  return res.json();
}

/** Admin: pin a specific candidate frame as the thumbnail (`manual`), or
 *  restore the automatic best-frame choice (`auto`). */
export async function selectThumbnail(
  id: string,
  body: { mode: "manual"; index: number } | { mode: "auto" },
): Promise<Video> {
  const res = await fetch(`${API_URL}/videos/${id}/thumbnail`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`thumbnail select failed (${res.status})`);
  return res.json();
}

/** Is this video usable in the homepage Featured slot on its own merits:
 *  a ready, playable, publicly visible video. */
export function isFeaturable(v: Video): boolean {
  return (
    v.status === "ready" &&
    !!v.playback_url &&
    (v.visibility ?? "public") === "public"
  );
}

/** The homepage Featured video. An explicitly curated (`featured === true`)
 *  video wins; otherwise the first ready video, so the slot is never empty
 *  while any ready video exists. `ready` is the already-filtered list of
 *  ready + playable videos. A stale `featured` flag on a video that is no
 *  longer eligible (deleted, unlisted, not ready) is ignored — the fallback
 *  takes over. Selection only; never reorders the catalog. */
export function pickFeatured(ready: Video[]): Video | null {
  return ready.find((v) => v.featured === true && isFeaturable(v)) ?? ready[0] ?? null;
}

/** Display title: the set title, else a prettified filename. */
/** What the Transcript section should render for a video, given its
 *  transcript_status. A transcript failure/absence should never make the
 *  whole section silently disappear -- every ready video gets a Transcript
 *  section, just with state-appropriate copy instead of the searchable cue
 *  list. Legacy records with no transcript_status (and "pending"/"failed")
 *  all collapse into "unavailable" -- the user never sees raw error detail. */
export type TranscriptSectionState = "transcribing" | "ready" | "no_speech" | "unavailable";

export function transcriptSectionState(v: { transcript_status?: Video["transcript_status"] }): TranscriptSectionState {
  switch (v.transcript_status) {
    case "transcribing":
      return "transcribing";
    case "ready":
      return "ready";
    case "no_speech":
      return "no_speech";
    default:
      return "unavailable";
  }
}

export function displayTitle(v: { title?: string | null; filename: string }): string {
  const t = (v.title || "").trim();
  if (t) return t;
  return v.filename.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
}

/** Canonical form for one tag / tunnel label. Mechanical only: lowercase,
 *  trim, drop a leading '#', and render internal whitespace/underscore runs as
 *  a single hyphen so "True Crime", "true crime" and "true-crime" land in one
 *  tunnel. Different spellings are left alone ("truecrime" stays its own tag).
 *  Must mirror `normalize_tag` in the API (api/app/main.py). */
export function normalizeTag(raw: string): string {
  return String(raw)
    .trim()
    .replace(/^#+/, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
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
  contentType?: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType ?? file.type ?? "video/mp4");
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
