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
  // "hosted" (transcoded + stored by RabbitHole) | "external" (embedded/linked
  // from its original host). Absent on legacy records — treat as "hosted".
  source_type?: "hosted" | "external";
  // External-content provenance — all null/absent for hosted content.
  provider?: "youtube" | "generic" | null;
  source_url?: string | null;
  provider_id?: string | null;
  embed_url?: string | null;
  source_name?: string | null;
  // Where the transcript came from, independent of hosting:
  // "transcribe" | "provider" | "imported" | "none".
  transcript_source?: "transcribe" | "provider" | "imported" | "none";
  // Derived, never independently trusted — computed server-side from the
  // video's own fields every time, the same discipline has_transcript already
  // uses. Absent on legacy API responses — every flag reads as false/unknown,
  // never as a false "yes." Prefer the can*() helpers below over reading this
  // directly, so a legacy response with no `capabilities` still works.
  capabilities?: Capabilities;
  // Curated topic associations (the semantic layer above `tags`). Empty on
  // every video until an editor assigns some; `tags` remains the fallback.
  topics?: ContentTopic[];
}

export interface Capabilities {
  play_internal: boolean;
  embed_external: boolean;
  open_external: boolean;
  watch: boolean;
  transcript: boolean;
  moment_search: boolean;
  ask_video: boolean;
  seek: boolean;
  tunnels: boolean;
  map: boolean;
  tumble: boolean;
}

// ── Derived capability helpers ─────────────────────────────────────────
// One place the UI and feed logic ask "what can this content do?", instead
// of `v.status === "ready" && !!v.playback_url` (or `if external`) scattered
// around. Each falls back to the legacy rule when a response predates the
// `capabilities` field, so nothing regresses for old hosted records.

const legacyReady = (v: Video): boolean => v.status === "ready" && !!v.playback_url;

/** Can a viewer watch this on RabbitHole at all — internal player, inline
 *  embed, or an outbound "watch at source" link. */
export function canWatch(v: Video): boolean {
  return v.capabilities?.watch ?? legacyReady(v);
}

/** RabbitHole's own HLS player can stream this. */
export function canPlayInternal(v: Video): boolean {
  return v.capabilities?.play_internal ?? legacyReady(v);
}

/** Renders inline via a provider embed (YouTube). */
export function canEmbed(v: Video): boolean {
  return v.capabilities?.embed_external ?? false;
}

/** No inline player — the primary action is an outbound link. */
export function canOpenSource(v: Video): boolean {
  return (v.capabilities?.open_external ?? false) || (!canPlayInternal(v) && !canEmbed(v) && !!v.source_url);
}

/** A ready transcript exists (however it got here). */
export function hasTranscript(v: Video): boolean {
  return v.capabilities?.transcript ?? !!v.has_transcript;
}

/** Transcript is indexed for semantic search / powers related moments. */
export function canTranscriptSearch(v: Video): boolean {
  return v.capabilities?.moment_search ?? !!v.has_transcript;
}

/** "Ask this video" can answer from the transcript. */
export function canAsk(v: Video): boolean {
  return v.capabilities?.ask_video ?? !!v.has_transcript;
}

/** Exact-moment jumps are reliable (timed transcript + a seekable player). */
export function canSeekExactMoment(v: Video): boolean {
  return v.capabilities?.seek ?? legacyReady(v);
}

/** Eligible for Tumble — public and watchable somehow. */
export function canTumble(v: Video): boolean {
  return v.capabilities?.tumble ?? (legacyReady(v) && (v.visibility ?? "public") === "public");
}

/** Shows up in feeds / cards / discovery. */
export function isDiscoverable(v: Video): boolean {
  return canWatch(v);
}

export interface ContentTopic {
  topic_id: string;
  relevance: number;
  source: "editorial" | "ai" | "derived";
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

export interface TranscriptSegment {
  start: number;
  end?: number | null;
  text: string;
}

export interface ExternalCreate {
  source_url: string;
  title: string;
  description?: string;
  creator?: string;
  thumbnail_url?: string;
  tags?: string[];
  visibility?: string;
  provider?: "youtube" | "generic";
  transcript_source?: "none" | "imported" | "provider";
  transcript_text?: string;
  transcript_segments?: TranscriptSegment[];
}

/** Admin: register a piece of External content (video not hosted by
 *  RabbitHole). Returns the created content record. */
export async function createExternal(body: ExternalCreate): Promise<Video> {
  const res = await fetch(`${API_URL}/external`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.detail || `add external failed (${res.status})`);
  }
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

// A tag and how many (ready, public) videos carry it — the lightweight
// "expertise" summary on a creator's profile. Renamed from `Topic` to free
// that name for the curated Topic/Concept entity below; the shape here is
// unchanged.
export interface TagCount {
  tag: string;
  count: number;
}

export interface Creator {
  username: string;
  joined?: string | null;
  video_count: number;
  total_views: number;
  total_hops: number;
  topics: TagCount[];
  videos: Video[];
}

// ── Curated Topics / Connections (product-model reset) ──────────────────
// The semantic layer above raw tags. Tags remain the uncurated fallback
// everywhere (Tunnels/Map keep working with zero Topic rows present); a
// Topic is what lets RabbitHole show a real name, a short description, and
// a place in a Connection.

export interface Topic {
  topic_id: string;
  slug: string;
  name: string;
  short_description?: string | null;
  aliases: string[];
  editorial_status: string;
  created_at: string;
}

/** One curated edge from the perspective of the topic you asked about —
 * `topic` is always the OTHER side, regardless of storage direction, so the
 * caller never has to reason about from_topic/to_topic order. */
export interface TopicConnection {
  topic: string;
  relationship_type: string;
  explanation: string;
  strength: number;
  source: string;
}

export async function listTopics(): Promise<Topic[]> {
  const res = await fetch(`${API_URL}/topics`);
  if (!res.ok) return [];
  return res.json();
}

export async function getTopic(slug: string): Promise<Topic | null> {
  const res = await fetch(`${API_URL}/topics/${encodeURIComponent(slug)}`);
  if (!res.ok) return null;
  return res.json();
}

/** This topic's curated connections. An empty array (never an error) is the
 * signal callers use to fall back to the existing tag-co-occurrence Map
 * behaviour — most tags have no curated connections yet. */
export async function getTopicConnections(slug: string): Promise<TopicConnection[]> {
  const res = await fetch(`${API_URL}/topics/${encodeURIComponent(slug)}/connections`);
  if (!res.ok) return [];
  return res.json();
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

/** Is this content usable in the homepage Featured slot on its own merits:
 *  a ready, watchable (hosted OR external), publicly visible item. */
export function isFeaturable(v: Video): boolean {
  return canWatch(v) && (v.visibility ?? "public") === "public";
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

// ── RabbitHole reader model (public GET /rabbitholes/:slug) ─────────────
// A RabbitHole is a short, sourced editorial piece. This is the exact shape
// the API returns for a published one; optional sections are simply absent.
// Internal fields (relationship_type, created_by, editorial_note, …) are
// never in this payload — the API strips them.

export type CredibilityState = "contested" | "unsupported" | "debunked";

export interface RhCitation {
  source_id: string;
  /** Display number, assigned by the API in source order — use as-is. */
  number: number;
}

export interface RhFact {
  text: string;
  /** Absent / null / "established" ⇒ Established (render no chip). */
  state?: CredibilityState | "established" | null;
  why?: string | null;
  citations: RhCitation[];
}

export interface RhContestedItem {
  claim: string;
  state: "established" | CredibilityState;
  body: string;
  why?: string | null;
  citations: RhCitation[];
}

export interface RhContestedOpen {
  intro?: string | null;
  items: RhContestedItem[];
  open_questions: string[];
}

export interface RhTimelineEntry {
  label: string;
  text: string;
  precision: string;
  citations: RhCitation[];
}

export interface RhConnectionTarget {
  slug: string;
  title: string;
  subtitle?: string | null;
}

export interface RhConnection {
  order: number;
  why_care: string;
  /** Present when the destination is a published RabbitHole. */
  destination?: RhConnectionTarget | null;
  /** Present instead when the destination isn't published yet. */
  coming_soon?: { title: string } | null;
}

export interface RhSource {
  number: number;
  type: string;
  classification?: string | null;
  title: string;
  authors?: string | null;
  publisher?: string | null;
  date?: string | null;
  year?: number | null;
  url?: string | null;
  doi?: string | null;
  archive_url?: string | null;
  note?: string | null;
  /** Pre-rendered reference string from the API. */
  citation: string;
}

export interface RabbitHole {
  slug: string;
  title: string;
  subtitle?: string | null;
  hook?: string | null;
  short_version?: string | null;
  what_we_know: RhFact[];
  contested_open?: RhContestedOpen | null;
  timeline?: RhTimelineEntry[] | null;
  keep_digging: RhConnection[];
  sources: RhSource[];
  author_display?: string | null;
  published_at?: string | null;
  updated_at?: string | null;
}

/** Fetch a published RabbitHole by slug. `null` on 404 (drives the
 *  not-found state); throws on a network / server error. */
export async function getRabbitHole(slug: string): Promise<RabbitHole | null> {
  const res = await fetch(`${API_URL}/rabbitholes/${encodeURIComponent(slug)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`rabbithole request failed (${res.status})`);
  return res.json();
}

/** One entry in the published-RabbitHole feed (GET /rabbitholes). */
export interface RabbitHoleListItem {
  id: string;
  slug: string;
  title: string;
  subtitle?: string | null;
  status: string;
  published_at?: string | null;
  updated_at?: string | null;
  source_count: number;
}

/** The published RabbitHoles, newest first. Returns `[]` on any error so the
 *  homepage degrades to "nothing published yet" rather than breaking. */
export async function listRabbitHoles(limit = 12): Promise<RabbitHoleListItem[]> {
  try {
    const res = await fetch(`${API_URL}/rabbitholes?limit=${limit}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.items) ? data.items : [];
  } catch {
    return [];
  }
}

/** A best-effort "resolve to a real link" for a Source: prefer its own URL,
 *  fall back to a DOI resolver, then an archive URL. `null` ⇒ no link. */
export function sourceHref(s: RhSource): string | null {
  if (s.url) return s.url;
  if (s.doi) return `https://doi.org/${s.doi}`;
  if (s.archive_url) return s.archive_url;
  return null;
}

/** "1954" / "March 2015" style dates from the API are already human; this is
 *  only for the ISO published_at/updated_at timestamps. */
export function monthYear(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}
