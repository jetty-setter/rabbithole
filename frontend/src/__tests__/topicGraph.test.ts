import { describe, expect, it } from "vitest";
import { buildTopicGraph, createForceSim } from "../topicGraph";

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
