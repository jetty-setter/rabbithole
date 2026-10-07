"""Import timestamped browser transcript exports for existing curated videos.

Dry run by default. Never replaces an existing transcript. Pass export paths
and --apply to write captions to the existing video storage and catalog.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import uuid

import boto3


def parse_export(text):
    identity = re.search(r"^Video ID: ([\w-]{11})$", text, re.M)
    language = re.search(r"^Language: (\S+)$", text, re.M)
    if not identity or not language or not language[1].startswith("en"):
        raise ValueError("Expected an identified English YouTube transcript")
    cues = []
    for line in text.splitlines():
        match = re.match(r"^\[(\d+:\d{2}(?::\d{2})?)\] (.+)$", line)
        if not match:
            continue
        seconds = 0
        for part in match[1].split(":"):
            seconds = seconds * 60 + int(part)
        if cues and seconds < cues[-1]["start"]:
            raise ValueError("Transcript timestamps are out of order")
        if cues and seconds == cues[-1]["start"]:
            cues[-1]["text"] += " " + match[2]
        else:
            cues.append({"start": seconds, "text": match[2]})
    if len(cues) < 10 or cues[-1]["start"] < 60:
        raise ValueError("Transcript appears empty or truncated")
    # Export has start times only. End boundaries are inferred from next cue.
    for i, cue in enumerate(cues):
        cue["end"] = cues[i + 1]["start"] if i + 1 < len(cues) else cue["start"] + 1
    return identity[1], cues


def timestamp(seconds):
    return f"{seconds // 3600:02d}:{seconds // 60 % 60:02d}:{seconds % 60:02d}.000"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("files", nargs="+")
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--profile", default="rabbithole")
    args = parser.parse_args()
    picks = {p["provider_id"] for p in json.loads(Path(__file__).with_name("curiosity-starter.json").read_text())}
    prepared = []
    for filename in args.files:
        text = Path(filename).read_text()
        pid, cues = parse_export(text)
        if pid not in picks:
            raise ValueError(f"Not in curated collection: {pid}")
        prepared.append((pid, cues, hashlib.sha256(text.encode()).hexdigest()))
        print(f"Validated {pid}: {len(cues)} cues, final start {cues[-1]['start']}s")
    if not args.apply:
        return
    session = boto3.Session(profile_name=args.profile, region_name="us-east-1")
    table = session.resource("dynamodb").Table("rabbithole-dev-videos")
    s3 = session.client("s3")
    bucket = session.client("lambda").get_function_configuration(FunctionName="rabbithole-dev-api")["Environment"]["Variables"]["STREAMING_BUCKET"]
    for pid, cues, digest in prepared:
        vid = uuid.uuid5(uuid.NAMESPACE_URL, f"https://www.youtube.com/watch?v={pid}").hex
        item = table.get_item(Key={"video_id": vid}, ConsistentRead=True).get("Item", {})
        if item.get("provider_id") != pid or item.get("provider") != "youtube":
            raise ValueError(f"Catalog identity mismatch: {pid}")
        if item.get("has_transcript") or item.get("transcript_status") == "ready":
            print(f"Preserved existing transcript: {pid}")
            continue
        vtt = "WEBVTT\n\n" + "\n\n".join(f"{timestamp(c['start'])} --> {timestamp(c['end'])}\n{c['text']}" for c in cues)
        for name, body, kind in [("cues.json", json.dumps(cues), "application/json"), ("captions.vtt", vtt, "text/vtt")]:
            s3.put_object(Bucket=bucket, Key=f"{vid}/{name}", Body=body.encode(), ContentType=kind, IfNoneMatch="*")
        fields = {"transcript_status": "ready", "has_transcript": True, "transcribing": False, "transcript_key": f"{vid}/cues.json", "vtt_key": f"{vid}/captions.vtt", "transcript_source": "provider", "transcript_timed": True, "transcript_export_sha256": digest, "transcript_end_times": "inferred"}
        table.update_item(Key={"video_id": vid}, UpdateExpression="SET " + ", ".join(f"#f{i} = :v{i}" for i in range(len(fields))), ExpressionAttributeNames={f"#f{i}": key for i, key in enumerate(fields)}, ExpressionAttributeValues={**{f":v{i}": value for i, value in enumerate(fields.values())}, ":false": False}, ConditionExpression="attribute_exists(video_id) AND (attribute_not_exists(has_transcript) OR has_transcript = :false)")
        print(f"Imported {pid}: {vid}")


if __name__ == "__main__":
    main()
