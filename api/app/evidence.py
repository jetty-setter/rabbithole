"""Version-scoped evidence reads. Publication access is checked by the route."""
import re
from datetime import datetime, timezone

from boto3.dynamodb.conditions import Key

from . import aws


def run_id(article):
    return f"{article['id']}#{int(article['revision'])}#{article.get('evidence_generation', 'initial')}"


def read(article, query):
    kwargs = {"KeyConditionExpression": Key("run_id").eq(run_id(article)), "ConsistentRead": True}
    rows = {}
    while True:
        page = aws.evidence_table().query(**kwargs)
        rows.update({row["source_id"]: row for row in page.get("Items", [])})
        if not page.get("LastEvaluatedKey"):
            break
        kwargs["ExclusiveStartKey"] = page["LastEvaluatedKey"]
    terms = set(re.findall(r"\w+", query.casefold()))
    jobs, matches = [], []
    for number, source in enumerate(sorted(article.get("sources", []), key=lambda s: int(s.get("order", 0))), 1):
        row = rows.get(source["id"], {})
        status = row.get("status", "queued")
        if status in ("queued", "processing", "retrying"):
            timestamp = row.get("updated_at") or article.get("evidence_requested_at") or article.get("updated_at")
            if timestamp and (datetime.now(timezone.utc) - datetime.fromisoformat(timestamp)).total_seconds() > 1800:
                status = "delayed"
        job = {"source_id": source["id"], "number": number, "title": source["title"],
               "status": status, "updated_at": row.get("updated_at"), "detail": row.get("detail"),
               "truncated": row.get("truncated", False)}
        jobs.append(job)
        if status != "ready" or not terms:
            continue
        for index, passage in enumerate(row.get("passages", [])):
            words = set(re.findall(r"\w+", passage.casefold()))
            if terms <= words:
                matches.append({"source_id": source["id"], "number": number, "title": source["title"],
                                "passage_index": index, "passage": passage})
    pending = any(j["status"] in ("queued", "processing", "retrying") for j in jobs)
    ready = sum(j["status"] == "ready" for j in jobs)
    status = "processing" if pending else "ready" if ready == len(jobs) else "partial" if ready else "unavailable"
    return {"status": status, "jobs": jobs, "matches": matches[:50], "total_matches": len(matches)}
