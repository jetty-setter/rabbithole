# RabbitHole — Content Audit & Selection Rubric

Companion to [`RABBITHOLE_PRODUCT_MODEL.md`](./RABBITHOLE_PRODUCT_MODEL.md) and
[`RABBITHOLE_CONTENT_NETWORKS.md`](./RABBITHOLE_CONTENT_NETWORKS.md). This document does two
things: scores how prospective content should be judged going forward, and classifies every item
currently in the catalog against that bar. **No deletions, visibility changes, or re-tagging
happen in this pass — recommendations only.**

The inventory below is a live pull from the `rabbithole-dev-videos` DynamoDB table (39 items, all
`owner: "curator"`, all self-hosted/transcoded), not a guess from the seed scripts.

---

## 1. Why this audit exists

The prior content strategy was, verbatim, "find as many legally downloadable videos as possible."
That produced a catalog that is *legally clean and technically uniform* — every item transcoded,
most items transcribed, all from unimpeachable public-domain sources (NASA, NOAA, USGS, NPS,
Library of Congress-era film) — and, as a discovery experience, largely unremarkable. Government
B-roll and institutional-overview documentaries are not what makes someone want to keep
clicking. Going forward, content earns a place in the catalog by scoring well on the rubric
below, not by clearing a rights bar cheaply.

## 2. Content selection rubric

Score prospective content on the first six dimensions (0–5 each, 30 max), then gate on rights.

| Dimension | 0–5, what it measures |
|---|---|
| Curiosity / hook | Does the first 10 seconds make someone want to know more? |
| Connection potential | Does it plausibly link to 2+ concepts in an existing or planned network? |
| Narrative / human interest | Is there a person, a decision, a stake — not just a process? |
| Visual interest | Does it look like something, or is it a talking head over slides? |
| Topic uniqueness | Is this the fifth video about this exact thing, or genuinely distinct? |
| Transcript value | Would exact-moment search over this transcript actually be useful? |
| **Rights / embed confidence** | **PASS / REVIEW / FAIL** — gates admission regardless of score |

A strong total score should be required for admission — rights being easy to clear is necessary,
not sufficient. A PASS-rights item that scores 8/30 is a worse catalog addition than a
REVIEW-rights item that scores 24/30 and is worth the extra care to clear properly. This directly
reverses the old rule ("rights are easy, so include it").

Recommended admission bar: **≥ 18/30**, PASS or resolved REVIEW on rights. Nothing in this pass
changes admission for existing content — the bar applies to what gets ingested *next*, not
retroactively.

---

## 3. Current inventory — classification summary

| Classification | Count |
|---|---|
| KEEP | 13 |
| KEEP BUT REPOSITION | 12 |
| LOW PRIORITY | 13 |
| REMOVE FROM DISCOVERY | 1 |
| REMOVE | 0 |
| **Total** | **39** |

No hard **REMOVE** recommendations — everything in the catalog is legitimate, rights-clean
content; the weakest items simply don't deserve a discovery-page slot, which is a promotion
decision, not a deletion decision.

## 4. Full classification

### KEEP (13) — solid standalone content, no repositioning needed

| Title | Tags | Why it holds up |
|---|---|---|
| Apollo 11 Moonwalk Montage | space, apollo11, nasa, moon | Iconic footage, strong hook. Also a natural cross-link into network 5 (Moon Landing → Conspiracy Belief) without needing to move it. |
| Computer Networks: The Heralds of Resource Sharing | technology, computing, internet, arpanet | Genuine historical-origin hook (the internet's ancestor). |
| Computer and Manned Space Flight | technology, computing, space, nasa | Same vein — real historical-technology narrative. |
| Take a Black Hole 'Plunge' | space, blackhole, nasa, astrophysics | Strong visualization, popular-science appeal. |
| Perseverance Rover's Descent and Touchdown on Mars | space, mars, nasa, exploration | Built-in "seven minutes of terror" drama. |
| Kīlauea Summit Eruption, January 16, 2025 | volcano, kilauea, geology, usgs | Visually striking, no network needed to justify it. |
| Harriet Tubman: Soldier of Freedom | history, harriettubman, undergroundrailroad, civilrights | Real human-story narrative; strong standalone. |
| Minidoka: An American Concentration Camp | history, wwii, japaneseamerican, civilrights | Serious, important, well-told — keep as-is. |
| Ellis Island Expedition, Part 3: Medical Inspection | history, ellisisland, immigration | Solid historical narrative. |
| Ellis Island Expedition, Part 5: Stairs of Separation | history, ellisisland, immigration | Evocative title, genuine hook. |
| Polar Bears Film Their Own Sea Ice World | wildlife, polarbear, arctic, seaice | The bear's-eye-camera gimmick is a real differentiator. |
| Grizzly Bear with Cubs Charges Wolf | wildlife, grizzlybear, yellowstone, predator | Short, dramatic, high hook — a good example of what a punchy clip should look like. |
| Mind Reading Computer System May Help People with Locked-in Syndrome | brain, neuroscience, technology, disability | Compelling premise and human stakes on its own; doesn't need a network. |

### KEEP BUT REPOSITION (12) — good content, wrong frame today

| Title | Current tags | Reposition into | Why |
|---|---|---|---|
| Duck and Cover | history, coldwar, civildefense | Network 5 — Propaganda / Moral Panic | Textbook case study in state-produced fear messaging. |
| A Trip Down Market Street | history, sanfrancisco, silentfilm | Network 1 — Found Footage / Nostalgia; also Network 6 — Cultural Artifacts | Street-level 1906 SF footage shot days before the earthquake — an exceptional hook the current tags don't surface. |
| 17 Days: The Story of Newspaper History in the Making | history, journalism, newspapers | Network 6 — Forgotten Technology / Cultural Artifacts | Print-journalism history with a real narrative arc. |
| NOAA Titanic Expedition 2004: Wreck Footage | ocean, titanic, shipwreck, noaa | Network 4 — Shipwrecks | Already tagged `shipwreck`; the network fit is immediate. |
| Indigenous Archeology at Acadia National Park | archaeology, history, indigenous, nps | Network 6 — Cultural Artifacts | Reasonable fit, moderate hook. |
| Mind Mappers | brain, neuroscience, humanbehavior | Network 2 — Memory / Forensic Psychology (**verify before placing** — re-watch to confirm it's about memory/cognition specifically, not general brain-mapping) | Plausible fit on title/tags alone; content unconfirmed in this pass. |
| Science of Shopping | humanbehavior, psychology, retail | Network 5 — Persuasion / Social Influence | Environmental/retail influence on behavior is a direct sub-topic of persuasion research — a better home than a generic "psychology" bucket. |
| Using Acoustics and eDNA Innovations to Study Blue Whales | wildlife, whales, noaa, marinebiology | Network 3 — Animal Intelligence, Communication node (**verify before placing** — confirm it actually discusses whale vocal communication research, not just acoustic monitoring methodology) | Borderline; don't force it if the content is really about survey methodology. |
| Trance and Dance in Bali | culture, anthropology, ritual, dance | Network 6 — Unusual Rituals | Direct fit; currently `status: processing`, revisit once ready. |
| All My Babies: A Midwife's Own Story | culture, history, midwifery, biography | Network 6 — Obsolete Professions | Direct fit; currently `status: processing`, revisit once ready. |
| The Great Train Robbery | culture, filmhistory, silentfilm | Network 6 — Lost Media / Cultural Artifacts | One of the earliest narrative films — strong film-history hook. |
| St. Louis Blues | culture, music, filmhistory | Network 6 — Cultural Artifacts | Historically significant early sound film; strong hook once framed that way. |

### LOW PRIORITY (13) — technically fine, don't invest further

| Title | Tags | Why it's low priority |
|---|---|---|
| The Nature of Sound | science, physics, sound | Overly academic; classroom-explainer tone, no hook. |
| Forest Fire...Naturally! | science, nature, ecology | Mundane; generic nature-documentary footage. |
| Insects on Flowers | science, biology, insects, nature | Mundane; essentially stock nature footage, `no_speech`. |
| NASA Captures Hurricane Harvey's Rainfall | science, weather, nasa, hurricane | Weak standalone hook (satellite visualization, no narration) — usable only as a *supporting* illustrative clip under network 4's Extreme Weather, never a headline item. |
| The Ocean: Earth's CO2 Sponge | ocean, climate, noaa, oceanography | Overly academic climate-explainer, no narrative hook. |
| Ocean to Atmosphere: Research and Innovation at NOAA PMEL | engineering, technology, noaa, oceanography | Institutional research-overview tone; weak hook. |
| The Significance of Channel Islands Archaeology | archaeology, history, channelislands, anthropology | Redundant with Indigenous Archeology at Acadia — keep one archaeology-overview piece prominent, not both. |
| Yellowstone in Depth: Bison | wildlife, bison, yellowstone, conservation | Mundane; scenic wildlife footage without a differentiating angle. |
| Tracking Pacific Walrus: Expedition to the Shrinking Chukchi Sea Ice | wildlife, walrus, arctic, usgs | Redundant with the catalog's other Arctic/climate wildlife pieces; moderate but not compelling hook. |
| Lake of the Sky: USGS Tahoe Basin Science | earthscience, hydrology, laketahoe, usgs | Institutional science-overview; weak hook. |
| The Heat is On: Desert Tortoises and Survival | wildlife, deserttortoise, conservation, usgs | The title reads like a network-4 fit; the actual content (tortoise thermal ecology) is not — don't be misled by the word "survival" into forcing a connection that isn't there. |
| Meet a Red Fox | wildlife, redfox, acadia, adaptation | Generic wildlife-intro segment, low differentiation. |
| Surgical Robotics | engineering, medicine, robotics | Interesting subject, dry institutional-overview execution; weak narrative hook as produced. |

### REMOVE FROM DISCOVERY (1)

| Title | Tags | Why |
|---|---|---|
| How USGS Streamgages Work | engineering, hydrology, infrastructure | The clearest single example of the old strategy's failure mode in the whole catalog: rights-clean, competently produced, and almost entirely without curiosity value. Recommend pulling it out of default/featured rotation; no need to delete or unpublish it outright. |

### REMOVE (0)

No item warrants outright removal. Everything above the "remove from discovery" line is
legitimate public-domain content that simply doesn't deserve promotion — that's a curation
decision, not a deletion decision.

---

## 5. What this means for the six networks

| Network | Existing items available at launch | Verdict |
|---|---|---|
| 1 — Abandoned / Uncanny | 1 (A Trip Down Market Street) | Needs new content; the one fit is excellent. |
| 2 — Crime / Memory / Justice | 0 confirmed, 1 unverified (Mind Mappers) | Greenfield. |
| 3 — Animal Intelligence | 0 confirmed, 1 unverified (Blue Whales) | Greenfield by design — do not force wildlife/conservation footage in. |
| 4 — Survival / Disaster | 1 (NOAA Titanic Expedition), 1 supporting-only (Hurricane Harvey) | Needs new content; the Titanic fit is strong. |
| 5 — Belief / Influence | 2 (Duck and Cover, Science of Shopping) | Best-seeded of the four greenfield-leaning networks. |
| 6 — Strange History / Cultural Oddities | 6–7 (17 Days, Great Train Robbery, St. Louis Blues, Indigenous Archeology, Trance and Dance in Bali*, All My Babies*, A Trip Down Market Street) | Can launch credibly today; *pending processing. |

Only network 6 could go live with a defensible content base immediately. That's expected and
consistent with the old strategy's actual output (historical/cultural documentaries were always
closer to what public-domain government and archival sources produce) — it is not a reason to
favor network 6 over the other five going forward, just an honest starting point.
