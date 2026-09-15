import type {
  Artifact,
  EvidenceItem,
  EvidenceVerdict,
  Experience,
  Hotspot,
  Hypothesis,
  HypothesisStatus,
  Sequence,
  SequenceStep,
} from "./types";

export type ValidationResult =
  | { ok: true; experience: Experience }
  | { ok: false; errors: string[] };

const VERDICTS: EvidenceVerdict[] = [
  "supports",
  "weakens",
  "compatible",
  "uncertain",
  "not_applicable",
];
const STATUSES: HypothesisStatus[] = ["established", "contested", "unsupported", "debunked"];

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function isPercent(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 100;
}

function pushDuplicates(errors: string[], scope: string, ids: string[]): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) errors.push(`${scope}: duplicate id "${id}"`);
    seen.add(id);
  }
}

/** Structural validation only -- no knowledge of a live RabbitHole. Checks
 *  every rule an experience file can violate on its own: required
 *  fields, unique ids, in-range hotspot percentages, and that every
 *  cross-reference (hotspot -> sequence/evidence, sequence step ->
 *  evidence, hypothesis -> evidence, matrix -> evidence) resolves to
 *  something the same file actually defines. Does not check that
 *  `sources[].sourceId` resolves against a real RabbitHole -- that
 *  depends on live data the file itself can't see (see
 *  resolveSourceRefs), so it's checked separately, and a miss there
 *  degrades a citation rather than invalidating the whole experience. */
export function validateExperience(raw: unknown): ValidationResult {
  const errors: string[] = [];
  const fail = (msg: string) => errors.push(msg);

  if (typeof raw !== "object" || raw === null) {
    return { ok: false, errors: ["experience: not an object"] };
  }
  const exp = raw as Record<string, unknown>;

  for (const field of ["id", "slug", "title", "invitation"]) {
    if (!isNonEmptyString(exp[field])) fail(`experience.${field}: required non-empty string`);
  }

  const artifacts = Array.isArray(exp.artifacts) ? (exp.artifacts as unknown[]) : [];
  if (!Array.isArray(exp.artifacts)) fail("experience.artifacts: required array");
  const evidence = Array.isArray(exp.evidence) ? (exp.evidence as unknown[]) : [];
  if (!Array.isArray(exp.evidence)) fail("experience.evidence: required array");
  const sequences = Array.isArray(exp.sequences) ? (exp.sequences as unknown[]) : [];
  if (!Array.isArray(exp.sequences)) fail("experience.sequences: required array");
  const hypotheses = Array.isArray(exp.hypotheses) ? (exp.hypotheses as unknown[]) : [];
  if (!Array.isArray(exp.hypotheses)) fail("experience.hypotheses: required array");

  const evidenceIds = new Set<string>();
  evidence.forEach((raw, i) => {
    const e = raw as Partial<EvidenceItem>;
    if (!isNonEmptyString(e.id)) return fail(`evidence[${i}].id: required`);
    if (!isNonEmptyString(e.label)) fail(`evidence[${e.id}].label: required`);
    if (!isNonEmptyString(e.statement)) fail(`evidence[${e.id}].statement: required`);
    if (e.sources !== undefined && !Array.isArray(e.sources))
      fail(`evidence[${e.id}].sources: must be an array when present`);
    evidenceIds.add(e.id);
  });
  pushDuplicates(
    errors,
    "evidence",
    evidence.map((e) => (e as Partial<EvidenceItem>).id).filter(isNonEmptyString),
  );

  const artifactIds = new Set<string>();
  const sequenceOrEvidenceHotspotTargets: { hotspotId: string; kind: string; id: string }[] = [];
  artifacts.forEach((raw, i) => {
    const a = raw as Partial<Artifact>;
    if (!isNonEmptyString(a.id)) return fail(`artifacts[${i}].id: required`);
    if (a.kind !== "image") fail(`artifacts[${a.id}].kind: must be "image"`);
    if (!isNonEmptyString(a.url)) fail(`artifacts[${a.id}].url: required`);
    artifactIds.add(a.id);

    const hotspots = Array.isArray(a.hotspots) ? a.hotspots : [];
    const hotspotIds = new Set<string>();
    hotspots.forEach((raw, hi) => {
      const h = raw as Partial<Hotspot>;
      const where = `artifacts[${a.id}].hotspots[${hi}]`;
      if (!isNonEmptyString(h.id)) return fail(`${where}.id: required`);
      if (hotspotIds.has(h.id)) fail(`${where}: duplicate hotspot id "${h.id}"`);
      hotspotIds.add(h.id);
      if (!isNonEmptyString(h.label)) fail(`hotspot[${h.id}].label: required`);
      if (!isNonEmptyString(h.explain)) fail(`hotspot[${h.id}].explain: required`);
      const r = h.region;
      if (
        !r ||
        !isPercent(r.left) ||
        !isPercent(r.top) ||
        !isPercent(r.width) ||
        !isPercent(r.height) ||
        r.left + r.width > 100 ||
        r.top + r.height > 100
      ) {
        fail(`hotspot[${h.id}].region: left/top/width/height must be percentages 0-100 and stay within the image`);
      }
      if (!h.selects || (h.selects.kind !== "sequence" && h.selects.kind !== "evidence")) {
        fail(`hotspot[${h.id}].selects.kind: must be "sequence" or "evidence"`);
      } else if (!isNonEmptyString(h.selects.id)) {
        fail(`hotspot[${h.id}].selects.id: required`);
      } else {
        sequenceOrEvidenceHotspotTargets.push({
          hotspotId: h.id,
          kind: h.selects.kind,
          id: h.selects.id,
        });
      }
    });
  });
  pushDuplicates(
    errors,
    "artifacts",
    artifacts.map((a) => (a as Partial<Artifact>).id).filter(isNonEmptyString),
  );

  const sequenceIds = new Set<string>();
  sequences.forEach((raw, i) => {
    const s = raw as Partial<Sequence>;
    if (!isNonEmptyString(s.id)) return fail(`sequences[${i}].id: required`);
    if (s.kind !== "replay" && s.kind !== "comparison")
      fail(`sequence[${s.id}].kind: must be "replay" or "comparison"`);
    if (!isNonEmptyString(s.title)) fail(`sequence[${s.id}].title: required`);
    sequenceIds.add(s.id);

    const steps = Array.isArray(s.steps) ? s.steps : [];
    if (steps.length === 0) fail(`sequence[${s.id}].steps: must have at least one step`);
    const orders = new Set<number>();
    const stepIds = new Set<string>();
    steps.forEach((raw, si) => {
      const step = raw as Partial<SequenceStep>;
      const where = `sequence[${s.id}].steps[${si}]`;
      if (!isNonEmptyString(step.id)) return fail(`${where}.id: required`);
      if (stepIds.has(step.id)) fail(`${where}: duplicate step id "${step.id}"`);
      stepIds.add(step.id);
      if (!isNonEmptyString(step.label)) fail(`step[${step.id}].label: required`);
      if (!isNonEmptyString(step.meaning)) fail(`step[${step.id}].meaning: required`);
      if (typeof step.order !== "number" || !Number.isFinite(step.order)) {
        fail(`step[${step.id}].order: required number`);
      } else if (orders.has(step.order)) {
        fail(`sequence[${s.id}]: duplicate step order ${step.order}`);
      } else {
        orders.add(step.order);
      }
      if (step.evidenceId !== undefined && !evidenceIds.has(step.evidenceId)) {
        fail(`step[${step.id}].evidenceId: unresolved evidence id "${step.evidenceId}"`);
      }
    });
  });
  pushDuplicates(
    errors,
    "sequences",
    sequences.map((s) => (s as Partial<Sequence>).id).filter(isNonEmptyString),
  );

  const hypothesisIds = new Set<string>();
  hypotheses.forEach((raw, i) => {
    const h = raw as Partial<Hypothesis>;
    if (!isNonEmptyString(h.id)) return fail(`hypotheses[${i}].id: required`);
    if (!isNonEmptyString(h.label)) fail(`hypothesis[${h.id}].label: required`);
    if (!h.status || !STATUSES.includes(h.status)) {
      fail(`hypothesis[${h.id}].status: must be one of ${STATUSES.join(", ")}`);
    }
    if (!isNonEmptyString(h.thesis)) fail(`hypothesis[${h.id}].thesis: required`);
    hypothesisIds.add(h.id);

    const items = Array.isArray(h.evidence) ? h.evidence : [];
    if (items.length === 0) fail(`hypothesis[${h.id}].evidence: must reference at least one item`);
    const seenEvidence = new Set<string>();
    items.forEach((raw, ei) => {
      const ref = raw as { evidenceId?: string; verdict?: EvidenceVerdict };
      const where = `hypothesis[${h.id}].evidence[${ei}]`;
      if (!isNonEmptyString(ref.evidenceId)) return fail(`${where}.evidenceId: required`);
      if (!evidenceIds.has(ref.evidenceId)) {
        fail(`${where}.evidenceId: unresolved evidence id "${ref.evidenceId}"`);
      }
      if (seenEvidence.has(ref.evidenceId)) {
        fail(`hypothesis[${h.id}]: evidence id "${ref.evidenceId}" referenced more than once`);
      }
      seenEvidence.add(ref.evidenceId);
      if (!ref.verdict || !VERDICTS.includes(ref.verdict)) {
        fail(`${where}.verdict: must be one of ${VERDICTS.join(", ")}`);
      }
    });
  });
  pushDuplicates(
    errors,
    "hypotheses",
    hypotheses.map((h) => (h as Partial<Hypothesis>).id).filter(isNonEmptyString),
  );

  // Cross-reference checks that need every id collection above.
  for (const target of sequenceOrEvidenceHotspotTargets) {
    const pool = target.kind === "sequence" ? sequenceIds : evidenceIds;
    if (!pool.has(target.id)) {
      fail(`hotspot[${target.hotspotId}].selects: unresolved ${target.kind} id "${target.id}"`);
    }
  }

  const matrix = exp.matrix as { evidenceIds?: unknown } | undefined;
  if (matrix !== undefined) {
    if (!Array.isArray(matrix.evidenceIds)) {
      fail("experience.matrix.evidenceIds: must be an array when matrix is present");
    } else {
      matrix.evidenceIds.forEach((id) => {
        if (typeof id !== "string" || !evidenceIds.has(id)) {
          fail(`experience.matrix.evidenceIds: unresolved evidence id "${String(id)}"`);
        }
      });
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, experience: raw as Experience };
}
