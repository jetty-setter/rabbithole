"""DynamoDB outbox -> SQS fan-out -> independent, idempotent source workers."""

import json
import logging
import os
import time
from datetime import datetime, timezone

import boto3
from boto3.dynamodb.types import TypeDeserializer
from botocore.exceptions import ClientError

from evidence_fetch import UnsupportedSource, UnavailableSource, download, extract

log = logging.getLogger(__name__)
log.setLevel(logging.INFO)


def table():
    return boto3.resource("dynamodb").Table(os.environ["EVIDENCE_TABLE"])


def run_id(article):
    return f"{article['id']}#{int(article['revision'])}#{article.get('evidence_generation', 'initial')}"


def now():
    return datetime.now(timezone.utc).isoformat()


def dispatch(event, context):
    deserialize = TypeDeserializer().deserialize
    failures = []
    queue = boto3.client("sqs")
    for record in event["Records"]:
        try:
            stream = record.get("dynamodb", {})
            article = {k: deserialize(v) for k, v in stream.get("NewImage", {}).items()}
            old = {k: deserialize(v) for k, v in stream.get("OldImage", {}).items()}
            if article.get("status") != "published":
                continue
            if old.get("status") == "published" and run_id(old) == run_id(article):
                continue
            for source in article.get("sources", []):
                key = {"run_id": run_id(article), "source_id": source["id"]}
                row = {**key, "status": "queued", "updated_at": now()}
                try:
                    table().put_item(Item=row, ConditionExpression="attribute_not_exists(run_id)")
                except ClientError as exc:
                    if exc.response["Error"]["Code"] != "ConditionalCheckFailedException":
                        raise
                # Always send, including on a replay after a send failure. Completed workers deduplicate.
                queue.send_message(QueueUrl=os.environ["EVIDENCE_QUEUE_URL"], MessageBody=json.dumps({
                    **key, "url": source.get("url") or source.get("archive_url") or "",
                }))
        except Exception:
            log.exception("Evidence dispatch failed")
            failures.append({"itemIdentifier": record["dynamodb"]["SequenceNumber"]})
    return {"batchItemFailures": failures}


def worker(event, context):
    failures = []
    for record in event["Records"]:
        key = None
        try:
            job = json.loads(record["body"])
            key = {"run_id": job["run_id"], "source_id": job["source_id"]}
            existing = table().get_item(Key=key, ConsistentRead=True).get("Item", {})
            if existing.get("status") in ("ready", "unsupported", "unavailable"):
                continue
            # A lease prevents concurrent deliveries fetching the same source. A crashed worker
            # can be retried after the lease expires; visibility timeout is longer than the lease.
            try:
                table().update_item(
                    Key=key, UpdateExpression="SET #s = :s, lease_until = :lease, updated_at = :at",
                    ConditionExpression="(attribute_not_exists(lease_until) OR lease_until < :now) AND (attribute_not_exists(#s) OR NOT (#s IN (:ready, :unsupported, :unavailable)))",
                    ExpressionAttributeNames={"#s": "status"},
                    ExpressionAttributeValues={":s": "processing", ":lease": int(time.time()) + 100,
                                               ":now": int(time.time()), ":at": now(), ":ready": "ready",
                                               ":unsupported": "unsupported", ":unavailable": "unavailable"},
                )
            except ClientError as exc:
                if exc.response["Error"]["Code"] == "ConditionalCheckFailedException":
                    failures.append({"itemIdentifier": record["messageId"]})
                    continue
                raise
            try:
                text, content_type, final_url = download(job["url"])
                passages, digest, truncated = extract(text, content_type)
                if not passages:
                    raise UnavailableSource("No readable text was found at this source.")
                object_key = f"{key['run_id']}/{key['source_id']}/{digest}.json"
                boto3.client("s3").put_object(
                    Bucket=os.environ["EVIDENCE_BUCKET"], Key=object_key,
                    Body=json.dumps({"url": final_url, "passages": passages, "sha256": digest}).encode(),
                    ContentType="application/json",
                )
                result = {"status": "ready", "passages": passages, "sha256": digest,
                          "resolved_url": final_url, "truncated": truncated, "snapshot_key": object_key}
            except UnsupportedSource as exc:
                result = {"status": "unsupported", "detail": str(exc)}
            except (UnavailableSource, ValueError) as exc:
                result = {"status": "unavailable", "detail": str(exc)}
            table().put_item(Item={**key, **result, "updated_at": now()})
            log.info("source_processed run=%s source=%s status=%s", key["run_id"], key["source_id"], result["status"])
        except Exception:
            log.exception("Evidence source processing failed")
            if key:
                attempts = int(record.get("attributes", {}).get("ApproximateReceiveCount", "1"))
                table().put_item(Item={**key, "status": "failed" if attempts >= 3 else "retrying",
                                      "detail": "Source processing failed; retry available to the editor.",
                                      "updated_at": now()})
            failures.append({"itemIdentifier": record["messageId"]})
    return {"batchItemFailures": failures}
