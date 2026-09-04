# RabbitHole — Six Initial Content Networks

Companion to [`RABBITHOLE_PRODUCT_MODEL.md`](./RABBITHOLE_PRODUCT_MODEL.md). This is not a
generic catalog plan — it's six deliberately small, deliberately excellent curiosity networks.
Quality over graph density: nothing below was added just to make a network look bigger, and each
network says explicitly where a branch would have been forced and was left out instead.

Every "why this connects" line is written the way it should eventually render in the product —
short, concrete, answering "why does following this make sense?" in one or two sentences.

Existing-content mappings are checked against the real, current 39-item catalog (pulled live from
the `rabbithole-dev-videos` table — see [`RABBITHOLE_CONTENT_AUDIT.md`](./RABBITHOLE_CONTENT_AUDIT.md)
for the full inventory). Nothing here assumes content that isn't actually in the catalog today.

---

## 1. Abandoned / Uncanny

**Primary entry topic:** Abandoned Places

### Nodes (12)
Abandoned Places · Abandoned Malls · Urban Exploration · Liminal Spaces · The Backrooms ·
Nostalgia · Uncanny Valley / Uncanny Environments · Architectural Decay · Ghost Towns ·
Chernobyl / Exclusion Zones · Childhood Environments · Found Footage / Time Capsules

### Connections

| From | To | Relationship | Why this connects |
|---|---|---|---|
| Abandoned Places | Abandoned Malls | specific instance | Malls are one of the most visually iconic and widely documented forms of abandonment — a very recent kind of decline. |
| Abandoned Places | Urban Exploration | practice / subculture | Urban exploration is the human activity built entirely around seeking out and documenting abandoned places. |
| Urban Exploration | Liminal Spaces | aesthetic overlap | Explorers' photos of empty transitional spaces are the primary source material that popularized the liminal-space aesthetic. |
| Liminal Spaces | The Backrooms | origin / derivative | The Backrooms creepypasta formalized the liminal-space aesthetic into an explicit fictional mythology of endless empty rooms. |
| Liminal Spaces | Uncanny Valley / Environments | psychological mechanism | Liminal spaces unsettle people for the same reason near-human faces do: something that should be familiar is subtly, unplaceably wrong. |
| Nostalgia | Liminal Spaces | emotional driver | Liminal-space imagery draws its power from evoking a half-remembered, specific-yet-generic past rather than any one real memory. |
| Nostalgia | Childhood Environments | subject | Childhood environments — schools, playgrounds, family homes — are the specific kind of place nostalgia most often attaches to. |
| Childhood Environments | Found Footage / Time Capsules | evidentiary form | Home movies and street-level film are often the only surviving record of what a childhood environment actually looked like. |
| Abandoned Places | Architectural Decay | physical process | Decay is the physical process that turns an ordinary, once-used building into "abandoned" in the first place. |
| Architectural Decay | Ghost Towns | scale-up | A ghost town is architectural decay applied to an entire settlement instead of a single building. |
| Ghost Towns | Chernobyl / Exclusion Zones | extreme case | Chernobyl is the starkest modern ghost-town case: a whole region abandoned suddenly, for a reason, rather than gradual economic decline. |
| Chernobyl / Exclusion Zones | Urban Exploration | closes the loop | The exclusion zone has become one of urban exploration's most famous — and most regulated — destinations. |

### Sample paths
1. Abandoned Places → Urban Exploration → Liminal Spaces → The Backrooms
2. Abandoned Places → Architectural Decay → Ghost Towns → Chernobyl / Exclusion Zones
3. Nostalgia → Childhood Environments → Found Footage / Time Capsules
4. Liminal Spaces → Uncanny Valley / Environments → Nostalgia
5. Abandoned Malls → Urban Exploration → Chernobyl / Exclusion Zones

### Existing content
- **A Trip Down Market Street** (1906 street-level film of San Francisco, shot days before the
  1906 earthquake — most people on camera would be dead within the week) — an excellent,
  already-owned fit for **Found Footage / Time Capsules** and **Nostalgia**. This is the single
  best "why didn't we already position it this way" find in the whole audit.

### Gaps
Everything else. Abandoned malls, Backrooms, ghost towns, and Chernobyl footage are all gaps —
realistically almost entirely **External** tier (urban-exploration creators' own footage isn't
something RabbitHole would re-host).

### Indexed vs. External
- **Indexed where it matters:** narrated Chernobyl/ghost-town documentary content with an
  interview or explanatory voiceover — moment search ("the exact moment they describe entering
  reactor 4") adds real value there.
- **External is sufficient for:** almost everything else in this network. It's a visual,
  aesthetic, mood-driven topic; the footage itself is the payload, not a searchable quote.

### Notes
No branch removed. One caution, not a removal: keep "Uncanny Valley" scoped to *environments and
places* here — the term also covers robotics/CGI faces, which is a different (and, for this
network, off-topic) conversation.

---

## 2. Crime / Memory / Justice

**Primary entry topic:** False Confessions

**Curation guardrail:** mystery, investigation, psychology, systems, evidence, human stories —
not a true-crime shock feed. Nothing graphic; the interest is in *why the system produces the
outcome it does*, not in the crime itself.

### Nodes (11)
False Confessions · Interrogation Tactics · Coercion · Memory · Eyewitness Reliability ·
Wrongful Convictions · DNA Exoneration · Forensic Psychology · Criminal Profiling ·
Missing Persons · Cold Cases

### Connections

| From | To | Relationship | Why this connects |
|---|---|---|---|
| False Confessions | Interrogation Tactics | mechanism | Certain interrogation techniques are specifically documented to raise the risk of eliciting a false confession. |
| Interrogation Tactics | Coercion | spectrum | The line between persuasive and coercive interrogation is exactly where most false-confession cases sit. |
| False Confessions | Memory | causal mechanism | Suggestive questioning can cause a person to genuinely misremember events, not merely misreport them. |
| Memory | Eyewitness Reliability | shared mechanism | Eyewitness testimony relies on the same reconstructive memory process that makes false confessions possible — memory is edited every time it's recalled. |
| Eyewitness Reliability | Wrongful Convictions | leading cause | Mistaken eyewitness identification is the single most common contributing factor in documented wrongful convictions. |
| False Confessions | Wrongful Convictions | leading cause | False confessions are the second most common contributing factor in the same wrongful-conviction data. |
| Wrongful Convictions | DNA Exoneration | resolution mechanism | DNA testing is the primary tool that has retroactively proven a wrongful conviction in hundreds of cases. |
| Forensic Psychology | Interrogation Tactics | discipline | Forensic psychologists study — and increasingly help reform — how interrogation actually affects memory and statement reliability. |
| Forensic Psychology | Criminal Profiling | application | Criminal profiling applies the same psychological pattern-analysis discipline to unknown offenders. |
| Criminal Profiling | Cold Cases | application | Profiling is most often invoked publicly in relation to unsolved, long-dormant cases. |
| Missing Persons | Cold Cases | overlap | A missing-persons case that goes unsolved long enough becomes, by definition, a cold case. |
| Missing Persons | Eyewitness Reliability | mechanism | Missing-persons investigations lean heavily on witness accounts, with the same reliability problems as any other eyewitness testimony. |

### Sample paths
1. False Confessions → Interrogation Tactics → Coercion
2. False Confessions → Memory → Eyewitness Reliability → Wrongful Convictions → DNA Exoneration
3. Forensic Psychology → Criminal Profiling → Cold Cases
4. Missing Persons → Cold Cases → Criminal Profiling
5. Memory → Eyewitness Reliability → Missing Persons

### Existing content
- **Mind Mappers** (`brain`, `neuroscience`, `humanbehavior`) — a *possible* reposition into
  **Memory** or **Forensic Psychology**, but its actual subject (brain-mapping research, per the
  title) needs a quick re-watch before committing it here; flagged in the audit as "verify before
  placing," not a confirmed fit.
- **Science of Shopping** (`humanbehavior`, `psychology`, `retail`) — better home is network 5
  (Belief / Influence); noted here only to rule it out rather than force it in.
- Nothing else in the catalog is a real fit. Do not stretch wildlife/nature footage or NPS
  civil-rights history into this network just to populate it.

### Gaps
The entire network is a content gap. This is one of the highest-value networks for genuinely
new material.

### Indexed vs. External
- **Indexed matters most here:** interrogation-footage and forensic-psychology interview content
  — "show me the exact moment the tactic was used" or "the moment she describes what the
  detective told her to say" is precisely the exact-moment-search use case RabbitHole is built for.
- **External is sufficient for:** case-overview / cold-case summary documentary content where the
  visual case narrative matters more than a specific quote.

### Notes
No branch removed — all 11 nodes are tight, well-attested, and each connects for a real (not
decorative) reason.

---

## 3. Animal Intelligence

**Primary entry topic:** Animal Intelligence

### Nodes (11)
Animal Intelligence · Ravens · Crows · Tool Use · Octopuses · Convergent Intelligence ·
Dolphins · Communication (animal) · Elephants · Self-Recognition (mirror test) · Problem Solving

### Connections

| From | To | Relationship | Why this connects |
|---|---|---|---|
| Animal Intelligence | Ravens | instance | Ravens are one of the most-studied examples of non-primate intelligence, capable of planning and tool use. |
| Ravens | Crows | behavioral kinship | Ravens and crows are both corvids, sharing much of the same problem-solving and tool-use research base. |
| Crows | Tool Use | evidence | New Caledonian crows manufacture and use tools in the wild — one of the strongest evidence bases for non-primate tool use. |
| Tool Use | Octopuses | convergent evidence | Octopuses independently use tools (e.g. carrying coconut-shell shelters) despite a lineage that diverged from vertebrates over 500 million years ago. |
| Octopuses | Convergent Intelligence | theoretical framework | Octopus cognition is the leading real-world example of convergent intelligence — complex cognition evolving independently along an entirely separate branch. |
| Convergent Intelligence | Dolphins | instance | Dolphin cognition is another independently-evolved case, arising in a completely different lineage and environment. |
| Dolphins | Communication | evidence | Dolphins use signature whistles that function similarly to names — one of the strongest cases for referential communication in a non-human species. |
| Communication | Elephants | instance | Elephants use distinct rumbles and body language in ways researchers interpret as complex social communication, including apparent condolence behavior. |
| Elephants | Self-Recognition | evidence | Elephants are one of the few species — with great apes, dolphins, and magpies — to pass the mirror self-recognition test. |
| Self-Recognition | Problem Solving | theoretical link | Self-recognition is often treated as a marker of the same higher-order cognition that underlies flexible problem-solving. |
| Problem Solving | Ravens | closes loop | Ravens solving multi-step puzzles for a reward is one of the clearest lab demonstrations of animal problem-solving. |

### Sample paths
1. Animal Intelligence → Ravens → Crows → Tool Use
2. Tool Use → Octopuses → Convergent Intelligence → Dolphins
3. Dolphins → Communication → Elephants → Self-Recognition
4. Self-Recognition → Problem Solving → Ravens
5. Animal Intelligence → Octopuses → Convergent Intelligence

### Existing content
None. This is the audit's clearest example of "adjacent-looking but not actually a fit": the
catalog has real wildlife footage (Blue Whales acoustics/eDNA, Pacific Walrus, Grizzly Bear,
Desert Tortoise, Polar Bears, Red Fox), but it's conservation/behavior footage, not
cognition-focused. **Blue Whales: Acoustics and eDNA Innovations** is the one borderline case —
worth a re-watch to see if it discusses whale vocal communication research specifically; if not,
it stays in the science/conservation pillar rather than being forced in here.

### Gaps
The entire network — by design, this is the most externally-sourced of the six. High-quality
broadcaster nature-documentary clips (tool use, mirror tests, corvid puzzle-solving) are the
natural fit and are realistically **External** tier almost throughout (rights-restricted
broadcaster material, not something to re-host).

### Indexed vs. External
- **Indexed where it matters:** a cognition researcher explaining a specific finding — moment
  search ("why does mirror self-recognition matter") is genuinely useful there.
- **External is sufficient for:** nearly all of the behavior-footage itself. The visual
  demonstration is the payload; a transcript adds little.

### Notes
No branch removed — every node is a real, well-documented research area, not a stretch.

---

## 4. Survival / Disaster

**Primary entry topic:** Disaster Survival

### Nodes (11)
Disaster Survival · Decision-Making Under Stress · Survival Psychology · Cave Rescue ·
Search and Rescue · Mountaineering · Hypoxia · Aviation Incidents · Shipwrecks ·
Human Endurance · Extreme Weather

*(Search and Rescue is the one node added beyond the brief's suggested list — it's the actual
discipline connecting Cave Rescue and Mountaineering, not a tag added for density.)*

### Connections

| From | To | Relationship | Why this connects |
|---|---|---|---|
| Disaster Survival | Decision-Making Under Stress | mechanism | Survival outcomes are frequently determined less by physical strength than by decision quality in the first critical minutes. |
| Decision-Making Under Stress | Survival Psychology | discipline | Survival psychology is the formal study of exactly this: why some people freeze and others act under acute threat. |
| Decision-Making Under Stress | Cave Rescue | case type | Cave rescues are an extensively studied case of extended, high-stakes decision-making, both for the trapped and the rescuers. |
| Cave Rescue | Search and Rescue | discipline | Cave rescue is a specialized branch of the broader search-and-rescue discipline, with its own technical constraints. |
| Search and Rescue | Mountaineering | context | Mountain search-and-rescue operations are among the most physically dangerous rescue work that exists. |
| Mountaineering | Hypoxia | mechanism | Altitude-induced hypoxia directly impairs the judgment mountaineering decisions depend on, compounding physical risk with cognitive risk. |
| Hypoxia | Aviation Incidents | shared mechanism | Hypoxia is also a documented cause of pilot incapacitation — different trigger, same underlying physiology as altitude sickness. |
| Aviation Incidents | Decision-Making Under Stress | mechanism | Cockpit decision-making under time pressure is one of the most rigorously studied stress-decision domains, precisely because the data (black boxes) exists. |
| Shipwrecks | Human Endurance | case type | Open-water shipwreck survival is one of the most extreme test cases for human physical endurance on record. |
| Human Endurance | Extreme Weather | context | Extreme-weather survival — cold exposure, heat, storms — is the other major domain endurance research concentrates on. |
| Extreme Weather | Disaster Survival | closes loop | Extreme-weather events are one of the most common triggers of disaster-survival scenarios generally. |

### Sample paths
1. Disaster Survival → Decision-Making Under Stress → Survival Psychology
2. Cave Rescue → Search and Rescue → Mountaineering → Hypoxia
3. Hypoxia → Aviation Incidents → Decision-Making Under Stress
4. Shipwrecks → Human Endurance → Extreme Weather → Disaster Survival
5. Survival Psychology → Decision-Making Under Stress → Cave Rescue

### Existing content
- **NOAA Titanic Expedition 2004: Wreck Footage** — a genuinely strong, already-tagged
  (`shipwreck`) reposition into **Shipwrecks**. No stretch required.
- **Forest Fire...Naturally!** and **Kīlauea Summit Eruption** are tangential at best (ecology and
  geology footage, not survival/disaster-response-focused) — left in the science pillar rather
  than forced in here.

### Gaps
Cave rescue, mountaineering, hypoxia, aviation incidents, extreme-weather survival, and survival
psychology are all gaps. The 2018 Thai cave rescue is an obvious, extremely well-documented,
high-interest candidate for Cave Rescue.

### Indexed vs. External
- **Indexed matters most for:** Aviation Incidents (cockpit-voice-transcript-adjacent content —
  moment search on "the exact callout before the incident" is high value) and Survival Psychology
  researcher interviews.
- **External is sufficient for:** Cave Rescue and Mountaineering dramatic footage, Shipwreck
  footage — visual-first content.

### Notes
No branch removed.

---

## 5. Belief / Influence

**Primary entry topic:** Cults

**Curation guardrail:** analytical and documentary, not sensational — the interest is the
psychological mechanism, not the group being mocked or gawked at.

### Nodes (10)
Cults · Persuasion · Conformity · Charismatic Leadership · Group Identity · Propaganda ·
Moral Panic · Conspiracy Belief · Cognitive Dissonance · Social Influence

### Connections

| From | To | Relationship | Why this connects |
|---|---|---|---|
| Cults | Charismatic Leadership | mechanism | Cult formation is consistently associated with a single charismatic leader who becomes the group's central authority. |
| Charismatic Leadership | Persuasion | mechanism | Charismatic leaders rely on well-documented persuasion techniques, not merely personal charm. |
| Persuasion | Cognitive Dissonance | mechanism | Effective persuasion often works by creating dissonance and then offering the group's belief system as the resolution. |
| Cognitive Dissonance | Conformity | related mechanism | Dissonance is easier to resolve by conforming to the group's stated belief than by admitting a costly personal mistake — the classic finding behind doomsday-cult studies. |
| Conformity | Group Identity | mechanism | Conformity pressure intensifies as group identity strengthens — the more a belief becomes "who we are," the higher the social cost of disagreeing. |
| Group Identity | Cults | closes local loop | Strong, deliberately cultivated group identity is one of the primary retention mechanisms cults use to prevent members from leaving. |
| Propaganda | Persuasion | discipline overlap | Propaganda is persuasion technique applied at mass, institutional scale rather than interpersonal scale. |
| Propaganda | Moral Panic | mechanism | Propaganda campaigns have historically been a primary engine for manufacturing moral panics around a target group or behavior. |
| Moral Panic | Conspiracy Belief | related phenomenon | Moral panics and conspiracy beliefs share the same appeal: a simple, morally clear explanation for a complex, anxiety-inducing situation. |
| Conspiracy Belief | Cognitive Dissonance | mechanism | Disconfirming evidence tends to strengthen conspiracy belief rather than weaken it — a direct, well-studied consequence of dissonance reduction. |
| Social Influence | Conformity | umbrella | Conformity is one specific, well-studied category within the broader field of social-influence research. |
| Social Influence | Persuasion | umbrella | Persuasion is the other major category, distinguished from conformity by working through argument rather than group pressure. |

### Sample paths
1. Cults → Charismatic Leadership → Persuasion → Cognitive Dissonance
2. Cognitive Dissonance → Conformity → Group Identity → Cults
3. Propaganda → Moral Panic → Conspiracy Belief
4. Social Influence → Persuasion → Propaganda
5. Social Influence → Conformity → Cognitive Dissonance → Conspiracy Belief

### Existing content
- **Duck and Cover** (Cold War civil-defense film) — a strong reposition into **Propaganda** /
  **Moral Panic**: a textbook case study in state-produced messaging shaping public fear and
  behavior.
- **Science of Shopping** (`humanbehavior`, `psychology`, `retail`) — a solid reposition into
  **Persuasion** / **Social Influence**: environmental and retail influence on behavior is a
  direct sub-topic of persuasion research, and a better home for it than network 2.

### Gaps
Cults, charismatic leadership, conformity/group-identity case studies, and conspiracy-belief
content are all gaps.

### Indexed vs. External
- **Indexed matters most for:** cult-survivor or psychology-researcher interviews — "the exact
  moment she describes leaving" is a real moment-search win.
- **External is sufficient for:** archival propaganda-film footage itself, moral-panic
  retrospective news content.

### Notes
No branch removed.

---

## 6. Strange History / Cultural Oddities

**Primary entry topic:** Historical Oddities

### Nodes (11)
Historical Oddities · Hoaxes · Urban Legends · Folklore · Unusual Rituals · Cultural Artifacts ·
Lost Media · Forgotten Technology · Strange Inventions · Obsolete Professions ·
Unexplained Historical Events

### Connections

| From | To | Relationship | Why this connects |
|---|---|---|---|
| Historical Oddities | Hoaxes | instance | Hoaxes are among the most reliably documented category of historical oddity — debunking one usually leaves a clear paper trail. |
| Hoaxes | Urban Legends | related form | A hoax that outlives its debunking and keeps spreading by word of mouth effectively becomes an urban legend. |
| Urban Legends | Folklore | broader category | Urban legends are the modern, industrial-era branch of the much older folklore tradition. |
| Folklore | Unusual Rituals | expression | Many unusual rituals persist specifically because they're embedded in a community's folklore, not because of their original stated purpose. |
| Unusual Rituals | Cultural Artifacts | evidence | Rituals are often the reason a specific object became a cultural artifact worth preserving in the first place. |
| Cultural Artifacts | Lost Media | overlap | A lost film or recording is a cultural artifact whose physical record has nearly disappeared, rather than one that survived. |
| Lost Media | Forgotten Technology | mechanism | Media gets lost largely because the technology needed to play or preserve it became obsolete faster than anyone archived it. |
| Forgotten Technology | Strange Inventions | related category | Forgotten technology and "strange inventions" overlap heavily — most forgotten tech was, at the time, someone's genuinely strange idea. |
| Strange Inventions | Obsolete Professions | mechanism | New inventions are the single biggest reason entire professions — lamplighters, human alarm clocks, elevator operators — became obsolete. |
| Obsolete Professions | Historical Oddities | closes loop | An obsolete profession, once forgotten, tends to resurface as a piece of historical trivia — exactly the "oddity" this network starts from. |
| Unexplained Historical Events | Hoaxes | frequent overlap | A surprising number of "unexplained" historical events turn out, on closer investigation, to have been hoaxes or misreported ordinary events. |
| Unexplained Historical Events | Folklore | mechanism | An event that resists a clean explanation is exactly the kind of gap folklore tends to fill in over time. |

### Sample paths
1. Historical Oddities → Hoaxes → Urban Legends → Folklore
2. Folklore → Unusual Rituals → Cultural Artifacts → Lost Media
3. Lost Media → Forgotten Technology → Strange Inventions → Obsolete Professions
4. Unexplained Historical Events → Hoaxes → Urban Legends
5. Cultural Artifacts → Unusual Rituals → Folklore

### Existing content — the best-served network in the catalog
- **The Great Train Robbery** (1903, one of the earliest narrative films) — strong fit for
  **Lost Media** / **Cultural Artifacts**.
- **17 Days: The Story of Newspaper History in the Making** — solid fit for **Forgotten
  Technology** / **Cultural Artifacts** (print-journalism history).
- **St. Louis Blues** (1929 short) — **Cultural Artifacts** (early sound film).
- **Trance and Dance in Bali** (anthropological ritual footage; currently `status: processing`) —
  an excellent fit for **Unusual Rituals** once processing finishes.
- **All My Babies: A Midwife's Own Story** (currently `status: processing`) — good fit for
  **Obsolete Professions** (traditional midwifery) or **Cultural Artifacts**.
- **A Trip Down Market Street** — also usable here as a **Cultural Artifacts** example, in
  addition to its primary home in network 1; topics aren't mutually exclusive.

### Gaps
Hoaxes, Urban Legends, Forgotten Technology (as tech-object stories rather than film history),
Strange Inventions, and Unexplained Historical Events specifically still need new material — but
this network needs the fewest new items of the six to launch credibly.

### Indexed vs. External
- **Already Indexed today, already useful:** 17 Days and St. Louis Blues both have
  `transcript_status: ready` — transcript-moment search over them works right now, no new work
  needed.
- **External / no-transcript-needed:** the silent-film artifacts (A Trip Down Market Street, The
  Great Train Robbery) — no dialogue, `no_speech` is the correct and expected transcript state,
  and the visual/historical context is the payload, not a searchable quote.

### Notes
No branch removed — this is the tightest, best-attested network of the six, and the one where
"where existing content fits" is a real answer rather than an aspiration.

---

## Cross-network observations

- Only network 6 (Strange History) has meaningful existing-catalog support today. Networks 2, 3,
  and 5 (Crime/Memory/Justice, Animal Intelligence, Belief/Influence) are essentially greenfield —
  that's expected and fine; they're exactly the areas the old "find anything legally downloadable"
  strategy never had a reason to touch.
- A handful of items were deliberately **not** forced into a network despite superficial tag
  overlap: general wildlife/conservation footage (bears, walrus, tortoises, foxes) into Animal
  Intelligence, and general NPS/earth-science footage into Survival/Disaster. Both calls are
  explained in [`RABBITHOLE_CONTENT_AUDIT.md`](./RABBITHOLE_CONTENT_AUDIT.md).
- Two items currently `status: processing` (Trance and Dance in Bali, All My Babies) should be
  watched — they're good fits for network 6 once ready.
