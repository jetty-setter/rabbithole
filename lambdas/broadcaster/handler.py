"""DynamoDB Stream → WebSocket broadcaster.

Triggered by the videos table stream. When a video's status changes, it pushes
the change to every connected WebSocket client. Stale connections are pruned.
"""

import json
import os

import boto3

_connections = boto3.resource("dynamodb").Table(os.environ["CONNECTIONS_TABLE"])
_apigw = boto3.client("apigatewaymanagementapi", endpoint_url=os.environ["WS_ENDPOINT"])


def _status(image: dict) -> tuple[str | None, str | None]:
    return (
        image.get("video_id", {}).get("S"),
        image.get("status", {}).get("S"),
    )


def handler(event, _context):
    updates = []
    for record in event.get("Records", []):
        if record["eventName"] not in ("INSERT", "MODIFY"):
            continue
        ddb = record["dynamodb"]
        video_id, new_status = _status(ddb.get("NewImage", {}))
        _, old_status = _status(ddb.get("OldImage", {}))
        if video_id and new_status and new_status != old_status:
            updates.append({"video_id": video_id, "status": new_status})

    if not updates:
        return {"statusCode": 200}

    payload = json.dumps({"type": "status", "updates": updates}).encode()
    connections = _connections.scan(ProjectionExpression="connection_id").get("Items", [])

    for item in connections:
        connection_id = item["connection_id"]
        try:
            _apigw.post_to_connection(ConnectionId=connection_id, Data=payload)
        except _apigw.exceptions.GoneException:
            _connections.delete_item(Key={"connection_id": connection_id})
        except Exception as exc:  # noqa: BLE001
            print(f"post_to_connection failed for {connection_id}: {exc}")

    return {"statusCode": 200}
