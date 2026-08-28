import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "./App";
import { buildTopicGraph, createForceSim, radiusFor, type PositionedNode } from "./topicGraph";
import { SkeletonFeed } from "./Skeleton";

const WIDTH = 900;
const HEIGHT = 560;
const MAX_TICKS = 400;
const SETTLE_ENERGY = 0.6;
const SETTLE_DEADLINE_MS = 4000;
// Rough half-width of a node's truncated label (11px, weight 600, ~18
// chars max) and how far its text descends below the circle -- used to
// size the dynamic viewBox so labels never get clipped at the edges.
const LABEL_HALF_WIDTH = 65;
const LABEL_DROP = 24;
const VIEWBOX_PAD = 20;

function truncate(s: string, n = 18): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

/** A visual map of the library's topics: every tag is a node (sized by how
 *  many videos carry it), and an edge forms wherever two tags share a video
 *  — a lightweight, dependency-free force layout over data that already
 *  exists (no separate topic model). Click a node to browse that tunnel. */
export function TopicMapPage() {
  const { videos, loading } = useApp();
  const navigate = useNavigate();
  const [positions, setPositions] = useState<PositionedNode[] | null>(null);
  const [settled, setSettled] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const rafRef = useRef<number>();

  const { nodes, edges } = useMemo(() => {
    const ready = videos.filter((v) => v.status === "ready" && !!v.playback_url);
    return buildTopicGraph(ready);
  }, [videos]);

  // The video list re-polls every 15s and hands back a fresh array even when
  // nothing changed, which would otherwise re-trigger buildTopicGraph's
  // useMemo with new (but equal) array references and restart the whole
  // settle animation on a loop. Keying the simulation effect on the graph's
  // actual content, not object identity, keeps it stable across those polls.
  const graphKey = useMemo(
    () =>
      `${nodes.map((n) => `${n.tag}:${n.count}`).join(",")}|` +
      edges.map((e) => `${e.source}>${e.target}:${e.weight}`).join(","),
    [nodes, edges],
  );

  useEffect(() => {
    setPositions(null);
    setSettled(false);
    setHovered(null);
    if (nodes.length === 0) return;

    const sim = createForceSim(nodes, edges, { width: WIDTH, height: HEIGHT });
    let ticks = 0;
    let done = false;

    function finish() {
      if (done) return;
      done = true;
      setSettled(true);
    }

    function frame() {
      const next = sim.tick();
      ticks += 1;
      setPositions(next);
      if (ticks < MAX_TICKS && sim.energy() > SETTLE_ENERGY) {
        rafRef.current = requestAnimationFrame(frame);
      } else {
        finish();
      }
    }
    rafRef.current = requestAnimationFrame(frame);

    // Independent of the rAF loop entirely: a backgrounded/hidden tab can
    // throttle requestAnimationFrame down to a crawl, or a browser may
    // suspend it outright rather than just slowing it down, in which case a
    // check living *inside* the rAF callback would never get to run again.
    // setTimeout doesn't depend on the loop ever ticking again, so this
    // guarantees the graph settles (and the dynamic viewBox activates)
    // within a bounded real-time window regardless.
    const deadline = setTimeout(finish, SETTLE_DEADLINE_MS);

    return () => {
      clearTimeout(deadline);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphKey]);

  // Fill the canvas instead of leaving the settled graph as a small cluster
  // inside a fixed 900x560 box: once the simulation stops moving, compute a
  // tight viewBox around the actual node bounds (including radius and label
  // room) instead of the full fixed coordinate system. Only recomputed once
  // settled -- doing this every tick during the animation would make the
  // viewBox itself jitter as nodes are still moving.
  const viewBox = useMemo(() => {
    if (!settled || !positions || positions.length === 0) return `0 0 ${WIDTH} ${HEIGHT}`;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of positions) {
      const r = radiusFor(p.count);
      const halfW = Math.max(r, LABEL_HALF_WIDTH);
      minX = Math.min(minX, p.x - halfW);
      maxX = Math.max(maxX, p.x + halfW);
      minY = Math.min(minY, p.y - r);
      maxY = Math.max(maxY, p.y + r + LABEL_DROP);
    }
    minX -= VIEWBOX_PAD;
    minY -= VIEWBOX_PAD;
    const w = maxX - minX + VIEWBOX_PAD;
    const h = maxY - minY + VIEWBOX_PAD;
    return `${minX} ${minY} ${w} ${h}`;
  }, [settled, positions]);

  const byTag = useMemo(() => {
    const m = new Map<string, PositionedNode>();
    for (const p of positions || []) m.set(p.tag, p);
    return m;
  }, [positions]);

  const neighbors = useMemo(() => {
    if (!hovered) return null;
    const set = new Set<string>([hovered]);
    for (const e of edges) {
      if (e.source === hovered) set.add(e.target);
      if (e.target === hovered) set.add(e.source);
    }
    return set;
  }, [hovered, edges]);

  if (loading && nodes.length === 0) return <SkeletonFeed />;

  return (
    <main className="page standard-page">
      <div className="feed-head">
        <h1>Map</h1>
        <p>Every tag is a topic, connected wherever videos share both — click one to dig in.</p>
      </div>

      {nodes.length === 0 ? (
        <div className="empty">
          <p>No topics yet — they appear as videos pick up tags.</p>
        </div>
      ) : (
        <div className="topic-map">
          <svg
            className="topic-map-svg"
            viewBox={viewBox}
            role="img"
            aria-label="Topic map — a graph of tags connected by shared videos"
          >
            <g className="topic-map-edges">
              {edges.map((e) => {
                const a = byTag.get(e.source);
                const b = byTag.get(e.target);
                if (!a || !b) return null;
                const dim = neighbors && (!neighbors.has(e.source) || !neighbors.has(e.target));
                return (
                  <line
                    key={`${e.source}|${e.target}`}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    className={dim ? "topic-edge dim" : "topic-edge"}
                    strokeWidth={Math.min(1 + e.weight * 0.8, 5)}
                  />
                );
              })}
            </g>
            <g className="topic-map-nodes">
              {(positions || []).map((n) => {
                const r = radiusFor(n.count);
                const dim = neighbors && !neighbors.has(n.tag);
                return (
                  <g
                    key={n.tag}
                    className={dim ? "topic-node dim" : "topic-node"}
                    transform={`translate(${n.x} ${n.y})`}
                    role="button"
                    tabIndex={0}
                    aria-label={`#${n.tag}, ${n.count} video${n.count === 1 ? "" : "s"}`}
                    onMouseEnter={() => setHovered(n.tag)}
                    onMouseLeave={() => setHovered(null)}
                    onFocus={() => setHovered(n.tag)}
                    onBlur={() => setHovered(null)}
                    onClick={() => navigate(`/tunnels/${encodeURIComponent(n.tag)}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        navigate(`/tunnels/${encodeURIComponent(n.tag)}`);
                      }
                    }}
                  >
                    <circle r={r} />
                    <text y={r + 15}>{truncate(n.tag)}</text>
                  </g>
                );
              })}
            </g>
          </svg>
        </div>
      )}
    </main>
  );
}
