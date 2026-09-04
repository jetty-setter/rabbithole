#!/usr/bin/env python3
"""Seed the curated Topic and Connection tables for RabbitHole's six initial
curiosity networks.

Source of truth: docs/RABBITHOLE_CONTENT_NETWORKS.md. Every topic/connection
below is transcribed from that document — nothing here is auto-generated or
invented at seed time. This is metadata only; it does not touch the videos
table except via the optional --associate-strange-history step (see below),
and it never downloads, uploads, or embeds any video content.

Idempotent: every write is a plain put_item keyed by the row's natural key
(topic slug; (from_topic, to_topic) for a connection), so re-running this
script overwrites the same rows rather than duplicating them.

Usage:
    AWS_PROFILE=rabbithole api/.venv/bin/python scripts/seed-topics-and-connections.py --dry-run
    AWS_PROFILE=rabbithole api/.venv/bin/python scripts/seed-topics-and-connections.py
    AWS_PROFILE=rabbithole api/.venv/bin/python scripts/seed-topics-and-connections.py --network "Strange History / Cultural Oddities"
    AWS_PROFILE=rabbithole api/.venv/bin/python scripts/seed-topics-and-connections.py --associate-strange-history --dry-run
    AWS_PROFILE=rabbithole api/.venv/bin/python scripts/seed-topics-and-connections.py --associate-strange-history

--associate-strange-history is a SEPARATE, opt-in step (off by default) that
edits five existing, real, `status: ready` video records -- see the docstring
on associate_strange_history() below for exactly what it does and why.
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime, timezone
from decimal import Decimal

import boto3

AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")
TOPICS_TABLE = os.environ.get("TOPICS_TABLE", "rabbithole-dev-topics")
TOPIC_CONNECTIONS_TABLE = os.environ.get(
    "TOPIC_CONNECTIONS_TABLE", "rabbithole-dev-topic-connections"
)
VIDEOS_TABLE = os.environ.get("VIDEOS_TABLE", "rabbithole-dev-videos")

NOW = datetime.now(timezone.utc).isoformat()

# ── Six curiosity networks — topics ─────────────────────────────────────
# (network_name, [(slug, name, short_description), ...])
NETWORKS: list[tuple[str, list[tuple[str, str, str]]]] = [
    (
        "Abandoned / Uncanny",
        [
            ("abandoned-places", "Abandoned Places", "Structures and sites left behind, in every stage of decline."),
            ("abandoned-malls", "Abandoned Malls", "Shuttered retail spaces — one of the most visually iconic, recent forms of abandonment."),
            ("urban-exploration", "Urban Exploration", "The practice of seeking out and documenting abandoned or off-limits places."),
            ("liminal-spaces", "Liminal Spaces", "Empty, transitional places — hallways, parking garages — that read as unsettling rather than neutral."),
            ("the-backrooms", "The Backrooms", "A creepypasta mythology of endless, empty liminal rooms."),
            ("nostalgia", "Nostalgia", "A longing for a half-remembered, specific-yet-generic past."),
            ("uncanny-valley", "Uncanny Valley / Environments", "The unease of something that should feel familiar but is subtly, unplaceably wrong."),
            ("architectural-decay", "Architectural Decay", "The physical process by which a used building becomes an abandoned one."),
            ("ghost-towns", "Ghost Towns", "Whole settlements abandoned, usually to gradual economic decline."),
            ("chernobyl-exclusion-zones", "Chernobyl / Exclusion Zones", "A region abandoned suddenly, for a specific catastrophic reason."),
            ("childhood-environments", "Childhood Environments", "Schools, playgrounds, and homes — the specific places nostalgia most attaches to."),
            ("found-footage-time-capsules", "Found Footage / Time Capsules", "Home movies and street-level film that are often the only surviving record of a place."),
        ],
    ),
    (
        "Crime / Memory / Justice",
        [
            ("false-confessions", "False Confessions", "Confessions to crimes the confessor did not commit."),
            ("interrogation-tactics", "Interrogation Tactics", "Techniques used to extract statements from a suspect, some documented to raise false-confession risk."),
            ("coercion", "Coercion", "The pressure spectrum between persuasive and coercive questioning."),
            ("memory", "Memory", "The reconstructive process by which people recall — and sometimes misremember — events."),
            ("eyewitness-reliability", "Eyewitness Reliability", "How accurate (and how fragile) eyewitness testimony actually is."),
            ("wrongful-convictions", "Wrongful Convictions", "Convictions later shown to be mistaken, often via new evidence."),
            ("dna-exoneration", "DNA Exoneration", "DNA testing used to retroactively prove a wrongful conviction."),
            ("forensic-psychology", "Forensic Psychology", "The study of how interrogation and related processes affect memory and statement reliability."),
            ("criminal-profiling", "Criminal Profiling", "Psychological pattern analysis applied to unknown offenders."),
            ("missing-persons", "Missing Persons", "Investigations into people who have disappeared."),
            ("cold-cases", "Cold Cases", "Unsolved cases that have gone dormant for years."),
        ],
    ),
    (
        "Animal Intelligence",
        [
            ("animal-intelligence", "Animal Intelligence", "Non-human cognition — planning, tool use, communication, and problem-solving."),
            ("ravens", "Ravens", "Corvids studied for planning and tool use, among the most capable non-primate minds."),
            ("crows", "Crows", "Corvids known for manufacturing and using tools in the wild."),
            ("tool-use", "Tool Use", "The manufacture or repurposing of objects to accomplish a task."),
            ("octopuses", "Octopuses", "Cephalopods that independently evolved complex, tool-using cognition."),
            ("convergent-intelligence", "Convergent Intelligence", "Complex cognition evolving independently along separate evolutionary branches."),
            ("dolphins", "Dolphins", "Cetaceans with signature whistles that function similarly to names."),
            ("communication-animal", "Communication", "Referential and social communication in non-human species."),
            ("elephants", "Elephants", "Highly social animals with complex vocal and behavioral communication."),
            ("self-recognition", "Self-Recognition", "The mirror test — one marker of higher-order cognition."),
            ("problem-solving", "Problem Solving", "Flexible, multi-step reasoning to reach a goal."),
        ],
    ),
    (
        "Survival / Disaster",
        [
            ("disaster-survival", "Disaster Survival", "How people survive acute, high-stakes events."),
            ("decision-making-under-stress", "Decision-Making Under Stress", "How judgment and choice quality change under acute threat."),
            ("survival-psychology", "Survival Psychology", "The formal study of why some people freeze and others act under threat."),
            ("cave-rescue", "Cave Rescue", "Extended, high-stakes rescue operations in confined, hard-to-reach spaces."),
            ("search-and-rescue", "Search and Rescue", "The broader discipline of locating and recovering people in danger."),
            ("mountaineering", "Mountaineering", "High-altitude climbing, where risk compounds with altitude."),
            ("hypoxia", "Hypoxia", "Oxygen deprivation, and its effect on judgment and consciousness."),
            ("aviation-incidents", "Aviation Incidents", "In-flight emergencies and the decision-making that follows them."),
            ("shipwrecks", "Shipwrecks", "Vessel disasters and open-water survival."),
            ("human-endurance", "Human Endurance", "The physical limits of survival under extreme, prolonged conditions."),
            ("extreme-weather", "Extreme Weather", "Cold, heat, and storm events as survival triggers."),
        ],
    ),
    (
        "Belief / Influence",
        [
            ("cults", "Cults", "Groups organized around a central, often charismatic, authority."),
            ("persuasion", "Persuasion", "Techniques used to change belief or behavior through argument or influence."),
            ("conformity", "Conformity", "Aligning belief or behavior with a group under social pressure."),
            ("charismatic-leadership", "Charismatic Leadership", "Leadership that relies on personal magnetism and persuasive technique."),
            ("group-identity", "Group Identity", "The sense of belonging that raises the social cost of dissent."),
            ("propaganda", "Propaganda", "Persuasion technique applied at mass, institutional scale."),
            ("moral-panic", "Moral Panic", "Widespread, often disproportionate alarm about a perceived threat."),
            ("conspiracy-belief", "Conspiracy Belief", "Belief in hidden, coordinated explanations for events."),
            ("cognitive-dissonance", "Cognitive Dissonance", "The discomfort of holding contradictory beliefs, and how people resolve it."),
            ("social-influence", "Social Influence", "The broader field covering both conformity and persuasion."),
        ],
    ),
    (
        "Strange History / Cultural Oddities",
        [
            ("historical-oddities", "Historical Oddities", "Strange, little-known corners of documented history."),
            ("hoaxes", "Hoaxes", "Deliberate deceptions, often with a clear paper trail once debunked."),
            ("urban-legends", "Urban Legends", "Hoaxes and stories that outlive debunking and keep spreading by word of mouth."),
            ("folklore", "Folklore", "The older tradition urban legends descend from."),
            ("unusual-rituals", "Unusual Rituals", "Practices that persist within a community's folklore."),
            ("cultural-artifacts", "Cultural Artifacts", "Objects or records preserved as evidence of a ritual, era, or event."),
            ("lost-media", "Lost Media", "Cultural artifacts whose physical record has nearly disappeared."),
            ("forgotten-technology", "Forgotten Technology", "Technology that became obsolete faster than anyone archived it."),
            ("strange-inventions", "Strange Inventions", "Genuinely odd ideas at the time they were built."),
            ("obsolete-professions", "Obsolete Professions", "Jobs made obsolete by new inventions."),
            ("unexplained-historical-events", "Unexplained Historical Events", "Events that resist a clean explanation."),
        ],
    ),
]

# ── Connections: (network_name, from_slug, to_slug, relationship_type, explanation) ──
CONNECTIONS: list[tuple[str, str, str, str, str]] = [
    # 1. Abandoned / Uncanny
    ("Abandoned / Uncanny", "abandoned-places", "abandoned-malls", "specific instance",
     "Malls are one of the most visually iconic and widely documented forms of abandonment — a very recent kind of decline."),
    ("Abandoned / Uncanny", "abandoned-places", "urban-exploration", "practice / subculture",
     "Urban exploration is the human activity built entirely around seeking out and documenting abandoned places."),
    ("Abandoned / Uncanny", "urban-exploration", "liminal-spaces", "aesthetic overlap",
     "Explorers' photos of empty transitional spaces are the primary source material that popularized the liminal-space aesthetic."),
    ("Abandoned / Uncanny", "liminal-spaces", "the-backrooms", "origin / derivative",
     "The Backrooms creepypasta formalized the liminal-space aesthetic into an explicit fictional mythology of endless empty rooms."),
    ("Abandoned / Uncanny", "liminal-spaces", "uncanny-valley", "psychological mechanism",
     "Liminal spaces unsettle people for the same reason near-human faces do: something that should be familiar is subtly, unplaceably wrong."),
    ("Abandoned / Uncanny", "nostalgia", "liminal-spaces", "emotional driver",
     "Liminal-space imagery draws its power from evoking a half-remembered, specific-yet-generic past rather than any one real memory."),
    ("Abandoned / Uncanny", "nostalgia", "childhood-environments", "subject",
     "Childhood environments — schools, playgrounds, family homes — are the specific kind of place nostalgia most often attaches to."),
    ("Abandoned / Uncanny", "childhood-environments", "found-footage-time-capsules", "evidentiary form",
     "Home movies and street-level film are often the only surviving record of what a childhood environment actually looked like."),
    ("Abandoned / Uncanny", "abandoned-places", "architectural-decay", "physical process",
     "Decay is the physical process that turns an ordinary, once-used building into \"abandoned\" in the first place."),
    ("Abandoned / Uncanny", "architectural-decay", "ghost-towns", "scale-up",
     "A ghost town is architectural decay applied to an entire settlement instead of a single building."),
    ("Abandoned / Uncanny", "ghost-towns", "chernobyl-exclusion-zones", "extreme case",
     "Chernobyl is the starkest modern ghost-town case: a whole region abandoned suddenly, for a reason, rather than gradual economic decline."),
    ("Abandoned / Uncanny", "chernobyl-exclusion-zones", "urban-exploration", "closes the loop",
     "The exclusion zone has become one of urban exploration's most famous — and most regulated — destinations."),
    # 2. Crime / Memory / Justice
    ("Crime / Memory / Justice", "false-confessions", "interrogation-tactics", "mechanism",
     "Certain interrogation techniques are specifically documented to raise the risk of eliciting a false confession."),
    ("Crime / Memory / Justice", "interrogation-tactics", "coercion", "spectrum",
     "The line between persuasive and coercive interrogation is exactly where most false-confession cases sit."),
    ("Crime / Memory / Justice", "false-confessions", "memory", "causal mechanism",
     "Suggestive questioning can cause a person to genuinely misremember events, not merely misreport them."),
    ("Crime / Memory / Justice", "memory", "eyewitness-reliability", "shared mechanism",
     "Eyewitness testimony relies on the same reconstructive memory process that makes false confessions possible — memory is edited every time it's recalled."),
    ("Crime / Memory / Justice", "eyewitness-reliability", "wrongful-convictions", "leading cause",
     "Mistaken eyewitness identification is the single most common contributing factor in documented wrongful convictions."),
    ("Crime / Memory / Justice", "false-confessions", "wrongful-convictions", "leading cause",
     "False confessions are the second most common contributing factor in the same wrongful-conviction data."),
    ("Crime / Memory / Justice", "wrongful-convictions", "dna-exoneration", "resolution mechanism",
     "DNA testing is the primary tool that has retroactively proven a wrongful conviction in hundreds of cases."),
    ("Crime / Memory / Justice", "forensic-psychology", "interrogation-tactics", "discipline",
     "Forensic psychologists study — and increasingly help reform — how interrogation actually affects memory and statement reliability."),
    ("Crime / Memory / Justice", "forensic-psychology", "criminal-profiling", "application",
     "Criminal profiling applies the same psychological pattern-analysis discipline to unknown offenders."),
    ("Crime / Memory / Justice", "criminal-profiling", "cold-cases", "application",
     "Profiling is most often invoked publicly in relation to unsolved, long-dormant cases."),
    ("Crime / Memory / Justice", "missing-persons", "cold-cases", "overlap",
     "A missing-persons case that goes unsolved long enough becomes, by definition, a cold case."),
    ("Crime / Memory / Justice", "missing-persons", "eyewitness-reliability", "mechanism",
     "Missing-persons investigations lean heavily on witness accounts, with the same reliability problems as any other eyewitness testimony."),
    # 3. Animal Intelligence
    ("Animal Intelligence", "animal-intelligence", "ravens", "instance",
     "Ravens are one of the most-studied examples of non-primate intelligence, capable of planning and tool use."),
    ("Animal Intelligence", "ravens", "crows", "behavioral kinship",
     "Ravens and crows are both corvids, sharing much of the same problem-solving and tool-use research base."),
    ("Animal Intelligence", "crows", "tool-use", "evidence",
     "New Caledonian crows manufacture and use tools in the wild — one of the strongest evidence bases for non-primate tool use."),
    ("Animal Intelligence", "tool-use", "octopuses", "convergent evidence",
     "Octopuses independently use tools (e.g. carrying coconut-shell shelters) despite a lineage that diverged from vertebrates over 500 million years ago."),
    ("Animal Intelligence", "octopuses", "convergent-intelligence", "theoretical framework",
     "Octopus cognition is the leading real-world example of convergent intelligence — complex cognition evolving independently along an entirely separate branch."),
    ("Animal Intelligence", "convergent-intelligence", "dolphins", "instance",
     "Dolphin cognition is another independently-evolved case, arising in a completely different lineage and environment."),
    ("Animal Intelligence", "dolphins", "communication-animal", "evidence",
     "Dolphins use signature whistles that function similarly to names — one of the strongest cases for referential communication in a non-human species."),
    ("Animal Intelligence", "communication-animal", "elephants", "instance",
     "Elephants use distinct rumbles and body language in ways researchers interpret as complex social communication, including apparent condolence behavior."),
    ("Animal Intelligence", "elephants", "self-recognition", "evidence",
     "Elephants are one of the few species — with great apes, dolphins, and magpies — to pass the mirror self-recognition test."),
    ("Animal Intelligence", "self-recognition", "problem-solving", "theoretical link",
     "Self-recognition is often treated as a marker of the same higher-order cognition that underlies flexible problem-solving."),
    ("Animal Intelligence", "problem-solving", "ravens", "closes loop",
     "Ravens solving multi-step puzzles for a reward is one of the clearest lab demonstrations of animal problem-solving."),
    # 4. Survival / Disaster
    ("Survival / Disaster", "disaster-survival", "decision-making-under-stress", "mechanism",
     "Survival outcomes are frequently determined less by physical strength than by decision quality in the first critical minutes."),
    ("Survival / Disaster", "decision-making-under-stress", "survival-psychology", "discipline",
     "Survival psychology is the formal study of exactly this: why some people freeze and others act under acute threat."),
    ("Survival / Disaster", "decision-making-under-stress", "cave-rescue", "case type",
     "Cave rescues are an extensively studied case of extended, high-stakes decision-making, both for the trapped and the rescuers."),
    ("Survival / Disaster", "cave-rescue", "search-and-rescue", "discipline",
     "Cave rescue is a specialized branch of the broader search-and-rescue discipline, with its own technical constraints."),
    ("Survival / Disaster", "search-and-rescue", "mountaineering", "context",
     "Mountain search-and-rescue operations are among the most physically dangerous rescue work that exists."),
    ("Survival / Disaster", "mountaineering", "hypoxia", "mechanism",
     "Altitude-induced hypoxia directly impairs the judgment mountaineering decisions depend on, compounding physical risk with cognitive risk."),
    ("Survival / Disaster", "hypoxia", "aviation-incidents", "shared mechanism",
     "Hypoxia is also a documented cause of pilot incapacitation — different trigger, same underlying physiology as altitude sickness."),
    ("Survival / Disaster", "aviation-incidents", "decision-making-under-stress", "mechanism",
     "Cockpit decision-making under time pressure is one of the most rigorously studied stress-decision domains, precisely because the data (black boxes) exists."),
    ("Survival / Disaster", "shipwrecks", "human-endurance", "case type",
     "Open-water shipwreck survival is one of the most extreme test cases for human physical endurance on record."),
    ("Survival / Disaster", "human-endurance", "extreme-weather", "context",
     "Extreme-weather survival — cold exposure, heat, storms — is the other major domain endurance research concentrates on."),
    ("Survival / Disaster", "extreme-weather", "disaster-survival", "closes loop",
     "Extreme-weather events are one of the most common triggers of disaster-survival scenarios generally."),
    # 5. Belief / Influence
    ("Belief / Influence", "cults", "charismatic-leadership", "mechanism",
     "Cult formation is consistently associated with a single charismatic leader who becomes the group's central authority."),
    ("Belief / Influence", "charismatic-leadership", "persuasion", "mechanism",
     "Charismatic leaders rely on well-documented persuasion techniques, not merely personal charm."),
    ("Belief / Influence", "persuasion", "cognitive-dissonance", "mechanism",
     "Effective persuasion often works by creating dissonance and then offering the group's belief system as the resolution."),
    ("Belief / Influence", "cognitive-dissonance", "conformity", "related mechanism",
     "Dissonance is easier to resolve by conforming to the group's stated belief than by admitting a costly personal mistake — the classic finding behind doomsday-cult studies."),
    ("Belief / Influence", "conformity", "group-identity", "mechanism",
     "Conformity pressure intensifies as group identity strengthens — the more a belief becomes \"who we are,\" the higher the social cost of disagreeing."),
    ("Belief / Influence", "group-identity", "cults", "closes local loop",
     "Strong, deliberately cultivated group identity is one of the primary retention mechanisms cults use to prevent members from leaving."),
    ("Belief / Influence", "propaganda", "persuasion", "discipline overlap",
     "Propaganda is persuasion technique applied at mass, institutional scale rather than interpersonal scale."),
    ("Belief / Influence", "propaganda", "moral-panic", "mechanism",
     "Propaganda campaigns have historically been a primary engine for manufacturing moral panics around a target group or behavior."),
    ("Belief / Influence", "moral-panic", "conspiracy-belief", "related phenomenon",
     "Moral panics and conspiracy beliefs share the same appeal: a simple, morally clear explanation for a complex, anxiety-inducing situation."),
    ("Belief / Influence", "conspiracy-belief", "cognitive-dissonance", "mechanism",
     "Disconfirming evidence tends to strengthen conspiracy belief rather than weaken it — a direct, well-studied consequence of dissonance reduction."),
    ("Belief / Influence", "social-influence", "conformity", "umbrella",
     "Conformity is one specific, well-studied category within the broader field of social-influence research."),
    ("Belief / Influence", "social-influence", "persuasion", "umbrella",
     "Persuasion is the other major category, distinguished from conformity by working through argument rather than group pressure."),
    # 6. Strange History / Cultural Oddities
    ("Strange History / Cultural Oddities", "historical-oddities", "hoaxes", "instance",
     "Hoaxes are among the most reliably documented category of historical oddity — debunking one usually leaves a clear paper trail."),
    ("Strange History / Cultural Oddities", "hoaxes", "urban-legends", "related form",
     "A hoax that outlives its debunking and keeps spreading by word of mouth effectively becomes an urban legend."),
    ("Strange History / Cultural Oddities", "urban-legends", "folklore", "broader category",
     "Urban legends are the modern, industrial-era branch of the much older folklore tradition."),
    ("Strange History / Cultural Oddities", "folklore", "unusual-rituals", "expression",
     "Many unusual rituals persist specifically because they're embedded in a community's folklore, not because of their original stated purpose."),
    ("Strange History / Cultural Oddities", "unusual-rituals", "cultural-artifacts", "evidence",
     "Rituals are often the reason a specific object became a cultural artifact worth preserving in the first place."),
    ("Strange History / Cultural Oddities", "cultural-artifacts", "lost-media", "overlap",
     "A lost film or recording is a cultural artifact whose physical record has nearly disappeared, rather than one that survived."),
    ("Strange History / Cultural Oddities", "lost-media", "forgotten-technology", "mechanism",
     "Media gets lost largely because the technology needed to play or preserve it became obsolete faster than anyone archived it."),
    ("Strange History / Cultural Oddities", "forgotten-technology", "strange-inventions", "related category",
     "Forgotten technology and \"strange inventions\" overlap heavily — most forgotten tech was, at the time, someone's genuinely strange idea."),
    ("Strange History / Cultural Oddities", "strange-inventions", "obsolete-professions", "mechanism",
     "New inventions are the single biggest reason entire professions — lamplighters, human alarm clocks, elevator operators — became obsolete."),
    ("Strange History / Cultural Oddities", "obsolete-professions", "historical-oddities", "closes loop",
     "An obsolete profession, once forgotten, tends to resurface as a piece of historical trivia — exactly the \"oddity\" this network starts from."),
    ("Strange History / Cultural Oddities", "unexplained-historical-events", "hoaxes", "frequent overlap",
     "A surprising number of \"unexplained\" historical events turn out, on closer investigation, to have been hoaxes or misreported ordinary events."),
    ("Strange History / Cultural Oddities", "unexplained-historical-events", "folklore", "mechanism",
     "An event that resists a clean explanation is exactly the kind of gap folklore tends to fill in over time."),
]

# ── Strange History content associations (Phase 4) ──────────────────────
# video_id -> (topic slugs to add to `topics` + `tags`, per the audit's
# KEEP-BUT-REPOSITION mapping). Every one of these is `status: ready` today
# (checked live before writing this list) and matches
# docs/RABBITHOLE_CONTENT_AUDIT.md exactly -- no forced/invented placements.
# Two audit items (Trance and Dance in Bali, All My Babies) are NOT included:
# both are still `status: processing` as of this pass, and the brief is
# explicit -- "Only associate items that are actually ready/appropriate."
STRANGE_HISTORY_ASSOCIATIONS: dict[str, list[str]] = {
    # The Great Train Robbery -- tagged with BOTH so a real co-occurrence
    # edge exists between them (Map's graph is still 100% tag-driven; this
    # is what makes the curated Cultural Artifacts -> Lost Media connection
    # actually reachable through the existing, unmodified Map UI).
    "28ef4c2d39ad4cbf8ec06e4d784727e1": ["lost-media", "cultural-artifacts"],
    # 17 Days: The Story of Newspaper History in the Making
    "223297a91cf14550836ade96b46a7c08": ["forgotten-technology", "cultural-artifacts"],
    # St. Louis Blues
    "97d9091c75b54700b8fb7b81dd7a328c": ["cultural-artifacts"],
    # Indigenous Archeology at Acadia National Park
    "36844b040a2d47849764f2380c46f8cb": ["cultural-artifacts"],
    # A Trip Down Market Street -- primary home is network 1, but also a
    # legitimate Cultural Artifacts example per the network doc.
    "b3668a597db444f4ace56c4a05615fcc": ["cultural-artifacts"],
}


# ── Map Enrichment Batch 1 (Curated Map P1 follow-up) ───────────────────
# Approved after the Curated Map Enrichment planning audit. These seven
# connections are additive to the six networks above -- not a new network,
# not a rewrite of anything already seeded. Each activates a path that is
# either already walkable via real tag co-occurrence (1-3) or made walkable
# by exactly one additive tag on one existing video (4-7, applied by
# associate_map_enrichment_batch1() below). Copy is the shortened, editorial
# version approved for the product -- not the longer planning-stage draft.
MAP_ENRICHMENT_BATCH_1: list[tuple[str, str, str, str, str]] = [
    # 1. No tag changes needed -- real edge already exists (17 Days).
    ("Map Enrichment Batch 1", "cultural-artifacts", "forgotten-technology", "mechanism",
     "The things we preserve often outlive the technology used to create them."),
    # 2. No tag changes needed -- real edge already exists (The Great Train Robbery).
    ("Map Enrichment Batch 1", "lost-media", "silentfilm", "instance",
     "Much of the silent era disappeared before anyone realized how much needed saving."),
    # 3. No tag changes needed -- real edge already exists (Indigenous Archeology at Acadia).
    ("Map Enrichment Batch 1", "archaeology", "cultural-artifacts", "discipline",
     "Objects survive. Their meaning doesn't always survive with them."),
    # 4. Requires +found-footage-time-capsules tag on A Trip Down Market Street.
    ("Map Enrichment Batch 1", "cultural-artifacts", "found-footage-time-capsules", "overlap",
     "It wasn't filmed as history — the earthquake days later made it one."),
    # 5. Requires +conspiracy-belief tag on Apollo 11 Moonwalk Montage.
    ("Map Enrichment Batch 1", "apollo11", "conspiracy-belief", "instance",
     "Few events are better documented—or more persistently doubted—than the Moon landing."),
    # 6. Requires +propaganda tag on Duck and Cover.
    ("Map Enrichment Batch 1", "civildefense", "propaganda", "case study",
     "“Duck and Cover” didn't just teach safety. It shaped how Americans understood nuclear threat."),
    # 7. Requires +persuasion tag on Science of Shopping.
    ("Map Enrichment Batch 1", "humanbehavior", "persuasion", "application",
     "The psychology that moves you through a store is designed to influence what you do next."),
]

# video_id -> topic slug to ADD (to both `tags` and `topics`) -- the four
# approved additive tag changes from Batch 1. Additive only: every existing
# tag/topic/field on these videos is preserved untouched.
MAP_ENRICHMENT_BATCH_1_ASSOCIATIONS: dict[str, str] = {
    "b3668a597db444f4ace56c4a05615fcc": "found-footage-time-capsules",  # A Trip Down Market Street
    "b54aaf3d8ac74abc9a156066a2db920b": "conspiracy-belief",             # Apollo 11 Moonwalk Montage
    "1122a0baf2e046f2bdb31704c628efb5": "propaganda",                    # Duck and Cover
    "5df67ea522b949f792541a53d2506cd7": "persuasion",                    # Science of Shopping
}


def _table(name: str):
    return boto3.resource("dynamodb", region_name=AWS_REGION).Table(name)


def seed_topics(networks, dry_run: bool) -> int:
    n = 0
    for network_name, topics in networks:
        for slug, name, desc in topics:
            n += 1
            if dry_run:
                print(f"  [topic] {slug:34s} {name}")
                continue
            _table(TOPICS_TABLE).put_item(
                Item={
                    "slug": slug,
                    "topic_id": slug,
                    "name": name,
                    "short_description": desc,
                    "aliases": [],
                    "editorial_status": "published",
                    "network": network_name,
                    "created_at": NOW,
                }
            )
    return n


def seed_connections(connections, dry_run: bool) -> int:
    n = 0
    for network_name, from_topic, to_topic, rel_type, explanation in connections:
        n += 1
        if dry_run:
            print(f"  [connection] {from_topic} -> {to_topic}  ({rel_type})")
            continue
        _table(TOPIC_CONNECTIONS_TABLE).put_item(
            Item={
                "from_topic": from_topic,
                "to_topic": to_topic,
                "relationship_type": rel_type,
                "explanation": explanation,
                "strength": 1,
                "source": "editorial",
                "network": network_name,
                "created_at": NOW,
            }
        )
    return n


def associate_strange_history(dry_run: bool) -> int:
    """Editorially re-tag five EXISTING, ready videos into their Strange
    History topics. Two things happen per video, both additive:

      1. `topics` gains {topic_id, relevance, source} entries (P0-5) -- the
         curated layer.
      2. The SAME slugs are also added to the plain `tags` list, if not
         already present. Map and Tunnels are both still 100% tag-driven
         (this pass deliberately did not change that -- see
         docs/RABBITHOLE_IMPLEMENTATION_GAP.md, P1-1's scope), so without
         this a curated topic with zero matching tag would be invisible in
         the product today. Every slug added here is a genuinely accurate
         descriptor of the video (per the content audit), not a filler tag.

    Never removes an existing tag, never touches any other field, only
    touches the five video_ids in STRANGE_HISTORY_ASSOCIATIONS above."""
    videos = _table(VIDEOS_TABLE)
    n = 0
    for video_id, slugs in STRANGE_HISTORY_ASSOCIATIONS.items():
        item = videos.get_item(Key={"video_id": video_id}).get("Item")
        if not item:
            print(f"  SKIP {video_id}: not found")
            continue
        if item.get("status") != "ready":
            print(f"  SKIP {video_id} ({item.get('title')}): status={item.get('status')!r}, not ready")
            continue
        existing_tags = list(item.get("tags") or [])
        new_tags = existing_tags + [s for s in slugs if s not in existing_tags]
        new_topics = [{"topic_id": s, "relevance": Decimal("1"), "source": "editorial"} for s in slugs]
        n += 1
        if dry_run:
            print(f"  [associate] {item.get('title')!r} ({video_id})")
            print(f"      tags:   {existing_tags} -> {new_tags}")
            print(f"      topics: {new_topics}")
            continue
        videos.update_item(
            Key={"video_id": video_id},
            UpdateExpression="SET tags = :t, topics = :p",
            ExpressionAttributeValues={":t": new_tags, ":p": new_topics},
        )
        print(f"  updated {item.get('title')!r} ({video_id}): +{slugs}")
    return n


def seed_map_enrichment_batch1(dry_run: bool) -> int:
    n = 0
    for network_name, from_topic, to_topic, rel_type, explanation in MAP_ENRICHMENT_BATCH_1:
        n += 1
        if dry_run:
            print(f"  [connection] {from_topic} -> {to_topic}  ({rel_type})")
            continue
        _table(TOPIC_CONNECTIONS_TABLE).put_item(
            Item={
                "from_topic": from_topic,
                "to_topic": to_topic,
                "relationship_type": rel_type,
                "explanation": explanation,
                "strength": 1,
                "source": "editorial",
                "network": network_name,
                "created_at": NOW,
            }
        )
    return n


def associate_map_enrichment_batch1(dry_run: bool) -> int:
    """Add exactly one additive topic slug to each of the four Batch 1
    videos (mirrored into `tags`, matching the Strange History Phase 4
    pattern -- Map's graph is still 100% tag-driven). Never removes or
    replaces an existing tag/topic; skips anything not found, not ready,
    or already tagged."""
    videos = _table(VIDEOS_TABLE)
    n = 0
    for video_id, slug in MAP_ENRICHMENT_BATCH_1_ASSOCIATIONS.items():
        item = videos.get_item(Key={"video_id": video_id}).get("Item")
        if not item:
            print(f"  SKIP {video_id}: not found")
            continue
        if item.get("status") != "ready":
            print(f"  SKIP {video_id} ({item.get('title')}): status={item.get('status')!r}, not ready")
            continue
        existing_tags = list(item.get("tags") or [])
        if slug in existing_tags:
            print(f"  SKIP {item.get('title')!r}: already tagged {slug!r}")
            continue
        new_tags = existing_tags + [slug]
        existing_topics = list(item.get("topics") or [])
        new_topics = existing_topics + [{"topic_id": slug, "relevance": Decimal("1"), "source": "editorial"}]
        n += 1
        if dry_run:
            print(f"  [associate] {item.get('title')!r} ({video_id})")
            print(f"      tags:   {existing_tags} -> {new_tags}")
            print(f"      topics: {existing_topics} -> {new_topics}")
            continue
        videos.update_item(
            Key={"video_id": video_id},
            UpdateExpression="SET tags = :t, topics = :p",
            ExpressionAttributeValues={":t": new_tags, ":p": new_topics},
        )
        print(f"  updated {item.get('title')!r} ({video_id}): +{slug}")
    return n


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true", help="Print the plan without writing anything")
    ap.add_argument("--network", default=None, help="Only seed this one network (exact name)")
    ap.add_argument(
        "--associate-strange-history",
        action="store_true",
        help="Also re-tag the 5 ready Strange History videos into their curated topics (see docstring)",
    )
    ap.add_argument(
        "--enrichment-batch1",
        action="store_true",
        help="Seed ONLY the 7 approved Map Enrichment Batch 1 connections + their 4 additive video "
             "tag associations. Isolated from --network/the six-network reseed above.",
    )
    args = ap.parse_args()

    if args.enrichment_batch1:
        print(f"Target tables: {TOPIC_CONNECTIONS_TABLE}, {VIDEOS_TABLE}")
        print("Batch: Map Enrichment Batch 1 (7 connections, 4 video associations)")
        print(f"{'DRY RUN — nothing will be written' if args.dry_run else 'LIVE — writing to DynamoDB'}\n")

        print("== Connections ==")
        n_conn = seed_map_enrichment_batch1(args.dry_run)
        print(f"  {n_conn} connection(s)\n")

        print("== Video tag associations ==")
        n_assoc = associate_map_enrichment_batch1(args.dry_run)
        print(f"  {n_assoc} video(s) associated\n")

        print("Done." if not args.dry_run else "Dry run complete — re-run without --dry-run to write.")
        return

    networks = NETWORKS if not args.network else [n for n in NETWORKS if n[0] == args.network]
    if args.network and not networks:
        names = ", ".join(n[0] for n in NETWORKS)
        sys.exit(f"Unknown network {args.network!r}. Choices: {names}")
    connections = CONNECTIONS if not args.network else [c for c in CONNECTIONS if c[0] == args.network]

    print(f"Target tables: {TOPICS_TABLE}, {TOPIC_CONNECTIONS_TABLE}"
          + (f", {VIDEOS_TABLE}" if args.associate_strange_history else ""))
    print(f"Networks: {', '.join(n[0] for n in networks)}")
    print(f"{'DRY RUN — nothing will be written' if args.dry_run else 'LIVE — writing to DynamoDB'}\n")

    print("== Topics ==")
    n_topics = seed_topics(networks, args.dry_run)
    print(f"  {n_topics} topic(s)\n")

    print("== Connections ==")
    n_conn = seed_connections(connections, args.dry_run)
    print(f"  {n_conn} connection(s)\n")

    if args.associate_strange_history:
        print("== Strange History content associations ==")
        n_assoc = associate_strange_history(args.dry_run)
        print(f"  {n_assoc} video(s) associated\n")

    print("Done." if not args.dry_run else "Dry run complete — re-run without --dry-run to write.")


if __name__ == "__main__":
    main()
