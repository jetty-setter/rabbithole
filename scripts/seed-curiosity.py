"""Add the reviewed starter collection as official YouTube embeds.

Dry run by default. Checks YouTube oEmbed metadata and expected source attribution
before writing. Does not download media, create transcripts, or overwrite videos.
Run: python scripts/seed-curiosity.py --profile rabbithole [--apply]
"""
import argparse
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen

import boto3
from botocore.exceptions import ClientError


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--profile", default="rabbithole")
    parser.add_argument("--table", default="rabbithole-dev-videos")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    manifest = json.loads(Path(__file__).with_name("curiosity-starter.json").read_text())
    items = []
    for pick in manifest:
        pid = pick["provider_id"]
        url = f"https://www.youtube.com/watch?v={pid}"
        with urlopen("https://www.youtube.com/oembed?" + urlencode({"url": url, "format": "json"}), timeout=20) as response:
            metadata = json.load(response)
        author = metadata["author_name"]
        if pick["expected_author"].casefold() not in author.casefold():
            raise ValueError(f"Source attribution mismatch for {pid}: {author}")
        item = {
            "video_id": uuid.uuid5(uuid.NAMESPACE_URL, url).hex,
            "filename": f"youtube-{pid}", "status": "ready", "source_type": "external",
            "provider": "youtube", "provider_id": pid, "source_url": url,
            "embed_url": f"https://www.youtube-nocookie.com/embed/{pid}?enablejsapi=1&rel=0",
            "thumbnail_url": metadata["thumbnail_url"], "title": pick["title"],
            "description": pick["description"], "tags": pick["tags"],
            "owner": author, "source_name": author, "created_by": "curiosity-starter",
            "created_at": datetime.now(timezone.utc).isoformat(), "visibility": "public",
            "transcript_source": "none", "transcript_status": "pending", "has_transcript": False,
            "views": 0, "hops": 0, "thumps": 0,
            "editorial_reference": pick["reference_url"],
        }
        items.append(item)
        print(f"Verified: {item['title']} | {author} | {url}")
    if not args.apply:
        print(f"Dry run: {len(items)} verified embeds. No records written.")
        return
    table = boto3.Session(profile_name=args.profile, region_name="us-east-1").resource("dynamodb").Table(args.table)
    existing_ids = set()
    has_featured = False
    scan_args = {"ProjectionExpression": "provider_id, featured"}
    while True:
        page = table.scan(**scan_args)
        existing_ids.update(v.get("provider_id") for v in page.get("Items", []))
        has_featured = has_featured or any(v.get("featured") for v in page.get("Items", []))
        if not page.get("LastEvaluatedKey"):
            break
        scan_args["ExclusiveStartKey"] = page["LastEvaluatedKey"]
    for item in items:
        if item["provider_id"] in existing_ids:
            print(f"Already present: {item['title']}")
            continue
        item["featured"] = not has_featured
        try:
            table.put_item(Item=item, ConditionExpression="attribute_not_exists(video_id)")
            has_featured = True
            print(f"Added: {item['video_id']} | {item['title']}")
        except ClientError as exc:
            if exc.response["Error"]["Code"] != "ConditionalCheckFailedException":
                raise
            print(f"Existing record preserved: {item['video_id']}")


if __name__ == "__main__":
    main()
