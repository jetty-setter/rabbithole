import { describe, expect, it } from "vitest";
import {
  buildTopicGraph,
  connectionsFor,
  createForceSim,
  neighborhoodTags,
  NODE_R_MAX,
  NODE_R_MIN,
  primaryTopics,
  radiusFor,
  scoreTopics,
  structuralEdges,
  toggleSelection,
  tunnelPath,
  visibleTopicTags,
} from "../topicGraph";

describe("buildTopicGraph", () => {
  it("counts each tag once per video and dedupes repeats within a video", () => {
    const { nodes } = buildTopicGraph([
      { tags: ["dogs", "beach"] },
      { tags: ["dogs", "dogs", "zoomies"] },
    ]);
    const byTag = Object.fromEntries(nodes.map((n) => [n.tag, n.count]));
    expect(byTag).toEqual({ dogs: 2, beach: 1, zoomies: 1 });
  });

  it("builds a co-occurrence edge for every tag pair sharing a video", () => {
    const { edges } = buildTopicGraph([{ tags: ["dogs", "beach", "zoomies"] }]);
    expect(edges).toHaveLength(3);
    const pairs = edges.map((e) => [e.source, e.target].sort().join("+"));
    expect(new Set(pairs)).toEqual(new Set(["beach+dogs", "beach+zoomies", "dogs+zoomies"]));
  });

  it("accumulates edge weight across multiple co-occurring videos", () => {
    const { edges } = buildTopicGraph([
      { tags: ["dogs", "beach"] },
      { tags: ["dogs", "beach"] },
      { tags: ["dogs", "mountains"] },
    ]);
    const dogsBeach = edges.find((e) => e.source === "beach" && e.target === "dogs");
    const dogsMountains = edges.find((e) => e.source === "dogs" && e.target === "mountains");
    expect(dogsBeach?.weight).toBe(2);
    expect(dogsMountains?.weight).toBe(1);
  });

  it("survives a tag that itself contains a space", () => {
    const { nodes, edges } = buildTopicGraph([{ tags: ["good boy", "zoomies"] }]);
    expect(nodes.map((n) => n.tag).sort()).toEqual(["good boy", "zoomies"]);
    expect(edges).toHaveLength(1);
    expect([edges[0].source, edges[0].target].sort()).toEqual(["good boy", "zoomies"]);
  });

  it("normalizes case and trims whitespace, and ignores videos with no tags", () => {
    const { nodes } = buildTopicGraph([{ tags: [" Dogs ", "DOGS"] }, { tags: [] }, {}]);
    expect(nodes).toEqual([{ tag: "dogs", count: 1 }]);
  });

  it("returns no nodes or edges for an empty video list", () => {
    expect(buildTopicGraph([])).toEqual({ nodes: [], edges: [] });
  });
});

// A small synthetic library the Map-logic tests share.
const LIBRARY = [
  { tags: ["space", "nasa", "moon"] },
  { tags: ["space", "nasa"] },
  { tags: ["space", "nasa", "apollo"] },
  { tags: ["space", "exploration"] },
  { tags: ["nasa", "science"] },
  { tags: ["history", "war"] },
  { tags: ["history", "war", "politics"] },
  { tags: ["history", "culture"] },
  { tags: ["ocean"] },
];

function fixture() {
  const { nodes, edges } = buildTopicGraph(LIBRARY);
  const scored = scoreTopics(nodes, edges);
  const scoreByTag = new Map(scored.map((s) => [s.tag, s.score]));
  return { nodes, edges, scored, scoreByTag };
}

describe("scoreTopics", () => {
  it("scores each topic as videoCount + weightedConnectionCount", () => {
    const { scored } = fixture();
    const nasa = scored.find((s) => s.tag === "nasa")!;
    expect(nasa.count).toBe(4);
    expect(nasa.weightedDegree).toBe(6); // 3 (space) + 1 + 1 + 1
    expect(nasa.score).toBe(10);
    const ocean = scored.find((s) => s.tag === "ocean")!;
    expect(ocean.score).toBe(1); // isolated node: count only
  });

  it("is deterministic and ranks strongest first, ties broken stably", () => {
    const g1 = buildTopicGraph(LIBRARY);
    const g2 = buildTopicGraph(LIBRARY);
    const a = scoreTopics(g1.nodes, g1.edges);
    const b = scoreTopics(g2.nodes, g2.edges);
    expect(a.map((s) => s.tag)).toEqual(b.map((s) => s.tag));
    // space & nasa tie on score(10) and count(4) -> tag name breaks it.
    expect(a.slice(0, 4).map((s) => s.tag)).toEqual(["nasa", "space", "history", "war"]);
    expect(a[a.length - 1].tag).toBe("ocean");
  });
});

describe("primaryTopics", () => {
  it("returns the top N topics for the curated default view", () => {
    const { scored } = fixture();
    expect(primaryTopics(scored, 3).map((s) => s.tag)).toEqual(["nasa", "space", "history"]);
  });

  it("returns everything when the limit exceeds the topic count, and nothing at 0", () => {
    const { scored } = fixture();
    expect(primaryTopics(scored, 999)).toHaveLength(scored.length);
    expect(primaryTopics(scored, 0)).toEqual([]);
  });
});

describe("radiusFor", () => {
  it("maps a bigger video count to a bigger (or equal) node, monotonically", () => {
    expect(radiusFor(2)).toBeGreaterThan(radiusFor(1));
    expect(radiusFor(9)).toBeGreaterThan(radiusFor(3));
    expect(radiusFor(20)).toBeGreaterThanOrEqual(radiusFor(9));
  });

  it("stays within a restrained clamped range", () => {
    expect(radiusFor(1)).toBe(NODE_R_MIN);
    expect(radiusFor(0)).toBe(NODE_R_MIN);
    expect(radiusFor(100000)).toBe(NODE_R_MAX);
  });
});

describe("structuralEdges (default edge visibility)", () => {
  it("shows only relationships backed by 2+ shared videos", () => {
    const { edges, nodes } = fixture();
    const visible = new Set(nodes.map((n) => n.tag));
    const kept = structuralEdges(edges, visible);
    const pairs = kept.map((e) => [e.source, e.target].sort().join("+")).sort();
    // space-nasa (3) and history-war (2) — every weak one-off pair is dropped.
    expect(pairs).toEqual(["history+war", "nasa+space"]);
  });

  it("never shows an edge with a hidden endpoint", () => {
    const { edges } = fixture();
    expect(structuralEdges(edges, new Set(["space"]))).toEqual([]);
    expect(structuralEdges(edges, new Set(["space", "nasa"])).length).toBe(1);
  });

  it("honours a custom threshold", () => {
    const { edges, nodes } = fixture();
    const visible = new Set(nodes.map((n) => n.tag));
    expect(structuralEdges(edges, visible, 3).map((e) => [e.source, e.target].sort().join("+"))).toEqual([
      "nasa+space",
    ]);
  });
});

describe("connectionsFor (focus / selected neighbourhood)", () => {
  it("ranks connections by shared-video count, then by the neighbour's prominence", () => {
    const { edges, scoreByTag } = fixture();
    const conn = connectionsFor("space", edges, scoreByTag);
    expect(conn[0]).toEqual({ tag: "nasa", shared: 3 });
    // the weak-tie tail is ordered by the neighbour's own score, not randomly.
    expect(conn.map((c) => c.tag)).toEqual(["nasa", "apollo", "moon", "exploration"]);
  });

  it("caps the number of connections and never includes unrelated topics", () => {
    const { edges, scoreByTag } = fixture();
    const conn = connectionsFor("nasa", edges, scoreByTag, 2);
    expect(conn).toHaveLength(2);
    expect(conn[0].tag).toBe("space");
    expect(conn.some((c) => c.tag === "history")).toBe(false);
  });

  it("returns nothing for a topic with no edges", () => {
    const { edges, scoreByTag } = fixture();
    expect(connectionsFor("ocean", edges, scoreByTag)).toEqual([]);
  });
});

describe("neighborhoodTags", () => {
  it("is the focus tag plus its strongest connections, and excludes the rest", () => {
    const { edges, scoreByTag } = fixture();
    const n = neighborhoodTags("space", edges, scoreByTag);
    expect(n.has("space")).toBe(true);
    expect(n.has("nasa")).toBe(true);
    expect(n.has("history")).toBe(false);
  });
});

describe("visibleTopicTags", () => {
  const all = ["a", "b", "c", "d"];
  const primary = new Set(["a", "b"]);

  it("defaults to just the primary set", () => {
    expect([...visibleTopicTags(all, primary, { showAll: false })].sort()).toEqual(["a", "b"]);
  });

  it("show-all opens it to every topic", () => {
    expect([...visibleTopicTags(all, primary, { showAll: true })].sort()).toEqual(all);
  });

  it("a focused neighbourhood is pulled into view even when not primary", () => {
    const v = visibleTopicTags(all, primary, {
      showAll: false,
      focusNeighborhood: new Set(["a", "d"]),
    });
    expect([...v].sort()).toEqual(["a", "b", "d"]);
  });
});

describe("toggleSelection", () => {
  it("selects a new topic, and clears when the same one is chosen again", () => {
    expect(toggleSelection(null, "space")).toBe("space");
    expect(toggleSelection("space", "space")).toBeNull();
    expect(toggleSelection("space", "nasa")).toBe("nasa");
  });
});

describe("tunnelPath", () => {
  it("routes a topic to its tunnel, URL-encoded", () => {
    expect(tunnelPath("true-crime")).toBe("/tunnels/true-crime");
    expect(tunnelPath("cold war")).toBe("/tunnels/cold%20war");
  });
});

describe("createForceSim", () => {
  it("keeps every node within the canvas bounds after many ticks", () => {
    const { nodes, edges } = buildTopicGraph([
      { tags: ["a", "b", "c"] },
      { tags: ["c", "d"] },
      { tags: ["d", "e", "f"] },
    ]);
    const sim = createForceSim(nodes, edges, { width: 800, height: 600, rng: () => 0.5 });
    let positions = sim.tick();
    for (let i = 0; i < 300; i++) positions = sim.tick();
    for (const p of positions) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(800);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(600);
    }
  });

  it("settles toward a low-motion equilibrium (energy trends down)", () => {
    const { nodes, edges } = buildTopicGraph([
      { tags: ["a", "b"] },
      { tags: ["b", "c"] },
      { tags: ["c", "a"] },
    ]);
    const sim = createForceSim(nodes, edges, { width: 800, height: 600, rng: () => 0.5 });
    for (let i = 0; i < 20; i++) sim.tick();
    const earlyEnergy = sim.energy();
    for (let i = 0; i < 200; i++) sim.tick();
    const lateEnergy = sim.energy();
    expect(lateEnergy).toBeLessThan(earlyEnergy);
  });

  it("pulls a connected pair closer together than two isolated nodes end up, on average", () => {
    // Two components: a-b are connected by an edge; c and d share no edges
    // with anyone. After settling, the connected pair should be closer.
    const nodes = [
      { tag: "a", count: 1 },
      { tag: "b", count: 1 },
      { tag: "c", count: 1 },
      { tag: "d", count: 1 },
    ];
    const edges = [{ source: "a", target: "b", weight: 5 }];
    const sim = createForceSim(nodes, edges, { width: 800, height: 600, rng: () => 0.5 });
    let positions = sim.tick();
    for (let i = 0; i < 400; i++) positions = sim.tick();
    const byTag = Object.fromEntries(positions.map((p) => [p.tag, p]));
    const dist = (x: { x: number; y: number }, y: { x: number; y: number }) =>
      Math.hypot(x.x - y.x, x.y - y.y);
    expect(dist(byTag.a, byTag.b)).toBeLessThan(dist(byTag.c, byTag.d));
  });
});
