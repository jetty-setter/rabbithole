import type { SearchMoment } from "./api";

// Also classifies responses from the previous API during a rolling deployment.
export function splitTranscriptMatches(hits: SearchMoment[], query: string) {
  const words = query.trim().split(/\s+/).filter(Boolean).map(word => {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, "iu");
  });
  const matches = hits.filter(hit => hit.match_type === "exact" || (!hit.match_type && words.length > 0 && words.every(word => word.test(hit.snippet))));
  const matchedIds = new Set(matches.map(hit => hit.video.video_id));
  const related = hits.filter(hit => !matchedIds.has(hit.video.video_id) && (hit.match_type === "related" || (!hit.match_type && hit.score >= 0.65))).slice(0, 3);
  return { matches, related };
}
