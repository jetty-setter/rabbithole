import picks from "../../scripts/curiosity-starter.json";
import type { Video } from "./api";
import { publicVideos } from "./discovery";

/** Only link to destinations that are publicly watchable. */
export function nextInTrail(current: Video, videos: Video[]) {
  if (current.provider !== "youtube") return null;
  const pick = picks.find((item) => item.provider_id === current.provider_id);
  if (!pick) return null;
  const next = publicVideos(videos).find((item) => item.provider === "youtube" && item.provider_id === pick.next_provider_id);
  return next ? { video: next, connection: pick.connection } : null;
}
