import type { Cue } from "./api";

/** Index of the caption cue active at playback time `t` — the last cue whose
 *  start is at/under `t` (plus a small lead so it highlights a touch early), or
 *  -1 before the first cue. Cues are assumed sorted by start time. */
export function activeCueIndex(cues: Cue[], t: number, lead = 0.15): number {
  let idx = -1;
  for (let i = 0; i < cues.length; i++) {
    if (cues[i].start <= t + lead) idx = i;
    else break;
  }
  return idx;
}
