import { Fragment, useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { useApp } from "./App";
import {
  buildTopicGraph,
  connectionCount,
  connectionsFor,
  followTopic,
  jumpToStep,
  MAX_CONNECTIONS,
  scoreTopics,
  startingTopics,
  stepBack,
  tunnelPath,
} from "./topicGraph";
import { getTopicConnections, type TopicConnection } from "./api";
import { SkeletonFeed } from "./Skeleton";

const NARROW_QUERY = "(max-width: 640px)";
// Where the connected topics sit, as a percentage of the hub box from its
// centre. The box is square, so this reads the same on both axes.
const RING = 34;

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/** Position of connected topic `i` of `n` around the centre, as a percentage
 *  offset from the hub's middle. Starts at the top, goes clockwise. */
function spoke(i: number, n: number): { x: number; y: number } {
  const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
  return { x: Math.cos(a) * RING, y: Math.sin(a) * RING };
}

/**
 * The Map: a guided "follow the rabbit hole" navigator. You pick a topic,
 * see its strongest connections, pick one of those to re-centre, and keep
 * going. A breadcrumb tracks the path; the tunnel is one explicit click away.
 * The underlying data is still a topic graph — the UI just never asks you to
 * read one.
 */
export function TopicMapPage() {
  const { videos, loading } = useApp();

  const { nodes, edges } = useMemo(() => {
    const ready = videos.filter((v) => v.status === "ready" && !!v.playback_url);
    return buildTopicGraph(ready);
  }, [videos]);

  const scored = useMemo(() => scoreTopics(nodes, edges), [nodes, edges]);
  const scoreByTag = useMemo(
    () => new Map(scored.map((s) => [s.tag, s.score])),
    [scored],
  );
  const countByTag = useMemo(
    () => new Map(nodes.map((n) => [n.tag, n.count])),
    [nodes],
  );
  const starts = useMemo(
    () => startingTopics(scored, edges, scoreByTag),
    [scored, edges, scoreByTag],
  );

  // The path of topics visited; [] means the starting view. The last entry is
  // the current centre.
  const [path, setPath] = useState<string[]>([]);
  const [narrow, setNarrow] = useState(
    () => typeof window !== "undefined" && window.matchMedia(NARROW_QUERY).matches,
  );

  useEffect(() => {
    const mq = window.matchMedia(NARROW_QUERY);
    const on = () => setNarrow(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const center = path.length ? path[path.length - 1] : null;

  // If the catalogue changes out from under an active path (e.g. the centre
  // topic no longer exists), fall back to the starting view.
  useEffect(() => {
    if (path.length && !countByTag.has(path[path.length - 1])) setPath([]);
  }, [countByTag, path]);

  // Escape steps back one level.
  useEffect(() => {
    if (!path.length) return;
    const on = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPath((p) => stepBack(p));
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [path.length]);

  const connections = useMemo(
    () => (center ? connectionsFor(center, edges, scoreByTag, MAX_CONNECTIONS) : []),
    [center, edges, scoreByTag],
  );
  const totalConnections = useMemo(
    () => (center ? connectionCount(center, edges) : 0),
    [center, edges],
  );

  // Curated connections for the centred topic — editorially-authored
  // relationship + "why this connects" data (see docs/RABBITHOLE_PRODUCT_MODEL.md,
  // section 5). Purely additive: this never changes which topics exist or
  // which ones are connected (that's still 100% the tag-co-occurrence graph
  // above) — it only enriches a spoke that's ALREADY there, when curated data
  // happens to exist for it. Empty for the overwhelming majority of topics
  // today, which is exactly the fallback: nothing below renders differently
  // than before for an uncurated topic.
  const [curated, setCurated] = useState<TopicConnection[]>([]);
  useEffect(() => {
    let live = true;
    if (!center) {
      setCurated([]);
      return;
    }
    getTopicConnections(center).then((c) => {
      if (live) setCurated(c);
    });
    return () => {
      live = false;
    };
  }, [center]);

  const curatedByTag = useMemo(
    () => new Map(curated.map((c) => [c.topic, c])),
    [curated],
  );
  // Only explain connections that are actually visible as a spoke -- never
  // reference a topic the user can't currently click through to.
  const curatedVisible = useMemo(
    () => connections.map((c) => curatedByTag.get(c.tag)).filter((c): c is TopicConnection => !!c),
    [connections, curatedByTag],
  );

  if (loading && nodes.length === 0) return <SkeletonFeed />;

  const centerVideos = center ? countByTag.get(center) ?? 0 : 0;

  return (
    <main className="page standard-page">
      <div className="feed-head">
        <h1>Map</h1>
        <p>
          {center
            ? "Follow the connections, or explore this tunnel."
            : "Pick a topic and see where it leads."}
        </p>
      </div>

      {nodes.length === 0 ? (
        <div className="empty">
          <p>No topics yet — they appear as videos pick up tags.</p>
        </div>
      ) : !center ? (
        <div className="topic-starts">
          {starts.map((s) => (
            <button
              key={s.tag}
              type="button"
              className="topic-start"
              onClick={() => setPath([s.tag])}
            >
              <span className="topic-start-tag">#{s.tag}</span>
              <span className="topic-start-meta">{plural(s.count, "video")}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="topic-nav">
          <nav className="topic-path" aria-label="Topics you've followed">
            {path.map((t, i) => (
              <Fragment key={`${t}-${i}`}>
                {i > 0 && (
                  <span className="topic-path-sep" aria-hidden="true">
                    →
                  </span>
                )}
                {i < path.length - 1 ? (
                  <button
                    type="button"
                    className="topic-path-step"
                    onClick={() => setPath((p) => jumpToStep(p, i))}
                  >
                    #{t}
                  </button>
                ) : (
                  <span className="topic-path-step is-current" aria-current="location">
                    #{t}
                  </span>
                )}
              </Fragment>
            ))}
          </nav>

          <div className="topic-nav-head" aria-live="polite">
            <h2>#{center}</h2>
            <p>
              {plural(centerVideos, "video")} · connected to{" "}
              {plural(totalConnections, "topic")}
            </p>
          </div>

          {connections.length === 0 ? (
            <p className="topic-nav-empty">No strong connections yet.</p>
          ) : narrow ? (
            <ul className="topic-spoke-list" key={center}>
              {connections.map((c) => {
                const rel = curatedByTag.get(c.tag);
                return (
                  <li key={c.tag}>
                    <button
                      type="button"
                      className="topic-spoke-row"
                      onClick={() => setPath((p) => followTopic(p, c.tag))}
                      aria-label={
                        rel
                          ? `${c.tag}, connected to ${center} (${rel.relationship_type}). Follow it.`
                          : `${c.tag}, connected to ${center} through ${plural(
                              c.shared,
                              "shared video",
                            )}. Follow it.`
                      }
                    >
                      <span className="topic-spoke-tag">#{c.tag}</span>
                      <span className="topic-spoke-meta">
                        {rel ? rel.relationship_type : plural(c.shared, "shared video")}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="topic-hub" key={center}>
              <svg
                className="topic-hub-lines"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                {connections.map((c, i) => {
                  const { x, y } = spoke(i, connections.length);
                  return (
                    <line
                      key={c.tag}
                      x1={50}
                      y1={50}
                      x2={50 + x}
                      y2={50 + y}
                      strokeWidth={Math.min(0.4 + c.shared * 0.35, 1.8)}
                    />
                  );
                })}
              </svg>

              <div
                className="topic-hub-center"
                aria-current="true"
                aria-label={`${center}, current topic`}
              >
                #{center}
              </div>

              {connections.map((c, i) => {
                const { x, y } = spoke(i, connections.length);
                // A small, subtle nod to how many videos the topic has —
                // never enough to overpower the label.
                const dot = 7 + Math.min(countByTag.get(c.tag) ?? 1, 8);
                const rel = curatedByTag.get(c.tag);
                return (
                  <button
                    key={c.tag}
                    type="button"
                    className={rel ? "topic-hub-spoke has-connection" : "topic-hub-spoke"}
                    style={
                      {
                        left: `${50 + x}%`,
                        top: `${50 + y}%`,
                        "--dot": `${dot}px`,
                      } as CSSProperties
                    }
                    onClick={() => setPath((p) => followTopic(p, c.tag))}
                    aria-label={
                      rel
                        ? `${c.tag}, connected to ${center} (${rel.relationship_type}). Follow it.`
                        : `${c.tag}, connected to ${center} through ${plural(
                            c.shared,
                            "shared video",
                          )}. Follow it.`
                    }
                  >
                    <span className="topic-hub-spoke-dot" aria-hidden="true" />
                    <span className="topic-hub-spoke-tag">#{c.tag}</span>
                    <span className="topic-hub-spoke-meta">
                      {rel ? rel.relationship_type : plural(c.shared, "shared video")}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {curatedVisible.length > 0 && (
            <div className="topic-why-panel">
              {curatedVisible.map((c) => (
                <p className="topic-why-item" key={c.topic}>
                  <span className="topic-why-pair">
                    #{center} <span aria-hidden="true">→</span> #{c.topic}
                  </span>
                  <span className="topic-why-relationship">{c.relationship_type}</span>
                  <span className="topic-why-explanation">{c.explanation}</span>
                </p>
              ))}
            </div>
          )}

          <div className="topic-nav-foot">
            <Link className="btn-primary topic-nav-cta" to={tunnelPath(center)}>
              Explore {plural(centerVideos, "video")} in #{center} →
            </Link>
            <div className="topic-nav-controls">
              {path.length > 1 && (
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => setPath((p) => stepBack(p))}
                >
                  ← Back
                </button>
              )}
              <button type="button" className="link-btn" onClick={() => setPath([])}>
                Start over
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
