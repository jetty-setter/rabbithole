export interface TopicNode {
  tag: string;
  count: number;
}

export interface TopicEdge {
  source: string;
  target: string;
  weight: number;
}

export interface ScoredNode extends TopicNode {
  /** Sum of shared-video counts across every connection this topic has. */
  weightedDegree: number;
  /** videoCount + weightedDegree — a simple, deterministic prominence score. */
  score: number;
}

export interface Connection {
  tag: string;
  /** Number of videos the two topics share. */
  shared: number;
}

// The focused navigator shows the current topic plus this many of its
// strongest connections (spec target: 5–8).
export const MAX_CONNECTIONS = 8;

// How many starting topics the opening view offers.
export const STARTING_TOPIC_COUNT = 7;

/** Route for a topic's tunnel — the Map explores how topics relate, the
 *  tunnel browses the actual videos. */
export function tunnelPath(tag: string): string {
  return `/tunnels/${encodeURIComponent(tag)}`;
}

// ── Exploration path ──────────────────────────────────────────────
// The path is the sequence of topics followed; its last entry is the
// current centre, and `[]` is the starting view.

/** Follow a connection: it becomes the new centre. */
export function followTopic(path: string[], tag: string): string[] {
  return [...path, tag];
}

/** Jump back to an earlier topic in the breadcrumb (index into `path`). */
export function jumpToStep(path: string[], index: number): string[] {
  return path.slice(0, index + 1);
}

/** Step back one level. From the first centre this returns the starting view. */
export function stepBack(path: string[]): string[] {
  return path.slice(0, -1);
}

/** Tags as topics, videos as the relationship signal: two topics are
 *  connected wherever a video carries both, weighted by how many videos do.
 *  The tags creators/AI already assign are the whole model. */
export function buildTopicGraph(videos: { tags?: string[] }[]): {
  nodes: TopicNode[];
  edges: TopicEdge[];
} {
  const counts = new Map<string, number>();
  const edgeCounts = new Map<string, TopicEdge>();

  for (const v of videos) {
    const tags = [
      ...new Set((v.tags || []).map((t) => t.trim().toLowerCase()).filter(Boolean)),
    ].sort();
    for (const t of tags) counts.set(t, (counts.get(t) || 0) + 1);
    for (let i = 0; i < tags.length; i++) {
      for (let j = i + 1; j < tags.length; j++) {
        // Tab-join for the map key: tags are already sorted, and a tag can
        // contain a space ("good boy") but never a tab.
        const key = `${tags[i]}\t${tags[j]}`;
        const existing = edgeCounts.get(key);
        if (existing) existing.weight += 1;
        else edgeCounts.set(key, { source: tags[i], target: tags[j], weight: 1 });
      }
    }
  }

  const nodes = [...counts.entries()].map(([tag, count]) => ({ tag, count }));
  const edges = [...edgeCounts.values()];
  return { nodes, edges };
}

/** Rank every topic by videoCount + weightedConnectionCount, strongest first.
 *  Deterministic: ties break by video count, then tag name. */
export function scoreTopics(nodes: TopicNode[], edges: TopicEdge[]): ScoredNode[] {
  const wdeg = new Map<string, number>();
  for (const e of edges) {
    wdeg.set(e.source, (wdeg.get(e.source) ?? 0) + e.weight);
    wdeg.set(e.target, (wdeg.get(e.target) ?? 0) + e.weight);
  }
  return nodes
    .map((n) => {
      const weightedDegree = wdeg.get(n.tag) ?? 0;
      return { ...n, weightedDegree, score: n.count + weightedDegree };
    })
    .sort(
      (a, b) => b.score - a.score || b.count - a.count || a.tag.localeCompare(b.tag),
    );
}

/** A topic's strongest connections: ranked by shared-video count, then by the
 *  neighbour's own prominence (so a long tail of one-off pairings is ordered
 *  by usefulness), then tag name. Capped at `limit`. */
export function connectionsFor(
  tag: string,
  edges: TopicEdge[],
  scoreByTag: Map<string, number>,
  limit = MAX_CONNECTIONS,
): Connection[] {
  const out: Connection[] = [];
  for (const e of edges) {
    if (e.source === tag) out.push({ tag: e.target, shared: e.weight });
    else if (e.target === tag) out.push({ tag: e.source, shared: e.weight });
  }
  out.sort(
    (a, b) =>
      b.shared - a.shared ||
      (scoreByTag.get(b.tag) ?? 0) - (scoreByTag.get(a.tag) ?? 0) ||
      a.tag.localeCompare(b.tag),
  );
  return out.slice(0, Math.max(0, limit));
}

/** How many distinct topics a topic is connected to (uncapped). */
export function connectionCount(tag: string, edges: TopicEdge[]): number {
  let n = 0;
  for (const e of edges) if (e.source === tag || e.target === tag) n += 1;
  return n;
}

function link(map: Map<string, Set<string>>, a: string, b: string): void {
  let sa = map.get(a);
  if (!sa) map.set(a, (sa = new Set()));
  sa.add(b);
  let sb = map.get(b);
  if (!sb) map.set(b, (sb = new Set()));
  sb.add(a);
}

/** The opening view's starting topics: strong navigation hubs that lead in
 *  genuinely different directions — "different doors into RabbitHole".
 *
 *  Walk the prominence ranking; take a candidate unless it's the same door as
 *  one already chosen. Three passes, each looser than the last, so a small
 *  catalogue still fills the list:
 *    1. full diversity — not strongly linked (2+ shared videos), not sharing
 *       most of its strong connections, and not just a small satellite of an
 *       already-chosen hub;
 *    2. only the hard rule — never two strongly-linked topics together;
 *    3. plain ranking.
 *  Deterministic. */
export function startingTopics(
  scored: ScoredNode[],
  edges: TopicEdge[],
  scoreByTag: Map<string, number>,
  count = STARTING_TOPIC_COUNT,
): ScoredNode[] {
  const stronglyLinked = new Map<string, Set<string>>();
  const linkedAtAll = new Map<string, Set<string>>();
  for (const e of edges) {
    link(linkedAtAll, e.source, e.target);
    if (e.weight >= 2) link(stronglyLinked, e.source, e.target);
  }

  const topConnections = (tag: string) =>
    new Set(connectionsFor(tag, edges, scoreByTag, 6).map((c) => c.tag));

  const overlap = (a: Set<string>, b: Set<string>) => {
    if (a.size < 2 || b.size < 2) return 0;
    let shared = 0;
    for (const x of a) if (b.has(x)) shared += 1;
    return shared / Math.min(a.size, b.size);
  };

  const chosen: ScoredNode[] = [];
  const conns = new Map<string, Set<string>>();

  const take = (
    reject: (cand: ScoredNode) => boolean,
  ) => {
    for (const cand of scored) {
      if (chosen.length >= count) return;
      if (cand.count < 1 || chosen.some((c) => c.tag === cand.tag)) continue;
      if (reject(cand)) continue;
      chosen.push(cand);
      conns.set(cand.tag, topConnections(cand.tag));
    }
  };

  // Pass 1 — full diversity.
  take((cand) => {
    const cc = topConnections(cand.tag);
    conns.set(cand.tag, cc);
    return chosen.some(
      (other) =>
        stronglyLinked.get(cand.tag)?.has(other.tag) ||
        overlap(cc, conns.get(other.tag)!) >= 0.4 ||
        (linkedAtAll.get(cand.tag)?.has(other.tag) &&
          cand.score < other.score * 0.4),
    );
  });
  // Pass 2 — only the hard rule.
  if (chosen.length < count)
    take((cand) =>
      chosen.some((other) => stronglyLinked.get(cand.tag)?.has(other.tag)),
    );
  // Pass 3 — plain ranking.
  if (chosen.length < count) take(() => false);

  return chosen.slice(0, count);
}
