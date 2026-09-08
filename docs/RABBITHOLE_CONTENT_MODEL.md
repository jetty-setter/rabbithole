# RabbitHole — Content Model (V1 editorial/product spec)

This document validates the RabbitHole content structure against five sample
RabbitHoles and specifies the smallest V1 model that still feels like RabbitHole.
It is an **editorial/product spec**, not a database schema. Engineering builds
against this once it is agreed.

Samples evaluated (drafted as product prototypes, in the current 11-field model):

1. The Wow! Signal — *unexplained event / SETI*
2. The Dyatlov Pass Incident — *historical mystery, now largely explained*
3. The Dancing Plague of 1518 — *historical mystery, no consensus mechanism*
4. MKUltra — *documented government program*
5. Why Are Octopuses So Intelligent? — *open scientific question, no mystery*

The five were chosen to stress the model across subject types. Only one (Wow!) is
a "pure" unsolved mystery; the set deliberately includes a documented topic and a
science explainer to see where the structure breaks.

---

## 1. Critique of each sample

Scoring the current fields: **Hook · Quick Answer · What We Know · What Makes It
Strange · What's Disputed · What's Still Unknown · Theories/Explanations ·
Timeline · Evidence · Sources · Keep Digging.**

Note up front: **none of the five samples has a Sources section or a single inline
citation.** Every sample has an "Evidence" section instead, which is a different
thing (see cross-sample findings).

### 1.1 The Wow! Signal

| Field | Assessment |
|---|---|
| **Hook** | Strong. Concrete date/place, the "Wow!" annotation is a real and vivid detail, and it actively resists sensationalism ("not evidence that extraterrestrials contacted Earth"). Minor: "narrow-band" is jargon in sentence one. |
| **Quick Answer** | Too long (5 paragraphs). Re-explains narrow-band a second time and the beam geometry, both of which reappear below. The "it's not aliens" disclaimer is good for credibility but lands twice. Cut ~50%. |
| **What We Know** | The best section. 5 scannable bullets, all genuinely established, `6EQUJ5` correctly flagged elsewhere as "not a decoded message." Should carry source markers on "never reproduced" and "72 s = beam transit." |
| **What Makes It Strange** | The two-horn non-detection is the single most important technical fact about the signal — but it's a *fact*, not a vibe, and belongs in What We Know. As its own section it restates "never detected again" from the Hook. |
| **What's Disputed** | Pure redundancy. Lists the same four candidate origins as the Explanations section that immediately follows. Not a real dispute between camps — just "we don't know." Delete. |
| **What's Still Unknown** | Good and crisp ("The source." + why a one-time signal is near-unsolvable). This is the better-written twin of What's Disputed; keep this one. |
| **Theories / Explanations** | Format is the best in any sample: claim → label → one line → **"Problem:"**. But 2 of 3 labels are "PLAUSIBLE" (no discriminating power — the Problem line does the work), and the one genuinely *debunked* explanation (the 2015/2017 comet hypothesis) is omitted, which makes the section blander than reality. "UNVERIFIED" is a 7th label not in the system. |
| **Timeline** | Forced. Two real events (detection, Ehman spots it) padded with "Following decades" and "Today — the source remains unidentified," which are not timeline entries. Cut. |
| **Evidence** | Weakest concept in the sample. The two entries ("the observation" and "the 6EQUJ5 printout") are the *same primary artifact* described twice. No actual sources (no Ehman 1998 report, no journal). It is neither evidence-for-claims nor a bibliography. |
| **Sources** | Absent. Zero citations for "one of the most famous unexplained signals in SETI history." A reader cannot verify anything. |
| **Keep Digging** | Good. 5 links; FRB ("once seemed mysterious… before astrophysical explanations emerged") and Arecibo Message (deliberate transmission, the mirror image) are excellent. Technosignatures and Fermi Paradox are weaker — concept prompts with definition-style "why," not relationships. |

**Verdict:** Science restraint is exemplary. Hook, What We Know, the Explanation
format, and 3/5 connections are strong. What's Disputed is dead weight; Timeline
and Evidence are padding; no Sources is a credibility hole. ~800 words where ~450
would be stronger.

### 1.2 The Dyatlov Pass Incident

| Field | Assessment |
|---|---|
| **Hook** | Best of the five. Concrete and eerie, then the key move: *"The evidence now points toward something much less exotic — but still terrifying."* Signals a payoff while keeping tension, and de-sensationalizes on purpose. |
| **Quick Answer** | Slightly long but well-calibrated. Names the modern slab-avalanche finding *and* the specific objection it overcomes ("despite decades of claims that the slope was too shallow"). Honest about limits. |
| **What We Know** | 8 bullets, getting long, and two of them smuggle in *findings* ("modeling demonstrated… plausibly", "expeditions documented…") that belong in Explanations. The genuinely compelling specifics (two fatal skull fractures, chest trauma "like a car crash", one body missing tongue/eyes) are sanitized to "major traumatic injuries," which undersells the mystery. |
| **What Makes It Strange** | Earns its place. "Something convinced experienced winter hikers that staying inside their shelter was more dangerous than the freezing night. Then they did not simply return." That's the real puzzle, cleanly stated, and it's distinct from the Hook. |
| **What's Disputed** | Half-earns it. There *is* a real dispute (is a slab avalanche a *sufficient* explanation), but the section spends more words re-listing what the avalanche explains than characterizing the disagreement. Overlaps the Explanations entry. |
| **What's Still Unknown** | Best of the five. *"Those details died with them. That is different from saying the physical cause is completely unknowable."* Draws the fact/mystery line perfectly, minimal overlap with What's Disputed. Only Dyatlov manages this split cleanly. |
| **Theories / Explanations** | Good coverage and ordering (most→least supported). But no "Problem:" lines (inconsistent with Wow!), and "PLAUSIBLE CONTRIBUTING FACTOR" is an 8th ad-hoc label. The Yeti entry is arguably a wasted slot — though one line to close it off has some value given where readers arrive from. |
| **Timeline** | More justified than Wow! — the Jan 28 → night of Feb 1–2 → Feb 26 sequence matters, and the 24-day gap before the tent was found is meaningful. But it mixes incident time with research history (2021 model, 2021–22 expeditions) and has a vague "weeks and months" row. |
| **Evidence** | Better than Wow! — three genuinely distinct evidence types. But all three support *only the avalanche explanation*, so the case looks more one-sided than What's Disputed admits. Still reads like a methods appendix; the actual paper (Gaume & Puzrin, *Nature Communications* 2021) is referenced three times and never cited. |
| **Sources** | Absent. |
| **Keep Digging** | 4 links. "Survival Decisions in Extreme Cold" (hypothermia alters judgment) genuinely illuminates the "why didn't they return" question. "How Mysteries Become Conspiracies" is a strong, self-aware, RabbitHole-native connection that could recur across the catalog. But "Slab Avalanches" and "Katabatic Winds" are mechanism explainers closer to glossary entries, and there are no "directly involved" links (no people, no institution, no 2019 Russian re-investigation as its own thing). |

**Verdict:** Best Hook and best What's Still Unknown. What Makes It Strange earns
its keep here. But the slab-avalanche finding appears in **five** sections;
What We Know smuggles claims; Evidence is one-sided; no Sources.

### 1.3 The Dancing Plague of 1518

| Field | Assessment |
|---|---|
| **Hook** | Strong content ("The city's response? It hired musicians") but the tone — the one-word question, the line break — is a notch more listicle than the restrained house voice the other four samples hold. |
| **Quick Answer** | Reasonable length. Good context (famine, disease, stress, supernatural belief) and properly hedged ("One influential explanation…", "cannot now be proven"). The MPI explanation + its stress context then appear again in full in Explanations. |
| **What We Know** | Weakest of the five — too vague to be useful. The genuinely-known specifics (began with a single woman; grew to hundreds within a month; documented in physician notes *and* city-council records; authorities built a stage and hired a band; subsided after weeks) are mostly absent because the author is being cautious about disputed details. Caution has hollowed out the credibility section. |
| **What Makes It Strange** | ~60% overlap with Hook + Quick Answer. "Contagious without being infectious in the ordinary biological sense" is the one sharp, new line; the rest restates the "cure was more dancing" irony already told twice. |
| **What's Disputed** | **Best of the five.** It disputes the *popular myth* ("Modern retellings confidently claim large numbers died from dancing… the historical evidence for precise death counts is much weaker"), not an academic technicality. This is genuinely useful — the reader has probably heard "they danced to death." Shows the field works best as "what you think you know is overstated." |
| **What's Still Unknown** | Fine, honest, short ("cannot diagnose people who died five centuries ago"). Slightly overlaps the mechanism question in Explanations. Less punchy than Dyatlov's. |
| **Theories / Explanations** | 3 entries, no overload. Ergot entry has good inline "Problem" logic. But "SUPPORTED" overstates the MPI hypothesis (it is *the leading* hypothesis, not a supported consensus). "HISTORICAL BELIEF — NOT SUPPORTED" is a 9th ad-hoc label — but it's doing something real the 6-label system can't: separating *what people at the time believed* from *what we think caused it*. Worth keeping that distinction. |
| **Timeline** | Most forced of any sample. One real date (July 1518); the rest are "Following days / Following weeks / Later." The interesting progression (1 → dozens → hundreds → fade) has no numbers and no dates. Should be one sentence in What We Know. |
| **Evidence** | Weak. "Earlier dancing manias" is context/comparison, not evidence *for* 1518 — miscategorized. "Municipal and historical records" is the real evidence but names nothing specific. |
| **Sources** | Absent — and here it bites hardest, because the myth-correction in What's Disputed has no backing; the reader must just trust it. |
| **Keep Digging** | 5 links. "The Dancing Mania of 1374" is a strong sibling case. "Ergotism" ("often invoked… too casually") echoes the What's-Disputed spirit well. But "Medieval Disease and Supernatural Belief" and "Collective Behavior Under Stress" are themes, not stories — verging on tags. 3/5 are concept links. |

**Verdict:** Best What's Disputed (myth-correction). Hook a touch too casual.
What We Know too vague from over-caution. What Makes It Strange overlaps the Hook.
Timeline is the most forced in the set. No Sources.

### 1.4 MKUltra

| Field | Assessment |
|---|---|
| **Hook** | Excellent. "MKUltra sounds like the kind of program conspiracy theorists would invent. It wasn't." Pre-empts the reflex and asserts documented reality; the restraint is the power. |
| **Quick Answer** | Good content, well-calibrated on the consent distinction and the 1973 record destruction. But heavy staccato ("Some experiments involved volunteers. Others involved unwitting subjects. That distinction is crucial.") — a style tic that also shows up in Octopus. Tighten ~20%. |
| **What We Know** | Strong — and appropriately *long*, because a lot is genuinely established (Church Committee, 1977 Senate hearings, CIA's own admissions). Good sign: the section scales with how much is actually known. |
| **What Makes It Strange** | Weakest section for this topic. It's a list of things already stated in the Hook and What We Know (safe houses, unwitting dosing, front organizations, record destruction). MKUltra isn't "strange" — it's *disturbing and proven*. The field forces a mystery framing onto a topic whose defining quality is documentation. Clearest single piece of evidence that this field doesn't generalize. |
| **What's Disputed** | Draws the fact/claim boundary well ("The existence of MKUltra is not disputed… what remains contested is the exact scale… and the legitimacy of numerous claims later associated with it"). But overlaps What's Still Unknown (scale) and the Claims section. |
| **What's Still Unknown** | Concrete and genuinely unresolved (number of unwitting subjects, full institution list, scope of destroyed projects). Overlaps What's Disputed. |
| **Theories / Explanations** | Retitled **"EXPLANATIONS / CLAIMS"** — the author *had to rename the field* because MKUltra has no competing explanations. It becomes a claims audit (true vs. overclaimed), which is genuinely more useful for a documented topic — but entries 1–2 (CONFIRMED) duplicate What We Know exactly and entries 3–4 (UNSUPPORTED) duplicate What's Disputed. Labels are binary here (no PLAUSIBLE) — a documented topic needs 2 states, not 6. |
| **Timeline** | Best-justified of the five. MKUltra runs 1953 → 1964 → 1973 → 1977 and that arc is the spine of the story. "1964… ended or reorganized" is slightly hedgy but fine. |
| **Evidence** | Best Evidence section of the five — because MKUltra has real, nameable, external evidence (Church Committee, Senate hearings, CIA Reading Room, the DCI's testimony). Comes closest to the brief's hope ("help users understand WHY a source matters"). Still lists evidence *types* rather than citing specific documents/dates. |
| **Sources** | No formal section; Evidence partly substitutes. Still no links, no "S. Rep. 94-755," nothing a reader can jump to. |
| **Keep Digging** | **Strongest set of the five.** 4 of 5 are "directly involved" — Operation Midnight Climax, Sidney Gottlieb, Frank Olson, the Church Committee — exactly what a reader wants next, each with a clear relationship sentence. Zero tags in disguise. This is the model for what Keep Digging should be — and it's strong *because MKUltra is a story with named people, orgs, and events.* |

**Verdict:** Best Hook, Evidence, and Keep Digging. But it exposes the model's
biggest flaw: "What Makes It Strange" and "Theories" don't fit a documented topic
— one field had to be renamed, the other filled with restated facts. "Records
destroyed in 1973" appears **eight times** across the piece.

### 1.5 Why Are Octopuses So Intelligent?

| Field | Assessment |
|---|---|
| **Hook** | Strong, specific, counterintuitive ("most of them are not in its brain"), and sets up the real thesis: it's about *architecture*, not IQ. The only non-mystery topic, and the hook works fine — curiosity ≠ mystery. |
| **Quick Answer** | Good content, heavy staccato again ("Its nervous system is distributed."). The word "strange" is forced ("The really strange part…") — octopus cognition is remarkable and alien, but "strange" makes it sound like an anomaly to be solved. |
| **What We Know** | Solid and appropriately confident — these findings *are* established. Shows the section works for science: it's just "the established results." One bullet restates "evolved independently" from the Quick Answer. |
| **What Makes It Strange** | The most substantive version of this field — it does real explanatory work (no skeleton → near-infinite arm configurations → central control is intractable → distributed processing). But that *is the answer to the title question*, so it should be the core body, not a "strange" sidebar. "An octopus doesn't just have a strange body. It has a strange architecture of intelligence" — the strange/strange repetition is a tic. |
| **What's Disputed** | Weakest for this topic. It picks a semantic quibble ("is it useful to say the arms have 'minds of their own'") and omits the *real* disputes: octopus consciousness/sentience (active, policy-relevant — the UK Sentience Act), the significance of cephalopod RNA editing, whether observational-learning results replicate. Shows the field can be filled lazily. |
| **What's Still Unknown** | Good — a real current research frontier (how information integrates across brain, optic lobes, arm cords, suckers; new free-behavior neural recording). For science, "What's Still Unknown" = "the open research questions" works well. |
| **Theories / Explanations** | Mostly misfires. Entries 1–2 (distributed nervous system, complex body drives control) are not *competing* — both are true and complementary, and both restate What Makes It Strange. Labeling an anatomical fact "CONFIRMED" inside a section called "Explanations" is odd. Only entry 3 (shell loss) is a genuine hypothesis, and it's handled well ("not a simple single-cause explanation"). The other real hypotheses (predation pressure, foraging-niche complexity, the absence-of-sociality puzzle) are missing. |
| **Timeline** | **Correctly absent.** The author recognized a "why are octopuses smart" question has no timeline. This is the right call — and it shows Timeline is *already* being treated as optional in practice. |
| **Evidence** | All four entries are "Type: Research." The label carries zero information when everything is the same type. These are research *areas*, not sources — no specific papers (e.g. Albertin et al. 2015 for the genome). Reads exactly like "a research report" (the brief's stated fear) and duplicates What We Know. Strong evidence that Evidence-as-section fails for science. |
| **Sources** | Absent — and the piece makes specific contestable numbers ("close to 500 million neurons", "large proportion… outside the central brain") with nothing behind them. |
| **Keep Digging** | Second-best set. "Soft Robotics" (engineers borrow octopus-arm ideas) is an excellent, concrete "what came next." "Animal Consciousness" is strong — and it's exactly where the omitted What's-Disputed content belongs. "Octopus Camouflage" is a great standalone RabbitHole. "Distributed Intelligence" is the most tag-like (a concept prompt) but still a real intellectual extension. Shows abstract topics *can* generate good connections if they touch real applications and debates. |

**Verdict:** Proves curiosity works without mystery. But it's where the
mystery-shaped fields visibly strain: "What Makes It Strange" is really "the
explanation," "What's Disputed" is a lazy quibble, "Explanations" lists
non-competing facts, "Evidence" is four identical labels. Timeline correctly
dropped. "Strange" forced four times.

---

## 2. Cross-sample findings

### Worked across all five
- **Hook.** Strongest field, no exceptions. Concrete, fast, non-sensational every time.
- **What We Know.** Worked in all five; quality tracked how much is actually known
  (rich for MKUltra, hollow for Dancing Plague where caution gutted it). Scannable
  bullets is the right format.
- **Keep Digging.** Worked in all five, quality varying. Best when the topic has
  named people/events (MKUltra); drifts to glossary/concept links for abstract
  topics (Octopus, Dancing Plague).

### Worked only for certain subject types
| Field | Works for | Fails / strains for |
|---|---|---|
| **What Makes It Strange** | genuine mysteries with a logical puzzle (Dyatlov; Wow! partly) | documented topics (MKUltra — wrong frame), science (Octopus — it's just "the explanation"), and it duplicates the Hook for Dancing Plague |
| **What's Disputed** | "the popular version is overstated" (Dancing Plague, MKUltra) or "is the leading theory sufficient" (Dyatlov) | topics with no real dispute (Wow! — restates Explanations; Octopus — semantic quibble) |
| **Theories / Explanations** | open mysteries with genuinely competing accounts (Wow!, Dyatlov, Dancing Plague) | documented topics (MKUltra — renamed "Claims", entries restate facts), science (Octopus — entries aren't competing) |
| **Timeline** | stories that unfold over time where sequence carries meaning (MKUltra 1953→1977; Dyatlov incident + recovery gap) | topics with 1–2 dated events (Wow!, Dancing Plague — padded with filler rows); correctly absent for Octopus |
| **Evidence (as a section)** | topics with a formal external documentary record (MKUltra) | everything else — re-describes the phenomenon (Wow!), one-sided (Dyatlov), miscategorized context (Dancing Plague), or a duplicate of What We Know (Octopus) |

### Felt redundant
- **What's Disputed + What's Still Unknown + Theories** all circle "what we're not
  sure about." In Wow! and MKUltra the reader hits the same content three times.
  Only Dyatlov splits them cleanly.
- **What Makes It Strange vs. Hook** — heavy overlap in Dancing Plague and MKUltra.
- **Evidence vs. What We Know** — same content, two formats (Octopus, partly Dyatlov).
- **Quick Answer previews the leading explanation**, which then reappears in full
  downstream (Dyatlov's slab avalanche: 5 total appearances).

### Felt too academic
- **Evidence**, universally. "Type: Research / Primary source / Field evidence"
  labels and prose like "Genomic work revealed major expansions and innovations…"
  This is the "research report" feeling the brief wants to avoid.
- **Theories with formal credibility labels on science topics** — makes octopus
  neuroscience look like a debate board.

### Felt too long
- **Quick Answer** — all five run 4–5 paragraphs where 2–3 sentences would do.
- Cumulatively: each sample is ~700–1,100 words and *reads* longer because of the
  3× redundancy on "what's uncertain." "Records destroyed in 1973" × 8 in MKUltra
  is the canonical failure.

### Should become optional
- **Timeline** (already de facto optional — Octopus omits it).
- **What Makes It Strange.**
- **Evidence** (or removed — see below).

### Should be merged
- **What's Disputed + What's Still Unknown + Theories/Explanations** → one section.
- **What Makes It Strange** → into the Hook.
- **Evidence** → into inline source markers on specific claims + a Sources list.

### Should be removed entirely
- **Evidence** as a standalone section.
- **What Makes It Strange** as a distinct field.
- The separate **Theories** field (folds into the merged "contested/open" section).

### Can one structure support all subject types?
Yes — **if the mystery-shaped fields are collapsed.** The skeleton that generalizes:

> **Hook → the short version → what we know → what's contested or still open → keep digging → sources**

That holds for historical mysteries (Dyatlov, Dancing Plague), unexplained events
(Wow!), documented programs (MKUltra — "contested/open" carries "documented core
vs. speculative accretion"), and scientific questions (Octopus — "contested/open"
= "open research questions + the one speculative hypothesis"). It also fits the
stated future subjects: crime, internet culture, lost media, historical oddities,
disputed claims (for which the "contested" section *is* the point).

The one real stretch is a pure science explainer with no mystery and no dispute —
there "contested/open" becomes mostly "open questions," which is acceptable, and
the piece leans on Hook + What we know + Keep digging. It still reads as RabbitHole
because of the Hook voice and the connection model.

---

## 3. Recommended V1 RabbitHole structure

Nine named parts: **8 required, 1 optional.** Down from 11 heavy sections to
6 required prose/list sections + Sources + optional Timeline.

### 3.1 Title
- **Purpose:** the subject, as a noun phrase or a question.
- **Required.**
- **Length:** ≤ 60 characters.
- **Display:** page H1.
- **Sourcing:** n/a.

### 3.2 Subtitle / one-line definition
- **Purpose:** plain-language "what is this," so the reader is oriented *before*
  the Hook's flourish. *"A radio signal detected once in 1977 and never
  explained." / "A Cold War CIA program of human experimentation."*
- **Required.**
- **Length:** ≤ 140 characters, one sentence, no drama.
- **Display:** directly under the title, smaller type.
- **Sourcing:** none (it's a definition).

### 3.3 Hook
- **Purpose:** create curiosity in 2–4 sentences and establish why this is worth
  the reader's time. **Absorbs the old "What Makes It Strange"** — the strange or
  compelling core lives here.
- **Required.**
- **Length:** 40–80 words. Hard cap 90.
- **Display:** first paragraph, slightly larger type.
- **Sourcing:** no inline citations in the Hook itself; any factual claim in it is
  restated and cited in "What we know."
- **Rules:** concrete detail over adjectives; name the payoff if there is one
  (Dyatlov's *"points toward something much less exotic — but still terrifying"*
  is the model); never overclaim.

### 3.4 The short version *(was "Quick Answer")*
- **Purpose:** the honest, spoiler-inclusive summary — what it was, the current
  best understanding, and explicitly what is **not** known. A reader who stops
  here should leave accurate.
- **Required.**
- **Length:** 60–90 words. Hard cap 110. **One short paragraph, not five.**
- **Display:** immediately after the Hook.
- **Sourcing:** 0–2 inline markers maximum (only a load-bearing number or the
  single most contestable claim).
- **Rules:** must include one clause of the form *"what remains
  unknown/disputed is ___."* Must **not** fully pre-explain the leading theory —
  one clause, not a paragraph; the body carries it.

### 3.5 What we know
- **Purpose:** the established-fact backbone. This is the credibility engine.
- **Required.**
- **Length:** 4–8 bullets, each ≤ 25 words.
- **Display:** bulleted list. A bullet carries a small state chip **only** when
  it is not self-evidently established (default = no chip). Inline source marker
  on bullets that are surprising, numeric, or contestable.
- **Sourcing:** every non-obvious factual bullet is traceable to a listed source;
  aim for ≥ half the bullets cited.
- **Rules:** bullets are **facts, not findings-in-progress.** "Modeling suggests X
  is plausible" is not a What-we-know bullet — it goes in 3.6. Keep the vivid
  specifics (put a "Contested" chip on the one disputed detail rather than
  removing the detail — this is the Dancing Plague failure to avoid).

### 3.6 What's contested or still open *(merges Disputed + Unknown + Theories)*
- **Purpose:** the single home for everything unsettled — competing explanations,
  overstated popular claims, and genuine open questions. This is the "keep
  digging" emotional core.
- **Required** (but may be as short as two sentences when a topic is genuinely
  settled — rare).
- **Length:** 100–250 words. Hard cap ~300.
- **Structure:**
  - If explanations compete: a short list — **max 4, show 3** — each = one-line
    claim + state label + one-line **"why it's unsatisfying / what it can't
    explain"** (the Wow! "Problem:" line — the best device in any sample; make it
    **mandatory**).
  - Optionally open or close with 1–2 sentences on what popular accounts overstate
    (the Dancing Plague move) and/or the genuine open question (the Dyatlov *"those
    details died with them"* move).
- **Display:** section with optional sub-list; state chips inline.
- **Sourcing:** each competing explanation cites its main proponent/source where
  one exists ("argued by historian John Waller"; "Gaume & Puzrin, 2021").
- **Rules:** no explanation without a "why it's not the whole answer" line.
  **Never manufacture a dispute** — if it's settled, say so in a sentence and move
  on.

### 3.7 Timeline — **optional**
- **Purpose:** only when the story unfolds over time **and** sequence changes
  understanding.
- **Optional.** Include only if there are **≥ 4 genuinely dated/datable events**
  and order matters.
- **Length:** 4–8 entries; each = date + ≤ 15 words. **No "Following decades /
  Today / Later" filler rows.**
- **Display:** compact vertical list; collapsible beyond 6.
- **Sourcing:** inherits from What we know / Sources; no per-entry citation.
- **Rules:** incident timeline and research-history timeline are different things
  — pick one (usually the incident). If you cannot fill 4 real dated rows, cut it
  and put the progression in one What-we-know bullet.

### 3.8 Keep digging — the connection set
- **Purpose:** 3–5 onward paths, each answering *"why would someone who just read
  this care about that?"*
- **Required.** Minimum 3, ideal 4, max 5.
- **Length:** each = destination title + one sentence (≤ 25 words) stating the
  **relationship**, not a definition.
- **Display:** list at the end, above Sources. The single strongest link also
  surfaces once mid-page (after "What we know") and once above the fold.
- **Sourcing:** n/a.
- **Rules:** (a) every link carries a relationship type (§6); (b) **no link whose
  only justification is a shared tag/theme**; (c) prefer links to other
  RabbitHoles — a link to a not-yet-written one is allowed but marked, and counts
  toward the minimum only up to 1 of 3; (d) at least one link is "same kind of
  thing" or "bigger picture" so the reader can zoom out, not only drill in.

### 3.9 Sources
- **Purpose:** verifiability — the trust proposition.
- **Required.** 5–15 entries.
- **Length:** standard citation lines (author/institution, title, year, link). No
  annotation paragraphs (that was the "Evidence" mistake). An optional ≤ 12-word
  note only where a source needs context ("the authoritative first-person
  account").
- **Display:** collapsed list at the bottom; a visible **source count** near the
  top ("14 sources") as a trust signal and jump link. Inline markers in the body
  are superscript links into this list.
- **Which claims MUST carry an inline citation:** (a) any specific number or
  measurement; (b) any claim a reasonable reader would doubt or find surprising;
  (c) any contested claim, or any position attributed to a named person; (d) any
  claim that corrects a popular belief.
- **Which must NOT:** self-evident context, definitions, plain common knowledge.
  Over-citing ("Strasbourg is in France ³") is the annoyance to avoid.

### Removed from the original 11
- **What Makes It Strange** → folded into the Hook.
- **What's Disputed + What's Still Unknown + Theories/Explanations** → merged into
  §3.6.
- **Evidence** (standalone section) → removed; its useful function ("why a source
  matters") becomes the optional ≤ 12-word note in Sources plus inline citations.

---

## 4. Required vs optional fields

| Field | Status |
|---|---|
| Title | **Required** |
| Subtitle / one-line definition | **Required** |
| Hook | **Required** |
| The short version | **Required** |
| What we know | **Required** (4–8 bullets) |
| What's contested or still open | **Required** (may be 2 sentences if genuinely settled) |
| Timeline | **Optional** — only if ≥ 4 real dated events and sequence matters |
| Keep digging | **Required** (≥ 3, ideal 4, max 5) |
| Sources | **Required** (≥ 5; "0 sources" is a publish blocker) |

---

## 5. Recommended credibility model

**Six states are too many.** The samples prove it: authors never used DISPUTED or
DEBUNKED as explanation labels, and invented new ones instead — **UNVERIFIED**,
**PLAUSIBLE CONTRIBUTING FACTOR**, **HISTORICAL BELIEF — NOT SUPPORTED** (three
new labels across five pieces). Of the three that were used, CONFIRMED / SUPPORTED
/ PLAUSIBLE under-discriminated (Wow! labeled 2 of 3 explanations "PLAUSIBLE"; the
"Problem:" sentence did the real work).

### Minimum viable system: 3 states + 1 flag

| Label | Meaning | Absorbs |
|---|---|---|
| **Established** | Broad agreement among qualified people; good evidence. Default for "What we know" bullets (no chip needed there); appears as a chip in §3.6 to mark the leading explanation. | CONFIRMED + SUPPORTED |
| **Contested** | Credible people actively disagree; the evidence genuinely underdetermines the answer. | DISPUTED |
| **Unsupported** | Proposed but nothing backs it — including "not impossible, but no evidence." | PLAUSIBLE-without-evidence + UNSUPPORTED + UNVERIFIED |
| **Debunked** *(flag)* | Actively checked and shown false — not merely unsupported. Often the most satisfying thing in a RabbitHole (the comet hypothesis for Wow!; ergotism for Dancing Plague). Use sparingly. | DEBUNKED |

**Why it works without a legend:** the words self-explain in plain English —
unlike "SUPPORTED vs PLAUSIBLE," which needs a rubric. It draws the one line that
matters (**fact vs. claim** = Established vs. everything else) and one useful
sub-line (**real debate vs. fringe** = Contested vs. Unsupported).

**Works across domains:** a scientific finding is Established or Contested; a
historical theory is Contested or Unsupported; a government fact is Established; an
internet rumor is Unsupported or Debunked.

**Rules:**
- Contested and Unsupported are different **kinds**, not degrees. Never show a
  confidence percentage or numeric certainty score.
- **Every non-Established label must be accompanied by its one-line reason** (the
  "Problem:"/"why" line). A bare chip is not allowed — that is what prevents
  vibes-based adjudication.
- No page-level "overall credibility" badge. A RabbitHole contains a mix of
  settled and open claims; a single badge would be false precision.
- Keep a short written editorial standard for what earns "Established" vs.
  "Debunked" (who counts as "qualified people," what counts as "checked").
- For history/culture, the "what people believed at the time" distinction
  (Dancing Plague's ad-hoc label) is handled in prose, not as a fourth state:
  write "contemporaries interpreted this as a curse" and label the *medical*
  claim separately.

---

## 6. Recommended connection model

A connection qualifies **only** if it can answer, in one sentence a reader would
find true: *"Because you just read about X, here is why Y matters to you."* A
shared tag or theme is never sufficient.

### Relationship types — a small closed set

They materially help: the reader can predict the *kind* of jump (deeper into this
story vs. sideways to a sibling vs. up to the big picture).

| Type | Meaning | Examples from the samples |
|---|---|---|
| **Involved** | A person, place, organization, or sub-event that is part of this story. | MKUltra → Sidney Gottlieb, Frank Olson, Operation Midnight Climax |
| **Same kind of thing** | A sibling case or analogous phenomenon. | Wow! → Fast Radio Bursts; Dancing Plague → the 1374 dancing mania |
| **Bigger picture** | The larger context or category this sits inside. | Octopus → convergent evolution; Dyatlov → how hypothermia affects judgment |
| **What came next** | A downstream consequence or modern echo. | MKUltra → the Church Committee and post-1976 human-subjects rules; Octopus → soft robotics |
| **Competing explanation** | Another RabbitHole that argues a different answer to the same question. | a dedicated "infrasound / katabatic wind" RabbitHole vs. the avalanche account |

**If five types prove too heavy in practice, collapse to three:** *Involved ·
Similar · Context* (fold "what came next" into Context, "competing explanation"
into Similar). **Do not go below three** — a typeless "related" list is what the
old tag-graph produced, and it carried no meaning.

**Hard rules:**
- Exactly one type and one ≤ 25-word "why you'd care" sentence per connection,
  describing the **relationship**, not the destination ("The congressional
  investigation that exposed this" — not "A 1975 Senate committee").
- **No auto-generation from shared tags.** Connections are authored.
- 3–5 per RabbitHole. A 6th is a sign the piece is trying to be comprehensive.
- **At least one non-"Involved" link**, so every RabbitHole offers a way to zoom
  out.
- Links to unwritten RabbitHoles are allowed, marked "coming soon," and count
  toward the minimum only up to 1 of 3.
- Editorial review asks, per link: *"would a real person actually click this?"*
  ("Technosignatures," "Distributed Intelligence" — the borderline cases in the
  samples — fail this unless the sentence states a real relationship.)

---

## 7. First-screen information hierarchy

What a reader sees before scrolling, on an individual RabbitHole page:

1. **Title** (H1).
2. **Subtitle** — the plain one-line definition. → *What is this?*
3. **Source-count chip** — e.g. "14 sources," small, under the subtitle or
   top-right; jump-links to Sources. → *Why should I trust RabbitHole?*
   (citations exist, visible immediately)
4. **Hook** — 2–4 sentences. → *Why is it interesting?*
5. **The short version** — ~70 words, including the "what's not known" clause. →
   *What do we actually know?* (honestly, spoilers included)
6. **First 2–3 "What we know" bullets** — visible, with state chips if any and
   inline source markers. → reinforces *what we know* + *why trust* (the reader
   sees real citations, not just a count).
7. **One "Keep digging" link** — the single strongest connection, with its
   one-sentence why and its type. → *What can I do next?*

**Approximate above-the-fold text length: 130–180 words** (subtitle ~15 + hook
~60 + short version ~75 + partial bullets ~30 visible).

- **Evidence / source indicators appear immediately:** the source-count chip in
  the header and real inline citation markers on the first visible bullets. No
  separate "evidence" UI.
- **Credibility / state labels appear immediately, but only where the claim is not
  "Established."** Default bullets show no chip (chipping everything is noise). A
  "Contested" / "Unsupported" / "Debunked" chip on a first-screen bullet is fine
  and useful. **No page-level credibility badge.**
- **The first related RabbitHole is visible above the fold** — exactly one, the
  strongest, with its "why." The full Keep digging set stays at the bottom.

---

## 8. Length / depth guidelines

| Dimension | V1 target |
|---|---|
| Total body length | **450–800 words**; hard ceiling 1,000 |
| Major sections | 5 (Hook, Short version, What we know, Contested/open, Keep digging) + Sources + optional Timeline. Never more. |
| "What we know" bullets | 4–8 |
| Competing explanations | max 4; show 3, "+1 more" expands |
| Timeline entries | 8 max; collapse beyond 6 |
| Keep digging links | 3 min, **4 ideal**, 5 max |
| Sources | 5 min, ~15 practical max for V1 |
| Inline citations in body | ~4–10. A 600-word piece with 25 superscripts is over-cited. |
| Reading time | 3–4 minutes; if over 5, cut |

**Explicit non-goal: comprehensiveness.** A RabbitHole is a doorway, not an
encyclopedia entry. If a reader could get the same thing from the Wikipedia lead
plus infobox, the RabbitHole has failed — the difference must be the honest
framing, the "why it's unsatisfying" lines, and the connections.

---

## 9. What should NOT be in V1

- A standalone **Evidence** section.
- A separate **What Makes It Strange** field.
- Separate **What's Disputed** / **What's Still Unknown** / **Theories** fields
  (they are one section).
- A **6-level credibility scale** (use 3 + a Debunked flag).
- A page-level **"overall credibility" badge**.
- **Auto-generated / shared-tag connections.**
- **Per-sentence or near-per-sentence citations.**
- A **required Timeline.**
- **Confidence percentages** or numeric certainty scores.
- Reader-facing **"Type:" metadata labels** (Scientific observation / Primary
  source / Field evidence).
- **Multiple images, galleries, media embeds.** V1 is text + at most one image.
- **Comments, votes, user contributions, hop/thump reactions.**
- **Author-voice tics:** the "One-line. Sentence. Fragment." staccato used heavily
  in MKUltra and Octopus; the word "strange" as a crutch on non-mystery topics.
- Any attempt to make **every subject sound unsolved.**

---

## 10. Major product risks revealed by these five samples

1. **The model manufactures mystery.** "What Makes It Strange" + "Theories" +
   credibility labels push every subject toward "unsolved mystery" framing. On
   MKUltra the author had to rename a field and restate facts as "claims"; on
   Octopus "strange" is forced four times and "Explanations" lists non-competing
   facts. Applying mystery scaffolding to non-mysteries reads as conspiratorial
   and *loses* credibility on exactly the topics where RabbitHole should be
   strongest.
   **Mitigation:** the merged "contested/open" section may say "this is settled"
   in one sentence; the Hook carries the interest with no dedicated "strange"
   field.

2. **The catalog will skew to mysteries and the model reinforces it.** Four of
   five samples are unexplained events; the fields fit them best. Unchecked,
   RabbitHole becomes an unsolved-mysteries wiki, not a curiosity engine.
   **Mitigation:** before engineering, write 3–5 more RabbitHoles that are
   explicitly **not** mysteries (a scientific concept, a historical process with a
   known cause, an internet-culture explainer) and confirm the V1 skeleton holds.
   Track a mystery / non-mystery ratio in the catalog.

3. **Credibility labeling implies an authority RabbitHole hasn't established.**
   "CONFIRMED" / "DEBUNKED" are strong editorial claims. Six levels = six judgment
   calls per fact, and the samples show authors cannot apply them consistently
   (three invented labels in five pieces).
   **Mitigation:** 3 states + Debunked, **each requiring a stated one-line
   reason** (never a bare chip), plus a short written editorial standard for what
   earns "Established" vs. "Debunked."

4. **The sourcing / readability tension is the central design problem, and V1
   does not fully resolve it.** Strong sourcing is the trust proposition, but the
   "Evidence" section made every sample read like a research report — and **none
   of the five actually has a Sources section or one inline citation.** The claims
   are currently unverifiable.
   **Mitigation:** kill the Evidence section; require inline citations on the four
   claim-types; require a real Sources list; treat "0 sources" as a publish
   blocker.

5. **"Keep Digging" is the product, and it is the least controlled field.**
   MKUltra's connections (named people/events) are excellent; Octopus's and
   Dancing Plague's drift toward glossary/concept links; several
   ("Technosignatures," "Distributed Intelligence") are one definition away from
   being tags. If connections do not reliably answer "why would I care," RabbitHole
   is just short articles.
   **Mitigation:** closed relationship-type set; mandatory ≤ 25-word relationship
   sentence; no tag-derived links; per-link editorial review ("would a real person
   click this?").

6. **Redundancy makes short pieces feel long.** Every sample states its premise 3×
   (Hook / Quick Answer / What Makes It Strange) and its uncertainty 3× (Disputed
   / Unknown / Theories). A 700-word piece reads like 1,200. "Records destroyed in
   1973" appears **8×** in MKUltra.
   **Mitigation:** the §3 merges; a hard rule that **no fact appears in more than
   two sections.**

7. **"What we know" degrades when the author is cautious.** Dancing Plague's is
   vague precisely because the vivid specifics are handled cautiously elsewhere.
   The section that carries credibility gets hollowed out.
   **Mitigation:** keep specific facts in "What we know" with a citation and, if
   needed, a "Contested" chip on the one disputed detail — do not remove the
   detail.

8. **Timeline invites padding.** Wow! and Dancing Plague both have timelines with
   1–2 real events and filler rows.
   **Mitigation:** the 4-real-dated-events gate; if it fails, one sentence in
   "What we know" instead.

---

## Appendix — the V1 skeleton at a glance

```
TITLE
subtitle (one plain sentence)                                    · 14 sources ·

HOOK                              2–4 sentences, 40–80 words, absorbs "why strange"
THE SHORT VERSION                 1 paragraph, 60–90 words, includes "what's unknown"
WHAT WE KNOW                      4–8 bullets · state chip only if not Established
                                            · inline citation on surprising/numeric/contested
  › keep digging: [strongest connection]

WHAT'S CONTESTED OR STILL OPEN    100–250 words
  competing explanations (max 4, show 3):
    claim — [Established | Contested | Unsupported | Debunked] — why it's not the whole answer
  + what popular accounts overstate / the genuine open question

TIMELINE (optional)              only if ≥4 real dated events and order matters; 4–8 rows

KEEP DIGGING                      3–5 links · each: [type] + one ≤25-word "why you'd care"
                                   types: Involved · Same kind of thing · Bigger picture ·
                                          What came next · Competing explanation

SOURCES                          5–15 · plain citation lines · inline superscripts resolve here
```
