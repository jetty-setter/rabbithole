# RabbitHole — Implementation Gap Analysis

Companion to [`RABBITHOLE_PRODUCT_MODEL.md`](./RABBITHOLE_PRODUCT_MODEL.md). Everything below was
verified directly against the code and, for the inventory count, a live read-only scan of the
production `rabbithole-dev-videos` table — nothing here is speculative. **No application code
changes ship in this pass** (see [`architecture.md`](./architecture.md) for the pre-existing
system overview this builds on); this is the plan for what changes next, in priority order.

---

## 1. Current architecture audit

The sixteen questions the reset asked, answered from the code:

| # | Question | Answer |
|---|---|---|
| 1 | Current video/content schema | `api/app/models.py::Video` — flat: `video_id, filename, status, playback_url, thumbnail_url, duration_seconds, owner, title, description, views, hops, thumps, tags: list[str], ai_generated, featured, transcript_status, transcript_url, captions_url, visibility`. No `content_type`, `source_type`, or capability fields exist. |
| 2 | Current transcript schema | Two artifacts per video in S3: `{video_id}/cues.json` (`[{start, end, text}]`, the searchable form) and `{video_id}/captions.vtt` (WebVTT for the `<video>` element), produced by `lambdas/transcribe/handler.py` after an AWS Transcribe job completes. `transcript_status` is one of `pending / transcribing / ready / no_speech / failed`. |
| 3 | Current tag/topic representation | A bare, normalized string (`normalize_tag()` in `api/app/main.py`) living in `Video.tags: list[str]`. No separate topic entity, no description, no aliases, no editorial status. One string does the work of display label, search filter, Tunnel identity, and Map node identity all at once. |
| 4 | Current semantic-search implementation | `api/app/search.py`. Transcript passages are chunked (~350 chars), embedded with a local `fastembed`/bge-small model (no external API, no managed vector DB), and cached as packed float32 blobs in a DynamoDB `embeddings` table. `/search` does a brute-force cosine scan over every chunk and returns the single best-scoring moment per video. **It only ever searches transcript text** — titles, descriptions, and tags are not indexed at all. |
| 5 | Current related-video logic | Two independent mechanisms: (a) `WatchPage.tsx`'s "Deeper" rail seeds the same cross-video embedding search with the *current video's own transcript text* (first ~1000 chars) and falls back to a plain most-recent-videos list when there's no transcript; (b) the Map (`topicGraph.ts`) builds a co-occurrence graph from shared tags across all loaded videos, entirely client-side, recomputed every session. |
| 6 | Current Tunnels behavior | `TunnelsPage.tsx` — one tag is one Tunnel: a video-count-sorted chip cloud, a top-3 featured strip, an A-Z directory, and a find field. `/tunnels/:tag` is just `videos.filter(v => v.tags.includes(tag))`. No topic metadata beyond the tag string itself. |
| 7 | Current Map behavior | `TopicMapPage.tsx` + `topicGraph.ts` — a recently-rebuilt guided hub-and-spoke navigator (not a force-directed graph): pick a topic, see its strongest connections (by shared-video count) arranged around it, follow one to re-centre, with a breadcrumb back. Phones get a vertical list instead of the radial layout. Edges carry **no relationship type and no explanation** — only a shared-video count. |
| 8 | Current Trail behavior | `App.tsx` keeps `trail: string[]` (video ids, most-recent-first, capped at 60) in `localStorage`, appended by `recordTrail()` whenever `useVideoData` loads a video. `TrailPage.tsx` renders it as a plain card grid. No topic interleaving, no path structure. |
| 9 | Current Tumble behavior | `App.tsx::tumble()` — client-side pick from `ready` videos, excluding the current one; 70% weighted toward videos sharing a tag with the current video (else uniform random); tracks a per-session "seen" set so it doesn't repeat until exhausted. Always lands on a video, never a topic or anything else. |
| 10 | Current homepage discovery behavior | `LibraryPage.tsx` — hero search, an admin-curated single "Featured" video (`featured: bool`, server-enforced to at most one), a "Start somewhere" strip of the top 3 tags by video count, and an "Explore more" grid of the next 12 videos by recency. |
| 11 | Current Watch-page capabilities | `WatchPage.tsx` + `Player.tsx` — HLS playback (hls.js / native), a synced transcript panel with search, Ask This Video (RAG over the video's own embedded transcript chunks + Claude, with timestamp citations), a related rail (Deeper-moments or plain related), reactions (hop/thump), favorites, comments, and owner edit/delete. All of it, except reactions/favorites/comments, implicitly assumes an HLS asset and (for several features) a transcript exist. |
| 12 | Current ingestion assumptions | Everything flows through one path: an S3 `ObjectCreated` event (from either a browser's presigned PUT or a script's direct `put_object`, indistinguishable to the pipeline) → EventBridge → SQS → `worker.py` → ffmpeg HLS transcode + smart thumbnail + optional AWS Transcribe job → DynamoDB `status: ready`. There is no code path to create a "ready" content record without an actual video file passing through this pipeline. |
| 13 | Parts that assume all content is locally hosted | `Video.playback_url` is always `_cdn_url(hls_key)` — RabbitHole's own CloudFront, never anything else. `Player.tsx` only knows how to play an HLS `src`; there is no iframe/embed render path anywhere in the frontend (confirmed: zero matches for `iframe`, `embed`, `youtube`, or `vimeo` in `frontend/src`). `_featurable()` hard-requires `hls_key`. The upload flow is local-file-only. |
| 14 | Parts that assume all content has a transcript | `/search` — content without `has_transcript` is not merely deprioritized, it is **entirely invisible**, since the embeddings table is only ever populated from transcribed videos (`search.py::_ensure_indexed`). Everything else degrades more gracefully than that: Ask This Video already returns a plain, honest "no transcript" message instead of erroring; the Deeper-moments rail already falls back to a plain list; Tunnels, Map, and the homepage grids never assumed a transcript in the first place — they only need tags and a thumbnail. |
| 15 | Features that already support the new model | Tunnels, Map's node/edge structure, the homepage grids, and Ask This Video's graceful degradation are all capability-agnostic or already demonstrate the "check a real flag, don't assume" discipline the new model needs everywhere. `has_transcript`/`transcribing` being *derived*, never independently stored/trusted, in `_to_video()` is the exact pattern the new capability model should extend, not replace. |
| 16 | Features that conflict with the new model | `/search` (transcript-only → would silently exclude every External item); the ingestion pipeline (upload-event-only, no registration path); `_featurable()`'s hard `hls_key` requirement (correct today, but needs to be a *capability check* once External content exists rather than a single hardcoded field); the flat tag model (asked to be simultaneously a display label, a search key, and a graph vertex — precisely the overloading the reset moves away from); Tumble/Trail (both assume every visitable thing is a playable video). |

## 2. What we can reuse as-is

- The derived-capability discipline in `_to_video()` (`has_transcript`/`transcribing` computed
  from `transcript_status`, never stored independently) — the template for every new capability flag.
- The embedding search infrastructure (`search.py`) — no new vector DB needed; hybrid search
  extends this, it doesn't replace it.
- Ask This Video's honest degradation message — the template for how External content's Watch
  page should read when a capability is absent.
- Tunnels' and Map's tag-driven structure — both already capability-agnostic; they need topic
  *metadata* layered in, not a rebuild.
- The AI-assisted metadata pattern (`/ai/suggest`, `ai_generated: bool` provenance) — the direct
  template for AI-drafted topic assignments and connection explanations later.
- The existing per-entity DynamoDB table pattern (`videos`, `users`, `comments`, `embeddings`,
  each a small dedicated table, scanned/filtered client-side at this scale) — `topics` and
  `connections` are two more tables in the same shape, not a new kind of infrastructure.

## 3. Schema changes required (P0)

All additive. Every existing item keeps working with zero migration, because every new field is
optional and every new capability is derived with a safe default from data that already exists.

| Change | New/changed field(s) | Default for existing rows |
|---|---|---|
| Content source type | `source_type: "hosted" \| "external"` | `"hosted"` (derived from `hls_key` presence — never needs to be backfilled) |
| Capability flags | `capabilities: {play_internal, embed_external, transcript, moment_search, ask_video, ...}` | All derived from existing fields (`hls_key`, `transcript_status`) at read time, same place `has_transcript` is computed today |
| Topic entity | new `topics` table: `topic_id, slug, name, short_description, aliases, editorial_status, created_at` | N/A — new table |
| Connection entity | new `connections` table: `from_topic, to_topic, relationship_type, strength, explanation, source, created_at` | N/A — new table |
| Content↔Topic link | `topics: [{topic_id, relevance, source}]` list attribute on the existing video item (same shape as `tags`/`thumbnail_candidates` already use — no new join table needed at this scale) | `[]` |

## 4. Prioritized roadmap

### P0 — required for the new product model

| # | Change | Files | Existing behavior | Proposed behavior | Migration | Backend | Frontend | Compat. risk | Existing indexed content |
|---|---|---|---|---|---|---|---|---|---|
| P0-1 | `source_type` field | `api/app/models.py`, `main.py::_to_video` | Implicitly always hosted | Explicit field, derived from `hls_key` | None (derived) | Trivial addition | `Video` TS type gains optional field, unused until P1-4 | None | Unaffected |
| P0-2 | `capabilities` derived object | Same | Only `has_transcript`/`transcribing` exist | Extend the same derivation pattern with `play_internal`, `moment_search`, `ask_video`, `embed_external` | None (derived) | Small function extension | Additive field, no rendering change required yet | None | Unaffected |
| P0-3 | `topics` table + `GET /topics`, `GET /topics/{slug}` | New `aws.py::topics_table()`, new model, new endpoints | No topic entity exists | Parallel system; tags untouched | Editorial seed of ~66 topic rows from the six-network docs (metadata only — not new video content) | New table + 2 endpoints | None required in P0 | None — fully additive | Unaffected |
| P0-4 | `connections` table + read endpoint | New `aws.py::connections_table()`, model, endpoint | Map derives edges purely from tag co-occurrence at runtime | Persisted, editorially-authored connections available to be read | Editorial seed of ~60–70 connection rows from the six-network docs | New table + endpoint | None required in P0 (Map keeps using derived edges until P1-1) | None | Unaffected |
| P0-5 | `topics` list attribute on content items | `models.py::Video` | Only flat `tags` | Additive `topics: []`, populated progressively per network, not backfilled en masse | None | Trivial | Optional field, unused until P1-1/P1-2 | None | Unaffected |

**Every P0 item is additive and independently shippable.** Existing indexed content is
byte-for-byte unaffected by all five.

### P1 — important after proof of concept

| # | Change | Files | Existing behavior | Proposed behavior | Migration | Backend | Frontend | Compat. risk | Existing indexed content |
|---|---|---|---|---|---|---|---|---|---|
| P1-1 | Map shows real connections | `topicGraph.ts`, `TopicMapPage.tsx`, `index.css` | Edge = shared-video count only | When a curated Connection exists for a pair, show `relationship_type` + `explanation`; otherwise fall back to today's derived edge exactly as-is | None | Combined "topic graph" endpoint merging curated + derived edges (avoids client needing both raw connections and a full video scan) | Moderate — new fetch, new rendering branch; hub-and-spoke/breadcrumb/mobile-list interaction model unchanged | Low — graceful fallback preserves current behavior for every uncurated pair | Unaffected |
| P1-2 | Tunnels show a topic description | `TunnelsPage.tsx` | Bare `#tag` heading, no description | Optional short blurb when a curated Topic exists for the tag | None | Reuses P0-3 | Small, additive | None — absent topic row = current behavior exactly | Unaffected |
| P1-3 | Hybrid, idea-first search | `api/app/search.py`, `main.py::semantic_search`, `SearchPage.tsx` | Moments-only, transcript-only, invisible to non-transcribed content | Typed results: `topic \| content \| moment`, so a query can surface a Topic with zero indexed video yet | None | Moderate — new plain-match paths over `topics`/`videos` (no new infra, same scan/filter pattern as `get_creator`) | Moderate — new result sections | **Moderate — `/search`'s response shape changes; frontend and backend must ship together** | Fully unaffected — transcript-moment matching unchanged, just no longer the only result type |
| P1-4 | External/Discovery content support | `models.py`, `main.py` (new registration endpoint bypassing the S3-event pipeline), `Player.tsx`, `WatchPage.tsx`, an admin "add external content" form | 100% of ingestion assumes an S3 upload event | A second, simpler creation path: title/description/`source_url`/embed metadata → `status: ready`, `source_type: external`, no `hls_key`; Player gets an iframe-embed path gated on `capabilities.embed_external`; WatchPage hides (not disables) sections a capability says don't exist | None | Moderate — new endpoint + capability gating | Moderate — real conditional rendering, not hidden-but-present UI | **Moderate — first time a "ready" record can exist with no `hls_key`; every `_featurable()`-style assumption needs a pass** | Fully unaffected — only adds a new record shape |

### P2 — later enhancement (documented only, per the brief — not built this pass)

| # | Change | Files | Why it waits |
|---|---|---|---|
| P2-1 | Trail as a path (topic → content → topic → content) | `App.tsx`, `TrailPage.tsx`, `localStorage` shape | Needs a small, non-destructive `localStorage` format migration (the one genuine migration concern in this whole plan, and it's entirely client-side); worth doing once Map/Tunnels are actually feeding topic visits. |
| P2-2 | Tumble can land on a topic | `App.tsx::tumble()` | Trivial once P0-3/P0-4 exist, but changes a beloved, very simple function — do it deliberately, after the network data is real, not speculatively. |
| P2-3 | AI-drafted topic assignments & connection explanations | `main.py`, new admin endpoint | High-value once there are hundreds of connections to draft; not needed for six hand-curated networks. |
| P2-4 | Capability badges in the UI ("External," "No transcript available") | Card components, `WatchPage.tsx` | Only matters once External content actually exists in the catalog. |

## 5. What NOT to build

Per the brief's explicit constraint, and consistent with "prefer extending the existing
AWS/application architecture":

- No graph database (Neo4j or otherwise) — six networks × ~11 nodes is a few hundred rows in a
  DynamoDB table, well within the existing scan-and-filter pattern already used everywhere else.
- No new vector database — the existing local-embedding + brute-force-cosine approach
  (`search.py`) has headroom for a much bigger corpus than this plan implies.
- No CMS — a `topics`/`connections` table pair plus the existing admin patterns is sufficient for
  six networks of curated data.
- No large-scale recommender system — Tumble and "Deeper" moments already do the job at this scale.
- No mass content ingestion — this entire pass is model and architecture, not content volume.

## 6. Recommended very next task

Build the P0 schema additions (5 items above — all additive, all backward-compatible, no
migration) and a small one-off admin script to seed the `topics` and `connections` tables from
the six-network docs. That proves the data model end-to-end with zero risk to the existing
catalog, and unblocks P1-1 (Map showing real connections) as the first visible payoff.
