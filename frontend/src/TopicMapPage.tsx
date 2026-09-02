import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "./App";
import {
  buildTopicGraph,
  connectionsFor,
  createForceSim,
  neighborhoodTags,
  primaryTopics,
  radiusFor,
  scoreTopics,
  seededRng,
  structuralEdges,
  toggleSelection,
  tunnelPath,
  visibleTopicTags,
  type PositionedNode,
} from "./topicGraph";
import { SkeletonFeed } from "./Skeleton";

const WIDTH = 900;
const HEIGHT = 560;
const MAX_TICKS = 500;
const SETTLE_ENERGY = 0.6;

// How many topics the default (curated) view shows, and how many carry a
// persistent label. Narrow screens get a lighter graph.
const PRIMARY_LIMIT = { wide: 24, narrow: 14 };
const LABEL_LIMIT = { wide: 12, narrow: 6 };
const NARROW_QUERY = "(max-width: 720px)";

const LABEL_HALF_WIDTH = 62;
const LABEL_DROP = 22;
const VIEWBOX_PAD = 26;

function truncate(s: string, n = 18): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

function edgeKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** A map of how the library's topics connect: every tag is a node (sized by
 *  how many videos carry it), edges form where two tags share videos. The
 *  default view shows only the strongest ~two dozen topics; hovering traces a
 *  topic's neighbourhood, selecting locks it and opens a small panel with the
 *  strongest connections and a link into that tunnel. */
export function TopicMapPage() {
  const { videos, loading } = useApp();
  const [positions, setPositions] = useState<PositionedNode[] | null>(null);
  const [settled, setSettled] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [narrow, setNarrow] = useState(
    () => typeof window !== "undefined" && window.matchMedia(NARROW_QUERY).matches,
  );

  useEffect(() => {
    const mq = window.matchMedia(NARROW_QUERY);
    const on = () => setNarrow(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  // Esc clears a locked selection.
  useEffect(() => {
    if (!selected) return;
    const on = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [selected]);

  const { nodes, edges } = useMemo(() => {
    const ready = videos.filter((v) => v.status === "ready" && !!v.playback_url);
    return buildTopicGraph(ready);
  }, [videos]);

  // Re-polling hands back a fresh (but equal) array every 15s; key the
  // simulation on the graph's actual content so it doesn't restart on a loop.
  const graphKey = useMemo(
    () =>
      `${nodes.map((n) => `${n.tag}:${n.count}`).join(",")}|` +
      edges.map((e) => `${e.source}>${e.target}:${e.weight}`).join(","),
    [nodes, edges],
  );

  const scored = useMemo(() => scoreTopics(nodes, edges), [nodes, edges]);
  const scoreByTag = useMemo(
    () => new Map(scored.map((s) => [s.tag, s.score])),
    [scored],
  );
  const countByTag = useMemo(
    () => new Map(nodes.map((n) => [n.tag, n.count])),
    [nodes],
  );

  const primaryLimit = narrow ? PRIMARY_LIMIT.narrow : PRIMARY_LIMIT.wide;
  const labelLimit = narrow ? LABEL_LIMIT.narrow : LABEL_LIMIT.wide;

  const primaryTags = useMemo(
    () => new Set(primaryTopics(scored, primaryLimit).map((s) => s.tag)),
    [scored, primaryLimit],
  );
  const majorLabelTags = useMemo(
    () => new Set(scored.slice(0, labelLimit).map((s) => s.tag)),
    [scored, labelLimit],
  );

  // Reset transient interaction state whenever the graph itself changes.
  useEffect(() => {
    setHovered(null);
    setSelected(null);
    setShowAll(false);
  }, [graphKey]);

  // Settle the layout synchronously over every node (so toggling "show all"
  // never moves anything that was already on screen), with a seeded RNG so
  // the layout is the same every visit. No per-frame animation — the graph
  // simply appears settled rather than drifting in like particles.
  useEffect(() => {
    if (nodes.length === 0) {
      setPositions(null);
      setSettled(false);
      return;
    }
    const sim = createForceSim(nodes, edges, {
      width: WIDTH,
      height: HEIGHT,
      rng: seededRng(0x5eed),
    });
    let last: PositionedNode[] = [];
    for (let i = 0; i < MAX_TICKS; i++) {
      last = sim.tick();
      if (i > 40 && sim.energy() <= SETTLE_ENERGY) break;
    }
    setPositions(last);
    setSettled(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphKey]);

  const byTag = useMemo(() => {
    const m = new Map<string, PositionedNode>();
    for (const p of positions || []) m.set(p.tag, p);
    return m;
  }, [positions]);

  const allTags = useMemo(() => nodes.map((n) => n.tag), [nodes]);

  // hovered wins over selected: hover to peek a neighbourhood, click to lock.
  const focusTag = hovered ?? selected;
  const focusNeighborhood = useMemo(
    () => (focusTag ? neighborhoodTags(focusTag, edges, scoreByTag) : null),
    [focusTag, edges, scoreByTag],
  );
  const selectedConnections = useMemo(
    () => (selected ? connectionsFor(selected, edges, scoreByTag) : []),
    [selected, edges, scoreByTag],
  );

  const visibleTags = useMemo(
    () => visibleTopicTags(allTags, primaryTags, { showAll, focusNeighborhood }),
    [allTags, primaryTags, showAll, focusNeighborhood],
  );

  const structural = useMemo(
    () => structuralEdges(edges, visibleTags),
    [edges, visibleTags],
  );

  // The frame is defined by the default/opened node set, not by focus-revealed
  // neighbours, so locking a selection doesn't lurch the viewport.
  const framedTags = useMemo(
    () => (showAll ? new Set(allTags) : primaryTags),
    [showAll, allTags, primaryTags],
  );
  // The settled cluster is roughly circular; nudge the framed viewBox toward
  // a comfortable aspect range (landscape on desktop, near-square on phones)
  // so the graph fills its box instead of sitting in a letterboxed strip.
  const [minAspect, maxAspect] = narrow ? [0.72, 1.4] : [1.55, 2.3];
  const [vx, vy, vw, vh] = useMemo<[number, number, number, number]>(() => {
    if (!settled || !positions || positions.length === 0)
      return [0, 0, WIDTH, HEIGHT];
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of positions) {
      if (!framedTags.has(p.tag)) continue;
      const r = radiusFor(p.count);
      const halfW = Math.max(r, LABEL_HALF_WIDTH);
      minX = Math.min(minX, p.x - halfW);
      maxX = Math.max(maxX, p.x + halfW);
      minY = Math.min(minY, p.y - r);
      maxY = Math.max(maxY, p.y + r + LABEL_DROP);
    }
    if (!Number.isFinite(minX)) return [0, 0, WIDTH, HEIGHT];
    minX -= VIEWBOX_PAD;
    minY -= VIEWBOX_PAD;
    let w = maxX - minX + VIEWBOX_PAD;
    let h = maxY - minY + VIEWBOX_PAD;
    if (w / h < minAspect) {
      const nw = h * minAspect;
      minX -= (nw - w) / 2;
      w = nw;
    } else if (w / h > maxAspect) {
      const nh = w / maxAspect;
      minY -= (nh - h) / 2;
      h = nh;
    }
    return [minX, minY, w, h];
  }, [settled, positions, framedTags, minAspect, maxAspect]);
  const viewBox = `${vx} ${vy} ${vw} ${vh}`;

  const focusEdgeKeys = useMemo(() => {
    if (!focusTag) return null;
    const set = new Set<string>();
    for (const c of connectionsFor(focusTag, edges, scoreByTag)) {
      set.add(edgeKey(focusTag, c.tag));
    }
    return set;
  }, [focusTag, edges, scoreByTag]);

  if (loading && nodes.length === 0) return <SkeletonFeed />;

  const total = nodes.length;
  const hiddenCount = total - primaryTags.size;

  return (
    <main className="page standard-page">
      <div className="feed-head">
        <h1>Map</h1>
        <p>
          See how topics connect. Hover to trace a path, or choose one to dig deeper.
        </p>
        <p className="feed-head-note">Larger topics contain more videos.</p>
      </div>

      {nodes.length === 0 ? (
        <div className="empty">
          <p>No topics yet — they appear as videos pick up tags.</p>
        </div>
      ) : (
        <>
          {hiddenCount > 0 && (
            <div className="topic-map-tools">
              <button
                type="button"
                className="link-btn"
                aria-pressed={showAll}
                onClick={() => setShowAll((v) => !v)}
              >
                {showAll
                  ? "Show fewer topics"
                  : `Show all ${total} topics`}
              </button>
            </div>
          )}

          <div className="topic-map">
            <svg
              className="topic-map-svg"
              viewBox={viewBox}
              role="img"
              aria-label="Topic map — a graph of tags connected by shared videos"
            >
              <rect
                x={vx}
                y={vy}
                width={vw}
                height={vh}
                fill="transparent"
                onClick={() => setSelected(null)}
              />

              <g className="topic-map-edges">
                {(focusTag
                  ? edges.filter(
                      (e) =>
                        (e.source === focusTag || e.target === focusTag) &&
                        focusEdgeKeys?.has(edgeKey(e.source, e.target)),
                    )
                  : structural
                ).map((e) => {
                  const a = byTag.get(e.source);
                  const b = byTag.get(e.target);
                  if (!a || !b) return null;
                  return (
                    <line
                      key={edgeKey(e.source, e.target)}
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      className={focusTag ? "topic-edge focus" : "topic-edge structural"}
                      strokeWidth={
                        focusTag ? Math.min(1.2 + e.weight * 0.9, 4.5) : 1
                      }
                    />
                  );
                })}
              </g>

              <g className="topic-map-nodes">
                {(positions || [])
                  .filter((n) => visibleTags.has(n.tag))
                  .map((n) => {
                    const r = radiusFor(n.count);
                    const isSelected = n.tag === selected;
                    const isFocus = n.tag === focusTag;
                    const inFocus = focusNeighborhood?.has(n.tag) ?? false;
                    const dim = !!focusTag && !isFocus && !inFocus;
                    const showLabel =
                      !dim &&
                      (majorLabelTags.has(n.tag) || isFocus || inFocus || isSelected);
                    const cls = [
                      "topic-node",
                      isSelected ? "selected" : "",
                      isFocus ? "focus" : "",
                      inFocus && !isFocus ? "neighbor" : "",
                      dim ? "dim" : "",
                    ]
                      .filter(Boolean)
                      .join(" ");
                    return (
                      <g
                        key={n.tag}
                        className={cls}
                        transform={`translate(${n.x} ${n.y})`}
                        role="button"
                        tabIndex={0}
                        aria-label={`${n.tag}, ${n.count} video${n.count === 1 ? "" : "s"}`}
                        aria-pressed={isSelected}
                        onMouseEnter={() => setHovered(n.tag)}
                        onMouseLeave={() => setHovered(null)}
                        onFocus={() => setHovered(n.tag)}
                        onBlur={() => setHovered(null)}
                        // Click selects without stealing focus (and without the
                        // browser scrolling the node into view); keyboard users
                        // still Tab to focus and Enter/Space to select.
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => setSelected((cur) => toggleSelection(cur, n.tag))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelected((cur) => toggleSelection(cur, n.tag));
                          }
                        }}
                      >
                        {isSelected && <circle className="topic-node-ring" r={r + 6} />}
                        <circle className="topic-node-dot" r={r} />
                        <circle className="topic-node-hit" r={r + 12} />
                        <text
                          className={showLabel ? "topic-label" : "topic-label off"}
                          y={r + 14}
                        >
                          {truncate(n.tag)}
                        </text>
                      </g>
                    );
                  })}
              </g>
            </svg>

            {selected && (
            <aside
              className="topic-panel"
              aria-live="polite"
              aria-label={`Selected topic: ${selected}`}
            >
              <div className="topic-panel-head">
                <div>
                  <h2>#{selected}</h2>
                  <span className="topic-panel-count">
                    {countByTag.get(selected) ?? 0} video
                    {(countByTag.get(selected) ?? 0) === 1 ? "" : "s"}
                  </span>
                </div>
                <button
                  type="button"
                  className="topic-panel-close"
                  onClick={() => setSelected(null)}
                  aria-label="Clear selection"
                >
                  ✕
                </button>
              </div>

              {selectedConnections.length > 0 && (
                <div className="topic-panel-conn">
                  <h3>Connected to</h3>
                  <ul>
                    {selectedConnections.map((c) => (
                      <li key={c.tag}>
                        <button
                          type="button"
                          className="topic-conn-link"
                          onMouseEnter={() => setHovered(c.tag)}
                          onMouseLeave={() => setHovered(null)}
                          onFocus={() => setHovered(c.tag)}
                          onBlur={() => setHovered(null)}
                          onClick={() => setSelected(c.tag)}
                        >
                          #{c.tag}
                        </button>
                        <span className="topic-conn-shared">
                          {c.shared} shared video{c.shared === 1 ? "" : "s"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <Link className="btn-primary topic-panel-cta" to={tunnelPath(selected)}>
                Explore this tunnel →
              </Link>
            </aside>
            )}
          </div>
        </>
      )}
    </main>
  );
}
