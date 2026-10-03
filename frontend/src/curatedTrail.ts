import picks from "../../scripts/curiosity-starter.json";
import type { Video } from "./api";
import { publicVideos } from "./discovery";

/** Only link to destinations that are publicly watchable. */
export function branchesInTrail(current: Video, videos: Video[]) {
  if (current.provider !== "youtube") return [];
  const pick = picks.find((item) => item.provider_id === current.provider_id);
  if (!pick) return [];
  const available = publicVideos(videos);
  const seen = new Set<string>();
  return pick.connections.flatMap((connection) => {
    const next = available.find((item) => item.provider === "youtube" && item.provider_id === connection.provider_id);
    if (!next || next.video_id === current.video_id || seen.has(next.video_id)) return [];
    seen.add(next.video_id);
    return [{ video: next, connection: connection.reason }];
  });
}
