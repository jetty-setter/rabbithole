"""Exercise publication -> dispatch -> worker -> reader using AWS emulation.

Only source downloads are replaced; DynamoDB/SQS/S3 use moto-backed AWS clients.
"""
import json
import socket
from unittest.mock import Mock

import boto3
import pytest
from boto3.dynamodb.types import TypeSerializer

import evidence_fetch
import evidence_handler
from conftest import auth


@pytest.fixture
def pipeline(client, monkeypatch):
    monkeypatch.setenv("EVIDENCE_TABLE", "test-evidence")
    monkeypatch.setenv("EVIDENCE_BUCKET", "test-uploads")
    queue = boto3.client("sqs", region_name="us-east-1")
    url = queue.create_queue(QueueName="evidence")['QueueUrl']
    monkeypatch.setenv("EVIDENCE_QUEUE_URL", url)
    article = {"id": "rh_evidence", "revision": 2, "slug": "evidence-test", "status": "published",
               "sources": [{"id": "s9", "order": 1, "title": "Original record", "url": "https://example.com/record"},
                           {"id": "s3", "order": 2, "title": "Unsupported document", "url": "https://example.com/file.pdf"}]}
    table = boto3.resource("dynamodb", region_name="us-east-1").Table("test-rabbitholes")
    table.put_item(Item=article)
    return client, article, queue, url, table


def stream(article, old=None):
    serializer = TypeSerializer().serialize
    return {"Records": [{"dynamodb": {"SequenceNumber": "100", "NewImage": {k: serializer(v) for k, v in article.items()},
                                      "OldImage": {k: serializer(v) for k, v in (old or {}).items()}}}]}


def drain(queue, url):
    return {"Records": [{"messageId": m["MessageId"], "body": m["Body"], "attributes": {"ApproximateReceiveCount": "1"}}
                        for m in queue.receive_message(QueueUrl=url, MaxNumberOfMessages=10).get("Messages", [])]}


def test_pipeline_indexes_and_cites_correct_source_number(pipeline, monkeypatch):
    client, article, queue, url, _ = pipeline
    def download(url):
        if url.endswith(".pdf"):
            raise evidence_fetch.UnsupportedSource("PDF is not supported yet.")
        return "<nav>noise</nav><p>The unusual signal was recorded twice.</p>", "text/html", url
    fetch = Mock(side_effect=download)
    monkeypatch.setattr(evidence_handler, "download", fetch)
    assert evidence_handler.dispatch(stream(article), None) == {"batchItemFailures": []}
    pending = client.get("/rabbitholes/evidence-test/evidence").json()
    assert pending["status"] == "processing"
    event = drain(queue, url)
    assert len(event["Records"]) == 2
    assert evidence_handler.worker(event, None) == {"batchItemFailures": []}
    # At-least-once delivery never refetches terminal results.
    assert evidence_handler.worker(event, None) == {"batchItemFailures": []}
    assert fetch.call_count == 2
    result = client.get("/rabbitholes/evidence-test/evidence?q=signal").json()
    assert result["status"] == "partial"
    assert result["matches"][0]["source_id"] == "s9"
    assert result["matches"][0]["number"] == 1
    assert "noise" not in result["matches"][0]["passage"]
    assert result["jobs"][1]["status"] == "unsupported"
    assert client.get("/rabbitholes/evidence-test/evidence").json()["matches"] == []
    assert len(boto3.client("s3", region_name="us-east-1").list_objects_v2(Bucket="test-uploads")["Contents"]) == 1


def test_rebuild_is_admin_only_and_old_run_is_not_returned(pipeline, monkeypatch):
    client, article, queue, url, articles = pipeline
    monkeypatch.setattr(evidence_handler, "download", lambda url: ("a useful signal", "text/plain", url))
    evidence_handler.dispatch(stream(article), None)
    evidence_handler.worker(drain(queue, url), None)
    path = "/admin/rabbitholes/rh_evidence/evidence:rebuild"
    assert client.post(path, headers=auth("someone")).status_code == 403
    assert client.post(path, headers=auth("admin")).status_code == 202
    assert client.get("/rabbitholes/evidence-test/evidence?q=signal").json()["matches"] == []
    current = articles.get_item(Key={"id": article["id"]})["Item"]
    evidence_handler.dispatch(stream(current, article), None)
    assert len(drain(queue, url)["Records"]) == 2
    articles.update_item(Key={"id": article["id"]}, UpdateExpression="SET #s = :s",
                         ExpressionAttributeNames={"#s": "status"}, ExpressionAttributeValues={":s": "draft"})
    assert client.get("/rabbitholes/evidence-test/evidence?q=signal").status_code == 404
    assert client.post(path, headers=auth("admin")).status_code == 409


def test_retryable_failure_is_reported_and_can_recover(pipeline, monkeypatch):
    _, article, queue, url, _ = pipeline
    evidence_handler.dispatch(stream(article), None)
    event = drain(queue, url)
    monkeypatch.setattr(evidence_handler, "download", Mock(side_effect=socket.timeout("timeout")))
    assert len(evidence_handler.worker(event, None)["batchItemFailures"]) == 2
    for record in event["Records"]:
        record["attributes"]["ApproximateReceiveCount"] = "3"
    assert len(evidence_handler.worker(event, None)["batchItemFailures"]) == 2
    row = evidence_handler.table().get_item(Key={"run_id": evidence_handler.run_id(article), "source_id": "s9"})["Item"]
    assert row["status"] == "failed"
    monkeypatch.setattr(evidence_handler, "download", lambda url: ("recovered", "text/plain", url))
    assert evidence_handler.worker(event, None) == {"batchItemFailures": []}


def test_dispatch_ignores_unpublished_and_unchanged_run(pipeline):
    _, article, queue, url, _ = pipeline
    evidence_handler.dispatch(stream({**article, "status": "draft"}), None)
    evidence_handler.dispatch(stream(article, article), None)
    assert drain(queue, url)["Records"] == []


@pytest.mark.parametrize("url", ["http://example.com", "https://user:pass@example.com", "https://example.com:8443"])
def test_rejects_unsupported_destinations(url):
    with pytest.raises(evidence_fetch.UnsupportedSource):
        evidence_fetch.public_target(url)


@pytest.mark.parametrize("ip", ["127.0.0.1", "169.254.169.254", "10.1.2.3", "::1"])
def test_rejects_private_dns_answers(monkeypatch, ip):
    monkeypatch.setattr(socket, "getaddrinfo", lambda *a, **k: [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (ip, 443))])
    with pytest.raises(evidence_fetch.UnsupportedSource):
        evidence_fetch.public_target("https://example.com")


def test_extraction_is_bounded_and_removes_scripts():
    passages, digest, truncated = evidence_fetch.extract("<script>secret</script><p>" + "word " * 6000 + "</p>", "text/html")
    assert truncated and len(digest) == 64
    assert sum(map(len, passages)) <= evidence_fetch.MAX_TEXT
    assert max(map(len, passages)) <= 600
    assert "secret" not in " ".join(passages)
