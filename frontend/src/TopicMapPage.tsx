import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "./App";
import { buildTopicGraph, createForceSim, type PositionedNode } from "./topicGraph";

const WIDTH = 900;
const HEIGHT = 560;
const MAX_TICKS = 400;
const SETTLE_ENERGY = 0.6;

function radiusFor(count: number): number {
  return Math.min(11 + Math.sqrt(count) * 8, 42);
}

function truncate(s: string, n = 18): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

/** A visual map of the library's topics: every tag is a node (sized by how
 *  many videos carry it), and an edge forms wherever two tags share a video
 *  — a lightweight, dependency-free force layout over data that already
 *  exists (no separate topic model). Click a node to browse that tunnel. */
export function TopicMapPage() {
  const { videos } = useApp();
  const navigate = useNavigate();
  const [positions, setPositions] = useState<PositionedNode[] | null>(null);
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
    setHovered(null);
    if (nodes.length === 0) return;

    const sim = createForceSim(nodes, edges, { width: WIDTH, height: HEIGHT });
    let ticks = 0;

    function frame() {
      const next = sim.tick();
      ticks += 1;
      setPositions(next);
      if (ticks < MAX_TICKS && sim.energy() > SETTLE_ENERGY) {
        rafRef.current = requestAnimationFrame(frame);
      }
    }
    rafRef.current = requestAnimationFrame(frame);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphKey]);

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

  return (
    <main className="page">
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
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
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
