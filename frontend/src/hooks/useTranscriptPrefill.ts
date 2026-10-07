import { useEffect, useState } from "react";
import { canTranscriptSearch, type Video } from "../api";
import { publicVideos } from "../discovery";

// Reviewed phrases from imported captions. Keep the source and cue time so
// each invitation can be checked when the transcript collection changes.
export const transcriptPrompts = [
  { phrase: "glowing red eyes", providerId: "GUpeDwiD64M", start: 29 },
  { phrase: "Silver Bridge", providerId: "GUpeDwiD64M", start: 74 },
  { phrase: "cryptography", providerId: "I2O7blSSzpI", start: 145 },
  { phrase: "steganography", providerId: "I2O7blSSzpI", start: 145 },
  { phrase: "Fermi Paradox", providerId: "ryg077wBvsM", start: 571 },
  { phrase: "Dyson sphere", providerId: "ryg077wBvsM", start: 486 },
  { phrase: "unidentified radar tracks", providerId: "SpeSpA3e56A", start: 224 },
  { phrase: "BERLIN", providerId: "jVpsLMCIB0Y", start: 2406 },
];

export function useTranscriptPrefill(videos: Video[], initialQuery = "") {
  // Rotate on entry, never while the visitor is typing or results are loading.
  const [order] = useState(() => {
    const shuffled = [...transcriptPrompts];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  });
  const available = new Set(publicVideos(videos).filter(v => v.provider === "youtube" && canTranscriptSearch(v)).map(v => v.provider_id));
  const phrase = order.find(p => available.has(p.providerId))?.phrase ?? "";
  const [draft, setDraft] = useState<string | undefined>(initialQuery || undefined);
  // Wait for the catalog, then keep this value. Typing or clearing the field
  // takes precedence even if the catalog arrives later.
  useEffect(() => {
    if (draft === undefined && phrase) setDraft(phrase);
  }, [draft, phrase]);
  return [draft ?? phrase, setDraft] as const;
}
