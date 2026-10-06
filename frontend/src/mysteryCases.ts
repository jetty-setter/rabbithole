import picks from "../../scripts/curiosity-starter.json";
import { publicVideos } from "./discovery";
import type { Video } from "./api";

// Stable identities allow several documentaries to belong to one case.
export const caseSources: Record<string, string[]> = {
  "wow-signal": ["a0rByLgRdLM"], "numbers-stations": ["d1s5g2Nh2c0"],
  "uvb-76": ["tuDhgB5jvww"], "max-headroom": ["NVcRWOhXmh4"],
  "great-silence": ["ryg077wBvsM"], "navy-ufo": ["SpeSpA3e56A"],
  "cicada-3301": ["I2O7blSSzpI"], "kryptos": ["jVpsLMCIB0Y"],
  "toynbee-tiles": ["TLMVjfKg35M"], "broadcast-intrusions": ["xkTsoP5v2GM"],
  "sasquatch": ["YxXhp-xjZ28"], "loch-ness": ["wW6eKLLViK8"],
  "mothman": ["GUpeDwiD64M"], "chupacabras": ["d-jkZE8AdLA"],
  "fresno-nightcrawlers": ["QrGcxeyIPx4"], "flatwoods": ["1C7zocpEqT8"],
  "db-cooper": ["CbUjuwhQPKs"], "roanoke": ["iTOKRWgjOlg"],
  "will-o-the-wisp": ["FcNUxb_4qbo"], "bunyip": ["TeUGl1rOXx0"],
};
export function buildMysteryCases(videos: Video[]) {
  const available = publicVideos(videos);
  const lookup = new Map(Object.entries(caseSources).flatMap(([id, sources]) => sources.map(source => [source, id] as const)));
  const cases = Object.entries(caseSources).flatMap(([id, sources]) => {
    const entries = sources.flatMap(source => available.filter(v => v.provider === "youtube" && v.provider_id === source));
    const pick = picks.find(p => sources.includes(p.provider_id));
    if (!entries.length || !pick) return [];
    const seen = new Set<string>();
    const connections = picks.filter(p => sources.includes(p.provider_id)).flatMap(p => p.connections).flatMap(c => {
      const target = lookup.get(c.provider_id);
      if (!target || target === id || seen.has(target)) return [];
      seen.add(target);
      return [{ target, reason: c.reason }];
    });
    return [{ id, title: pick.title, description: pick.description, tags: pick.tags, videos: entries, connections }];
  });
  const ids = new Set(cases.map(c => c.id));
  return cases.map(c => ({ ...c, connections: c.connections.filter(edge => ids.has(edge.target)) }));
}
