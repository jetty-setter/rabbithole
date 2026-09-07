#!/usr/bin/env python3
"""Seed RabbitHole homepage content batch 1 — the 14 candidates that passed
source verification.

    AWS_PROFILE=rabbithole api/.venv/bin/python scripts/seed-content-batch1.py --dry-run
    AWS_PROFILE=rabbithole api/.venv/bin/python scripts/seed-content-batch1.py --seed
    AWS_PROFILE=rabbithole api/.venv/bin/python scripts/seed-content-batch1.py --remove

Every record carries batch="homepage-batch-1" for identification/removal.
External items are written in the exact shape POST /external produces
(providers.resolve_external + the create_external body). The one hosted
item (Tacoma Narrows, public domain) is pushed through the normal upload
pipeline: record first, then the source file into the uploads bucket, and
the Fargate worker transcodes + transcribes it like any upload.

This does NOT scrape captions, use yt-dlp, or import any transcript. The
only transcript that will exist after this run is the one RabbitHole's own
AWS Transcribe pipeline produces for the hosted Tacoma clip.
"""

from __future__ import annotations

import argparse
import os
import sys
import urllib.request
import uuid
from datetime import datetime, timezone

import boto3

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "api"))
from app import providers  # noqa: E402

REGION = os.environ.get("AWS_REGION", "us-east-1")
VIDEOS_TABLE = os.environ.get("VIDEOS_TABLE", "rabbithole-dev-videos")
UPLOADS_BUCKET = os.environ.get("UPLOADS_BUCKET", "rabbithole-dev-uploads-936922781601")
BATCH = "homepage-batch-1"
NOW = datetime.now(timezone.utc).isoformat()

# ── External · YouTube (12) ─────────────────────────────────────────────
# (youtube_url, title, description, source_name, tags)
YOUTUBE: list[tuple[str, str, str, str, list[str]]] = [
    (
        "https://www.youtube.com/watch?v=H4dGpz6cnHo",
        "The Backrooms (Found Footage)",
        "A young filmmaker 'no-clips' out of reality into an endless, humming "
        "expanse of empty office rooms. The 2022 short that turned a one-line "
        "internet horror premise into a whole visual language.",
        "Kane Pixels",
        ["the-backrooms", "liminal-spaces", "uncanny-valley", "internet-folklore", "found-footage"],
    ),
    (
        "https://www.youtube.com/watch?v=qCj2hRc_F6Y",
        "Dead Mall: Owings Mills Mall",
        "Filmmaker Dan Bell walks the fluorescent-lit remains of the Baltimore "
        "mall he grew up in, a year before it was demolished. The video that "
        "started his long project of documenting dead American malls.",
        "This Is Dan Bell",
        ["abandoned-malls", "abandoned-places", "nostalgia", "childhood-environments", "retail-history"],
    ),
    (
        "https://www.youtube.com/watch?v=4YuNvIfM-YA",
        "Kowloon Walled City: The Densest City on Earth",
        "A lawless 6.5-acre block of Hong Kong where 33,000 people built "
        "fourteen storeys of interlocking homes, factories and clinics with no "
        "architect and no government — then watched it demolished in 1994. A "
        "video essay by neo, via Aeon.",
        "neo",
        ["historical-oddities", "architectural-decay", "urban-density", "kowloon-walled-city", "hong-kong-history"],
    ),
    (
        "https://www.youtube.com/watch?v=-Hi5muM44NE",
        "Underwater Astonishments",
        "Ocean scientist David Gallo shows the clip where a rock unfolds into "
        "an octopus and swims away, a cuttlefish running light shows across its "
        "skin, and fish signalling in the dark. Camouflage, he argues, isn't a "
        "reflex — it's a decision, made hundreds of times an hour.",
        "TED-Ed · David Gallo",
        ["octopuses", "animal-intelligence", "convergent-intelligence", "camouflage", "cephalopods", "deep-sea"],
    ),
    (
        "https://www.youtube.com/watch?v=0vKCLJZbytU",
        "Octopus Dreaming",
        "A sleeping octopus named Heidi cycles through colours and textures — "
        "pale, then mottled, then the dark flush of a hunt. Marine biologist "
        "David Scheel narrates what may be the first footage of an octopus "
        "dreaming.",
        "Nature on PBS",
        ["octopuses", "animal-intelligence", "consciousness", "camouflage", "sleep-and-dreams"],
    ),
    (
        "https://www.youtube.com/watch?v=cbSu2PXOTOc",
        "Are Crows the Ultimate Problem Solvers?",
        "A wild crow called 007 is given an eight-step puzzle it has never "
        "seen — tools to retrieve tools to retrieve a stick to reach the food. "
        "It works the sequence out in under three minutes.",
        "BBC Earth",
        ["crows", "animal-intelligence", "problem-solving", "tool-use"],
    ),
    (
        "https://www.youtube.com/watch?v=PB2OegI6wvI",
        "How Reliable Is Your Memory?",
        "Psychologist Elizabeth Loftus has spent a career planting detailed "
        "memories of things that never happened. Her work reshaped how courts "
        "treat eyewitness testimony — and it starts with the man whose life it "
        "took to prove the point.",
        "TED · Elizabeth Loftus",
        ["memory", "eyewitness-reliability", "wrongful-convictions", "false-memory"],
    ),
    (
        "https://www.youtube.com/watch?v=RVRahOE3AgU",
        "The Confessions",
        "Four US Navy sailors were convicted of the same 1997 murder in "
        "Norfolk, Virginia — each after hours of interrogation, none linked by "
        "any evidence, their confessions contradicting each other and the "
        "crime scene. FRONTLINE follows the case to its unravelling.",
        "FRONTLINE PBS",
        ["false-confessions", "interrogation-tactics", "coercion", "wrongful-convictions", "dna-exoneration"],
    ),
    (
        "https://www.youtube.com/watch?v=2-6ndwvK3UI",
        "Murder Is Her Hobby: The Nutshell Studies",
        "In the 1940s the heiress Frances Glessner Lee hand-built "
        "dollhouse-scale crime scenes — bloodstains, tiny working locks, "
        "corpses knitted to size — to teach detectives how to observe. "
        "Homicide investigators still train on them today.",
        "Smithsonian American Art Museum",
        ["forensic-psychology", "historical-oddities", "cultural-artifacts", "crime-scene-investigation", "frances-glessner-lee"],
    ),
    (
        "https://www.youtube.com/watch?v=z70mT0h8ooA",
        "The Ditching of Flight 1549",
        "The NTSB's reconstruction of US Airways 1549, from the bird strike to "
        "the water — the flight path drawn against the real cockpit and "
        "air-traffic-control audio. Two hundred and eight seconds, in the "
        "crew's own voices.",
        "NTSB",
        ["aviation-incidents", "decision-making-under-stress", "disaster-survival", "bird-strike"],
    ),
    (
        "https://www.youtube.com/watch?v=Y8RigxxiilI",
        "The Dyatlov Pass Case",
        "In 1959, nine experienced hikers cut their way out of their tent into "
        "a Ural Mountains night and died in the snow, some with injuries no "
        "fall could explain. LEMMiNO works through the case files, autopsies "
        "and the hikers' own last photographs.",
        "LEMMiNO",
        ["unexplained-historical-events", "disaster-survival", "survival-psychology", "mountaineering", "hypothermia"],
    ),
    (
        "https://www.youtube.com/watch?v=_QdPW8JrYzQ",
        "This Is What Happens When You Reply to Spam Email",
        "Comedian James Veitch answers the scam email everyone deletes and "
        "keeps the correspondence going for weeks. A very funny look at how a "
        "con actually works when the mark refuses to play along.",
        "TED · James Veitch",
        ["persuasion", "social-influence", "scams", "social-engineering", "internet-culture"],
    ),
]

# ── External · generic link (1) ────────────────────────────────────────
GENERIC: list[dict] = [
    {
        "source_url": "https://vimeo.com/112681885",
        "title": "Postcards from Pripyat, Chernobyl",
        "description": "Three minutes of drone and handheld footage over the "
        "city evacuated after the 1986 Chernobyl disaster — the ferris wheel "
        "that never turned, a schoolroom of scattered gas masks. Shot by Danny "
        "Cooke on assignment for 60 Minutes. Plays at Vimeo.",
        "source_name": "Danny Cooke",
        "thumbnail_url": "https://i.vimeocdn.com/video/497808997-115185d236e75d5c8593d56ffafe78006bb72a8656292739c4f35d48811d12cc-d_1280?region=us",
        "tags": ["chernobyl-exclusion-zones", "abandoned-places", "urban-exploration", "nuclear-disaster", "aerial-cinematography"],
    },
]

# ── Hosted / indexed (1) — public domain, ingested normally ─────────────
HOSTED: list[dict] = [
    {
        "download_url": "https://archive.org/download/SF121/SF121.mpg",
        "filename": "tacoma-narrows-bridge-1940.mpg",
        "content_type": "video/mpeg",
        "title": "Tacoma Narrows Bridge Collapse (1940)",
        "description": "Four months after it opened, a suspension bridge near "
        "Tacoma began to twist in a 40 mph wind and tore itself apart on film. "
        "'Galloping Gertie' became the textbook case in every course on "
        "resonance and structural failure. Public-domain newsreel footage.",
        "owner": "Stillman Fires Collection",
        "tags": ["disaster-survival", "engineering-failure", "bridges", "aeroelastic-flutter", "resonance", "historical-oddities"],
    },
]


def _table():
    return boto3.resource("dynamodb", region_name=REGION).Table(VIDEOS_TABLE)


def _put_external_youtube(entry, dry: bool) -> str | None:
    url, title, desc, source_name, tags = entry
    r = providers.resolve_external(url)  # provider/source_url/provider_id/embed_url/thumbnail_url
    vid = uuid.uuid4().hex
    item = {
        "video_id": vid,
        "filename": f"{r['provider']}-{r['provider_id']}",
        "status": "ready",
        "created_at": NOW,
        "source_type": "external",
        "provider": r["provider"],
        "source_url": r["source_url"],
        "provider_id": r["provider_id"],
        "embed_url": r["embed_url"],
        "thumbnail_url": r["thumbnail_url"],
        "owner": source_name,
        "source_name": source_name,
        "created_by": "seed-batch1",
        "batch": BATCH,
        "title": title,
        "description": desc,
        "tags": tags,
        "visibility": "public",
        "views": 0, "hops": 0, "thumps": 0,
    }
    if dry:
        print(f"  [yt]   {title}  <{r['provider_id']}>  tags={tags}")
        return None
    _table().put_item(Item=item)
    print(f"  seeded {vid}  {title}")
    return vid


def _put_generic(g, dry: bool) -> str | None:
    r = providers.resolve_external(g["source_url"], provider="generic")
    vid = uuid.uuid4().hex
    item = {
        "video_id": vid,
        "filename": "external-link",
        "status": "ready",
        "created_at": NOW,
        "source_type": "external",
        "provider": "generic",
        "source_url": r["source_url"],
        "thumbnail_url": g["thumbnail_url"],
        "owner": g["source_name"],
        "source_name": g["source_name"],
        "created_by": "seed-batch1",
        "batch": BATCH,
        "title": g["title"],
        "description": g["description"],
        "tags": g["tags"],
        "visibility": "public",
        "views": 0, "hops": 0, "thumps": 0,
    }
    if dry:
        print(f"  [link] {g['title']}  -> {r['source_url']}  tags={g['tags']}")
        return None
    _table().put_item(Item=item)
    print(f"  seeded {vid}  {g['title']} (generic link)")
    return vid


def _put_hosted(h, dry: bool) -> str | None:
    vid = uuid.uuid4().hex
    key = f"uploads/{vid}/{h['filename']}"
    if dry:
        print(f"  [host] {h['title']}  <- {h['download_url']}  key={key}  tags={h['tags']}")
        return None
    item = {
        "video_id": vid,
        "filename": h["filename"],
        "key": key,
        "content_type": h["content_type"],
        "status": "pending_upload",
        "owner": h["owner"],
        "created_by": "seed-batch1",
        "batch": BATCH,
        "created_at": NOW,
        "visibility": "public",
        "title": h["title"],
        "description": h["description"],
        "tags": h["tags"],
    }
    _table().put_item(Item=item)
    print(f"  record {vid} created; downloading source…")
    tmp = f"/tmp/{h['filename']}"
    urllib.request.urlretrieve(h["download_url"], tmp)
    size = os.path.getsize(tmp)
    boto3.client("s3", region_name=REGION).upload_file(
        tmp, UPLOADS_BUCKET, key, ExtraArgs={"ContentType": h["content_type"]}
    )
    os.remove(tmp)
    print(f"  uploaded {size} bytes -> s3://{UPLOADS_BUCKET}/{key}  (worker will transcode)")
    return vid


def remove():
    tbl = _table()
    resp = tbl.scan(
        FilterExpression=boto3.dynamodb.conditions.Attr("batch").eq(BATCH),
        ProjectionExpression="video_id, title",
    )
    items = resp.get("Items", [])
    if not items:
        print("nothing tagged", BATCH)
        return
    for it in items:
        tbl.delete_item(Key={"video_id": it["video_id"]})
        print(f"  removed {it['video_id']}  {it.get('title')}")
    print(f"removed {len(items)} records")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--seed", action="store_true")
    ap.add_argument("--remove", action="store_true")
    args = ap.parse_args()
    if args.remove:
        remove()
        return
    dry = args.dry_run or not args.seed
    print(f"{'DRY RUN' if dry else 'LIVE'} — batch={BATCH}  table={VIDEOS_TABLE}\n")
    ids: list[str] = []
    print("== External · YouTube ==")
    for e in YOUTUBE:
        v = _put_external_youtube(e, dry)
        if v:
            ids.append(v)
    print("\n== External · generic link ==")
    for g in GENERIC:
        v = _put_generic(g, dry)
        if v:
            ids.append(v)
    print("\n== Hosted / indexed ==")
    for h in HOSTED:
        v = _put_hosted(h, dry)
        if v:
            ids.append(v)
    print(f"\n{'would seed' if dry else 'seeded'} {len(YOUTUBE) + len(GENERIC) + len(HOSTED)} items"
          + (f"; ids={ids}" if ids else ""))


if __name__ == "__main__":
    main()
