/** RabbitHole Evidence Experience — V1 schema.
 *
 * An "experience" is optional, subject-specific interactive content that
 * lets a reader inspect, replay and compare the evidence behind a
 * RabbitHole, instead of only reading about it. It is a SEPARATE layer
 * from the article: the article (title/hook/what-we-know/contested-open/
 * timeline/sources/keep-digging, served by the RabbitHole API) remains
 * the authoritative narrative content. An experience file only adds a
 * structured, interactive read of facts and sources the article already
 * has -- it never invents new claims, sources, or citations.
 *
 * Design rules that shape every type below:
 *  - Evidence is atomic and has a stable id. The same fact ("never
 *    repeated") is authored once as an EvidenceItem and then referenced
 *    by id everywhere it's relevant (a sequence step, several
 *    hypotheses) -- never restated as separate prose per hypothesis.
 *  - Hypotheses reference evidence with a verdict; they do not carry
 *    their own supports/problems paragraphs. This is what lets a reader
 *    hold the evidence list still and switch only the hypothesis: "the
 *    evidence stays put, the hypothesis changes."
 *  - Source references are the RabbitHole's own stable source ids (the
 *    `source_id` a citation carries, e.g. "s10") -- never a raw display
 *    number (those can be renumbered) and never a parallel bibliography.
 *    Resolution to a display number happens at render time against the
 *    live article (see registry.ts / resolveSourceRefs).
 *  - The schema describes semantics (what exists, what can be
 *    interacted with, how pieces relate), not layout. A renderer decides
 *    how a `sequence` or a `hypothesis` actually looks on screen; the
 *    data never carries CSS, coordinates-as-pixels, or component names.
 */

/** How one piece of evidence bears on one hypothesis. Deliberately not
 *  binary -- most real evidence is not conclusive either way, and the
 *  schema should make it easy to say so honestly rather than forcing a
 *  verdict a source doesn't support. */
export type EvidenceVerdict =
  | "supports"
  | "weakens"
  | "compatible"
  | "uncertain"
  | "not_applicable";

/** A RabbitHole's own credibility vocabulary (see rabbithole_models.py /
 *  api.ts CredibilityState) -- reused here so a hypothesis's standing
 *  reads identically to the rest of the site. */
export type HypothesisStatus = "established" | "contested" | "unsupported" | "debunked";

/** A reference to one of the RabbitHole's own sources, by its stable id
 *  (e.g. "s10") -- resolved to a display number + citation link at
 *  render time, against the same sources the article cites. Never a
 *  second bibliography. */
export interface SourceRef {
  sourceId: string;
}

/** One atomic, reusable fact. Authored once; referenced by id from
 *  sequence steps and hypotheses. */
export interface EvidenceItem {
  id: string;
  /** Short label -- a matrix row heading / list item title. */
  label: string;
  /** The fact itself, one or two sentences. */
  statement: string;
  sources?: SourceRef[];
}

/** A clickable region on a real artifact image, in percentages of the
 *  image's own natural width/height (not pixels), so it holds up at any
 *  rendered size. Activating a hotspot selects a sequence or a piece of
 *  evidence elsewhere in the experience -- the relationship lives here,
 *  in data, not hard-coded in the media component. */
export interface Hotspot {
  id: string;
  region: { left: number; top: number; width: number; height: number };
  label: string;
  explain: string;
  selects: { kind: "sequence" | "evidence"; id: string };
}

/** A real, unmodified artifact already attached to the RabbitHole via its
 *  ordinary media system (see rabbithole_models.MediaReference /
 *  RhMedia) -- `url` must match a real media item's url. An experience
 *  never supplies or generates its own imagery. */
export interface Artifact {
  id: string;
  kind: "image";
  url: string;
  hotspots?: Hotspot[];
}

/** One step of a sequence. Which fields matter depends on the parent
 *  sequence's `kind` (see Sequence) -- a "replay" step is a valued
 *  sample; a "comparison" step is a named pass that either happened or
 *  didn't. Both carry a plain-language `meaning` and may point at the
 *  EvidenceItem they demonstrate. */
export interface SequenceStep {
  id: string;
  order: number;
  label: string;
  meaning: string;
  evidenceId?: string;
  /** "replay" fields */
  elapsedSeconds?: number;
  value?: number;
  valueLabel?: string;
  /** "comparison" fields */
  detected?: boolean;
  timing?: string;
  state?: string;
}

/** An ordered, interactive sequence of steps. `kind` tells the generic
 *  renderer which of the two V1 presentations to use:
 *   - "replay": scrub/play through valued samples (a bar chart + time
 *     readout) -- e.g. the six 6EQUJ5 samples.
 *   - "comparison": reveal a small number of named passes, some
 *     detected and some not (a profile curve vs. a flat line) -- e.g.
 *     the two expected feed-horn responses.
 *  Both are the same underlying primitive (ordered, evidence-linked
 *  steps); only the presentation differs, and the renderer -- not the
 *  data -- owns that. */
export interface Sequence {
  id: string;
  kind: "replay" | "comparison";
  title: string;
  totalSeconds?: number;
  steps: SequenceStep[];
}

/** A candidate explanation. Carries a thesis and its own standing, but
 *  no supports/problems prose -- its case is made entirely through
 *  which evidence items it references and the verdict attached to each. */
export interface Hypothesis {
  id: string;
  label: string;
  status: HypothesisStatus;
  thesis: string;
  evidence: { evidenceId: string; verdict: EvidenceVerdict }[];
  sources?: SourceRef[];
}

/** The full experience for one RabbitHole. */
export interface Experience {
  id: string;
  /** Must match the RabbitHole's own slug. */
  slug: string;
  title: string;
  /** Entry-point invitation copy, e.g. "Examine the signal". */
  invitation: string;
  artifacts: Artifact[];
  evidence: EvidenceItem[];
  sequences: Sequence[];
  hypotheses: Hypothesis[];
  /** Which evidence ids appear as comparison rows, and in what order.
   *  Omit to show every evidence item. */
  matrix?: { evidenceIds: string[] };
}
