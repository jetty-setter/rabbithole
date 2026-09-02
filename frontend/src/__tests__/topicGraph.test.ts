import { describe, expect, it } from "vitest";
import {
  buildTopicGraph,
  connectionCount,
  connectionsFor,
  followTopic,
  jumpToStep,
  scoreTopics,
  startingTopics,
  stepBack,
  tunnelPath,
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

// A synthetic library with two clearly separate clusters (space, history) plus
// a bridge topic, so the diversity logic has something to chew on.
const LIBRARY = [
  { tags: ["space", "nasa", "moon"] },
  { tags: ["space", "nasa"] },
  { tags: ["space", "nasa", "apollo"] },
  { tags: ["space", "exploration"] },
  { tags: ["nasa", "science"] },
  { tags: ["history", "war"] },
  { tags: ["history", "war", "politics"] },
  { tags: ["history", "culture"] },
  { tags: ["history", "archaeology"] },
  { tags: ["ocean", "science"] },
  { tags: ["ocean", "climate"] },
  { tags: ["climate", "science"] },
];

function fixture() {
  const { nodes, edges } = buildTopicGraph(LIBRARY);
  const scored = scoreTopics(nodes, edges);
  const scoreByTag = new Map(scored.map((s) => [s.tag, s.score]));
  return { nodes, edges, scored, scoreByTag };
}

describe("scoreTopics", () => {
  it("scores each topic as videoCount + weightedConnectionCount, ranked, deterministic", () => {
    const { scored } = fixture();
    const nasa = scored.find((s) => s.tag === "nasa")!;
    expect(nasa.count).toBe(4);
    expect(nasa.weightedDegree).toBe(6); // 3 (space) + 1 + 1 + 1
    expect(nasa.score).toBe(10);

    const g = buildTopicGraph(LIBRARY);
    expect(scoreTopics(g.nodes, g.edges).map((s) => s.tag)).toEqual(
      scored.map((s) => s.tag),
    );
    // strongest first
    expect(scored[0].score).toBeGreaterThanOrEqual(scored[scored.length - 1].score);
  });
});

describe("connectionsFor", () => {
  it("ranks a topic's connections by shared-video count, then neighbour prominence", () => {
    const { edges, scoreByTag } = fixture();
    const conn = connectionsFor("space", edges, scoreByTag);
    expect(conn[0]).toEqual({ tag: "nasa", shared: 3 });
    expect(conn.map((c) => c.tag)).toEqual(["nasa", "apollo", "moon", "exploration"]);
  });

  it("caps the number of connections and never includes unrelated topics", () => {
    const { edges, scoreByTag } = fixture();
    const conn = connectionsFor("nasa", edges, scoreByTag, 2);
    expect(conn).toHaveLength(2);
    expect(conn[0].tag).toBe("space");
    expect(conn.some((c) => c.tag === "war")).toBe(false);
  });

  it("returns an empty list for a topic with no connections", () => {
    const { nodes, edges } = buildTopicGraph([{ tags: ["lonely"] }]);
    expect(nodes).toEqual([{ tag: "lonely", count: 1 }]);
    expect(connectionsFor("lonely", edges, new Map())).toEqual([]);
  });

  it("returns fewer than the cap when that's all there is", () => {
    const { edges, scoreByTag } = fixture();
    expect(connectionsFor("apollo", edges, scoreByTag).length).toBeLessThan(8);
    expect(connectionsFor("apollo", edges, scoreByTag).map((c) => c.tag)).toContain("space");
  });
});

describe("connectionCount", () => {
  it("counts every distinct topic a topic connects to, uncapped", () => {
    const { edges } = fixture();
    // nasa connects to space, moon, apollo, science
    expect(connectionCount("nasa", edges)).toBe(4);
    expect(connectionCount("nobody", edges)).toBe(0);
  });
});

describe("startingTopics", () => {
  it("returns a small deterministic set of starting topics", () => {
    const { scored, edges, scoreByTag } = fixture();
    const a = startingTopics(scored, edges, scoreByTag);
    const b = startingTopics(scored, edges, scoreByTag);
    expect(a.map((s) => s.tag)).toEqual(b.map((s) => s.tag));
    expect(a.length).toBeGreaterThanOrEqual(1);
    expect(a.length).toBeLessThanOrEqual(7);
  });

  it("offers different doors: two topics strongly linked to each other don't both start", () => {
    const { scored, edges, scoreByTag } = fixture();
    const tags = startingTopics(scored, edges, scoreByTag).map((s) => s.tag);
    // space<->nasa share 3 videos — at most one of them is a starting topic.
    expect(tags.includes("space") && tags.includes("nasa")).toBe(false);
    // the history cluster should still get a door of its own.
    expect(tags).toContain("history");
  });

  it("tops up from the plain ranking if diversity filtering leaves it short", () => {
    const { scored, edges, scoreByTag } = fixture();
    // ask for more than the diverse set can supply -> still returns that many
    const many = startingTopics(scored, edges, scoreByTag, scored.length);
    expect(many.length).toBe(scored.length);
    expect(new Set(many.map((s) => s.tag)).size).toBe(scored.length);
  });

  it("never returns a zero-video topic", () => {
    const { scored, edges, scoreByTag } = fixture();
    for (const s of startingTopics(scored, edges, scoreByTag, 50)) {
      expect(s.count).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("path traversal", () => {
  it("followTopic appends the new centre", () => {
    expect(followTopic(["space"], "nasa")).toEqual(["space", "nasa"]);
    expect(followTopic([], "space")).toEqual(["space"]);
  });

  it("jumpToStep returns to an earlier point in the path", () => {
    const path = ["space", "nasa", "moon"];
    expect(jumpToStep(path, 0)).toEqual(["space"]);
    expect(jumpToStep(path, 1)).toEqual(["space", "nasa"]);
    expect(jumpToStep(path, 2)).toEqual(path);
  });

  it("stepBack drops the current centre; from the first centre it returns to the starting view", () => {
    expect(stepBack(["space", "nasa", "moon"])).toEqual(["space", "nasa"]);
    expect(stepBack(["space"])).toEqual([]);
    expect(stepBack([])).toEqual([]);
  });
});

describe("tunnelPath", () => {
  it("routes a topic to its tunnel, URL-encoded", () => {
    expect(tunnelPath("true-crime")).toBe("/tunnels/true-crime");
    expect(tunnelPath("cold war")).toBe("/tunnels/cold%20war");
  });
});
