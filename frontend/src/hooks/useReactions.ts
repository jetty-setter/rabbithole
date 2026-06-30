import { useState, useCallback } from "react";
import { setReaction, vote, type Reaction } from "../api";

const ANON_KEY = "rh_votes";
type AnonVotes = Record<string, "hop" | "thump">;

function loadAnonVotes(): AnonVotes {
  try {
    return JSON.parse(localStorage.getItem(ANON_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveAnonVote(id: string, r: "hop" | "thump" | null) {
  const m = loadAnonVotes();
  if (r) m[id] = r;
  else delete m[id];
  localStorage.setItem(ANON_KEY, JSON.stringify(m));
}

export function hydrateAnonReactions(): { hopped: Set<string>; thumped: Set<string> } {
  const m = loadAnonVotes();
  return {
    hopped: new Set(Object.keys(m).filter((k) => m[k] === "hop")),
    thumped: new Set(Object.keys(m).filter((k) => m[k] === "thump")),
  };
}

export interface ReactionsState {
  hopped: Set<string>;
  thumped: Set<string>;
  setHopped: React.Dispatch<React.SetStateAction<Set<string>>>;
  setThumped: React.Dispatch<React.SetStateAction<Set<string>>>;
  react: (id: string, reaction: "hop" | "thump", authed: boolean, setVideos: (fn: (prev: any[]) => any[]) => void) => void;
}

export function useReactions() {
  const [hopped, setHopped] = useState<Set<string>>(new Set());
  const [thumped, setThumped] = useState<Set<string>>(new Set());

  const react = useCallback(
    (
      id: string,
      reaction: "hop" | "thump",
      authed: boolean,
      setVideos: (fn: (prev: any[]) => any[]) => void,
    ) => {
      const wasHop = hopped.has(id);
      const wasThump = thumped.has(id);
      const from: Reaction = wasHop ? "hop" : wasThump ? "thump" : null;
      const next: Reaction =
        reaction === "hop" ? (wasHop ? null : "hop") : wasThump ? null : "thump";

      setHopped((prev) => {
        const s = new Set(prev);
        next === "hop" ? s.add(id) : s.delete(id);
        return s;
      });
      setThumped((prev) => {
        const s = new Set(prev);
        next === "thump" ? s.add(id) : s.delete(id);
        return s;
      });

      const dHop = (next === "hop" ? 1 : 0) - (wasHop ? 1 : 0);
      const dThump = (next === "thump" ? 1 : 0) - (wasThump ? 1 : 0);
      setVideos((prev) =>
        prev.map((v) =>
          v.video_id === id
            ? {
                ...v,
                hops: Math.max(0, (v.hops ?? 0) + dHop),
                thumps: Math.max(0, (v.thumps ?? 0) + dThump),
              }
            : v,
        ),
      );

      if (authed) {
        setReaction(id, next);
      } else {
        saveAnonVote(id, next);
        vote(id, from, next);
      }
    },
    [hopped, thumped],
  );

  return { hopped, setHopped, thumped, setThumped, react };
}
