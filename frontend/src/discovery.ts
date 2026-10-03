import { canWatch, displayTitle, normalizeTag, type Video } from "./api";

/** Discovery uses editorial metadata, independent of transcripts or model services. */
export function publicVideos(videos: Video[]): Video[] {
  return videos.filter((v) => v.status === "ready" && (v.visibility ?? "public") === "public" && canWatch(v));
}

export function sharedTags(a: Video, b: Video): string[] {
  const tags = new Set((a.tags ?? []).map(normalizeTag));
  return [...new Set((b.tags ?? []).map(normalizeTag))].filter((t) => t && tags.has(t));
}

export function relatedVideos(current: Video, videos: Video[]): Video[] {
  return publicVideos(videos).filter((v) => v.video_id !== current.video_id)
    .sort((a, b) => sharedTags(current, b).length - sharedTags(current, a).length || b.created_at.localeCompare(a.created_at))
    .slice(0, 12);
}

export function searchVideos(videos: Video[], query: string): Video[] {
  const words = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  return publicVideos(videos).map((video) => {
    const title = displayTitle(video).toLocaleLowerCase();
    const tags = (video.tags ?? []).join(" ").toLocaleLowerCase();
    const text = `${title} ${tags} ${video.description ?? ""} ${video.source_name ?? video.owner ?? ""}`.toLocaleLowerCase();
    return { video, matches: words.every((w) => text.includes(w)), score: words.reduce((score, w) => score + (title.includes(w) ? 3 : tags.includes(w) ? 2 : 1), 0) };
  }).filter((r) => r.matches).sort((a, b) => b.score - a.score || b.video.created_at.localeCompare(a.video.created_at))
    .map((r) => r.video);
}
