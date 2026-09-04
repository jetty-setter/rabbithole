# RabbitHole — Product Model

This document is the reset: what RabbitHole *is*, what it deliberately is *not*, and how that
maps onto the content model and the six product surfaces (Search, Tunnels, Map, Watch, Trail,
Tumble). It is the reference the other three docs in this pass build on:

- [`RABBITHOLE_CONTENT_NETWORKS.md`](./RABBITHOLE_CONTENT_NETWORKS.md) — the six initial curiosity networks
- [`RABBITHOLE_IMPLEMENTATION_GAP.md`](./RABBITHOLE_IMPLEMENTATION_GAP.md) — what has to change in the code
- [`RABBITHOLE_CONTENT_AUDIT.md`](./RABBITHOLE_CONTENT_AUDIT.md) — what to do with the 39 items already in the catalog

No code changes ship with this pass. This is the settling-the-model step the roadmap depends on.

---

## 1. Product definition

> **RabbitHole helps people follow ideas, connections, and exact moments in video — rather than
> channels, popularity, or engagement algorithms.**

One-line version: **RabbitHole is a curiosity engine for video.**

YouTube helps you find *another video*. RabbitHole helps you discover *where an idea leads*. The
central product is curiosity, not catalog size, watch time, or creator monetization. AI
transcription, semantic search, and exact-moment jumps are important *capabilities* RabbitHole
has — they are not the product itself. The product is the experience of going:

> Abandoned places → liminal spaces → Backrooms → nostalgia → uncanny psychology → memory →
> childhood environments

and having RabbitHole make each step's *connection* explicit, not just adjacent.

### What RabbitHole is not

- Not a video hosting platform (hosting is a means, not the point)
- Not a public-domain video archive (the current catalog drifted into this — see the audit)
- Not a transcript demo (transcript search is one capability among several)
- Not a YouTube replacement (no channels, no subscriptions, no algorithmic feed, no creator economy)
- Not a collection of embedded videos (embeds are a content *tier*, not the whole product)
- Not an educational science-video site (the current catalog reads this way by accident, not by design)

### User value proposition

For someone who just watched something and thought *"wait, why does that happen?"* or *"what
else connects to this?"*, RabbitHole is the place that:

1. Shows **why** two ideas relate, in a sentence, not just that they co-occur
2. Lets you search by the *idea* you're curious about, not the title of a video you'd need to
   already know exists
3. Jumps you to the **exact moment** something was said, when that's available
4. Treats "keep going" as a first-class action (Tumble, Map, Trail) instead of a sidebar afterthought

---

## 2. Indexed vs. External content

The current codebase requires every single piece of content to be uploaded to RabbitHole's own
S3 bucket and pushed through the full transcode + transcribe pipeline before it can appear
anywhere (see the audit in §4 of the implementation-gap doc). That constraint is the direct cause
of the "technically valid but boring" catalog: the only content RabbitHole could ever carry was
content someone was willing to re-host. That stops now, going forward, as a matter of product
model — the two-tier split below is deliberately introduced so the *interesting* half of a
curiosity network (a strange local-news segment, an out-of-print documentary clip, an interview
that will never be re-hosted) can still participate.

### A. Indexed / Deep content

Content RabbitHole is legally and technically able to fully process (uploaded and transcoded
today; the model doesn't require that forever, just that RabbitHole has the rights and the
means). This is the richest experience:

- Transcript
- Semantic transcript-moment search
- Exact-moment deep links
- Ask This Video
- Transcript-aware related moments
- Full metadata indexing
- Topic/concept extraction (eventually assisted; editorial today)

### B. External / Discovery content

Material RabbitHole doesn't host — embedded or linked out to where legally and technically
appropriate. It participates in discovery, not in transcript-level search:

- Title, source, creator, description, thumbnail
- Topic/concept tagging
- Curated connections (still first-class — a topic doesn't care how its content is hosted)
- Map, Tunnels, Trail, Tumble, and title/description search
- **Not**: transcript search, exact-moment search, Ask This Video, or any transcript-derived
  feature

The one hard rule: **never fake a capability that isn't there.** If a piece of content has no
transcript, the UI says so plainly (RabbitHole already does exactly this for Ask This Video on
transcript-less indexed content — "This video doesn't have a transcript yet, so there's nothing
to ask about" — that pattern is what generalizes to External content, not a new one).

---

## 3. Capability model

Every content item can answer a fixed set of yes/no questions. The list below is illustrative,
not final API surface — see the implementation-gap doc for the concrete field-level proposal —
but this is the shape:

| Capability | Question it answers |
|---|---|
| `play_internal` | Can RabbitHole's own player stream this? |
| `embed_external` | Can it be embedded from its original host? |
| `open_external` | Does it only make sense as an outbound link? |
| `transcript` | Is there a transcript at all? |
| `moment_search` | Is it indexed for semantic transcript-moment search? |
| `ask_video` | Can "Ask This Video" answer questions about it? |
| `tunnels` | Does it have at least one topic, so it can sit in a tunnel? |
| `map` | Does it have a topic with at least one curated connection? |
| `tumble` | Is it public and playable (internally or via embed)? |
| `trail` | Was it actually opened by this visitor? (a session fact, not a content property) |

Capabilities are **derived, not independently declared** — this mirrors a pattern the codebase
already uses correctly and should keep using: `Video.has_transcript` is never trusted as its own
flag today; it's always computed from `transcript_status` so the two can never disagree
(`api/app/main.py::_to_video`). The new capability set extends that same discipline: `moment_search`
is derived from `transcript_status == "ready"` AND the item being present in the embeddings
index; `play_internal` is derived from `hls_key` existing; and so on. No UI ever needs to ask
"does this claim to support X" separately from "does X actually work here."

---

## 4. Topic / Concept model

Today a "topic" is just a tag string (`Video.tags: list[str]`, normalized by
`normalize_tag()`), and it does five jobs at once: display label, search filter, tunnel identity,
Map node identity, and (implicitly) connection-graph vertex. That overloading is exactly the
"tag carries all the responsibility" anti-pattern this reset moves away from.

A **Topic/Concept** becomes its own thing: a slug, a name, a short editorial description, a set
of aliases (so "false confession" and "false confessions" resolve to one topic without forcing a
single canonical spelling everywhere), and an editorial status. Tags don't go away — they remain
the free-text, uncurated layer (still how `Tunnels` and the existing Map continue to work for
anything that hasn't been curated yet) — but a **curated topic** is what lets RabbitHole say
something a bare tag never could: a description, a canonical name, and a place in a Connection.

---

## 5. Connection model

This is the single most important structural change. Today RabbitHole can express *"#space and
#nasa appeared together in 3 videos."* It cannot express *why that's interesting.* A **Connection**
is first-class, persisted data: `from_topic`, `to_topic`, a `relationship_type`, a `strength`,
and a short (1–2 sentence) `explanation` — plus a `source` (editorial vs. AI-assisted vs. derived
from co-occurrence) so provenance is never ambiguous. Examples, in the exact shape the product
should be able to answer "why does this connect?" with:

| From | To | Relationship | Why |
|---|---|---|---|
| Space | NASA | organization / exploration | "NASA is one of the primary organizations through which modern space exploration and research are conducted." |
| Moon landing | Conspiracy thinking | cultural interpretation | "The Apollo landings became one of the most enduring case studies in modern conspiracy belief." |
| False confessions | Memory | causal mechanism | "Confessions are often shaped by suggestive interrogation, which can implant details the confessor experiences as a genuine memory." |

The explanation is short by design — usually one sentence, two at most. It exists to answer one
question: *"why does following this make sense?"* That's the whole feature. It is not a knowledge
graph project; it's a few hundred short, editorially-written (or AI-drafted, editor-approved)
sentences.

---

## 6. Role of transcripts

Transcripts remain a **core differentiator**, not the whole product. What they unlock:

- Exact-moment search ("find the 40 seconds where someone actually says this")
- Ask This Video (grounded Q&A, cited to a timestamp)
- Transcript-seeded "Deeper" related moments (WatchPage already does this: it seeds cross-video
  search with the *current* video's own transcript text, not its title — `WatchPage.tsx`'s
  `deeperMoments` effect)

What they are **not**: a requirement for a content item to be interesting, discoverable, or
connected. Under the new model, a piece of External content with zero transcript can still be a
first-class node in a Tunnel, a stop on a Map path, a Tumble destination, and the answer to a
title/description search — it just can't do the four transcript-specific things above, and the UI
says so rather than hiding the fact.

## 7. Role of AI

AI shows up in three distinct, already-partially-built roles, and the model keeps them distinct
rather than blurring them into one "AI-powered" label:

1. **Transcription** — AWS Transcribe, today, for Indexed content only.
2. **Retrieval + generation over transcripts** — the embedding search (`api/app/search.py`,
   local `fastembed`/bge-small, brute-force cosine — no managed vector DB) and Ask This Video's
   Claude call, both grounded strictly in transcript excerpts, never outside knowledge.
2. **Editorial assistance** — AI-suggested titles/tags from video frames already exists
   (`/ai/suggest`, `worker.py::_ai_metadata`). The same pattern extends naturally to
   AI-*drafted* topic assignments and connection explanations — always editor-reviewed before
   publish (`editorial_status`), never auto-published, matching how AI-generated video metadata
   is flagged (`ai_generated: bool`) rather than presented as human-authored.

AI matters here specifically because it is what makes "why does this connect?" affordable to
write for hundreds of pairs instead of dozens — but it drafts, it doesn't decide.

---

## 8. Product surfaces

### Search — *find the idea, not the title*

Today `/search` is transcript-moment search only (`api/app/search.py::search`) — it cannot match
a title, a tag, or a topic name, only spoken transcript content, and only for videos with
`transcript_status == "ready"`. Going forward, search becomes idea-first and returns a blend of
result types — topics, content (matched on title/description/topic), and transcript moments — so
a query like *"why do people confess to crimes they didn't commit?"* surfaces the **False
Confessions** topic even before it surfaces any specific video.

### Tunnels — *go deeper into one idea*

Already close to the right shape: a Tunnel is one topic and its content, full stop
(`TunnelsPage.tsx`). The gap is that a "topic" today is a bare tag with no description — once
Topics are real entities, a Tunnel page gets a short editorial blurb and a legitimate reason to
exist beyond "here are the videos with this string in `tags`."

### Map — *see where an idea can lead*

Definition: lateral exploration via **conceptual relationships**, not another topic directory.
The current Map (`topicGraph.ts` + `TopicMapPage.tsx`) already has the right *interaction* model
— a hub-and-spoke navigator, one topic at a time, follow a connection to re-centre — but its
edges are pure tag co-occurrence computed at runtime, with no relationship type and no
explanation. Once Connections are persisted data, Map becomes literally able to show "False
Confessions → Memory (causal mechanism): confessions are often shaped by suggestive
interrogation…" instead of "False Confessions and Memory share 2 videos."

### Watch — *go inside the content*

For Indexed content: transcript, exact moments, Ask This Video, semantic related moments — all
already built. For External content: only the capabilities that are actually true render at all
— no transcript panel, no Ask box, no fake "moment" links. The existing `transcript_status`
branching (`transcriptSectionState()` in `api.ts`, already handling `ready` /
`no_speech` / `transcribing` / `unavailable` distinctly) is the direct precedent for how a
`source_type: "external"` item's Watch page degrades honestly instead of showing an error state
where a feature should have simply not rendered.

### Trail — *your curiosity path*

Today: a flat, local-only list of watched `video_id`s (`App.tsx`'s `trail: string[]` in
`localStorage`), rendered as plain cards (`TrailPage.tsx`). Under the new model, Trail's value
grows if it preserves the *path* — topic → content → topic → content — not just a viewing log.
**Not implemented in this pass** (see the implementation-gap doc for the small, additive change
that would make this possible without breaking the current shape).

### Tumble — *controlled serendipity*

Today: client-side weighted-random video pick, 70% biased toward sharing a tag with the current
video (`App.tsx::tumble()`). Under the new model, Tumble's destination pool should eventually
include an unexpected *connected topic*, not just another video. **Not implemented in this pass**
— documented as a near-term follow-on in the implementation-gap doc.

---

## 9. Content strategy going forward

Stop optimizing for "how many legally downloadable videos can we find." Optimize for
interestingness, connection potential, diversity, depth, and curiosity — a smaller graph of
compelling material beats a larger one of mundane material. See
[`RABBITHOLE_CONTENT_NETWORKS.md`](./RABBITHOLE_CONTENT_NETWORKS.md) for the six initial networks
and [`RABBITHOLE_CONTENT_AUDIT.md`](./RABBITHOLE_CONTENT_AUDIT.md) for the content-selection
rubric and what to do with the existing 39-item catalog.
