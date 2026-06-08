"""WebSocket $connect / $disconnect handler.

Tracks live WebSocket connection IDs in DynamoDB so the broadcaster knows
who to push status updates to.
"""

import os

import boto3

_table = boto3.resource("dynamodb").Table(os.environ["CONNECTIONS_TABLE"])


def handler(event, _context):
    rc = event["requestContext"]
    route = rc["routeKey"]
    connection_id = rc["connectionId"]

    if route == "$connect":
        _table.put_item(Item={"connection_id": connection_id})
    elif route == "$disconnect":
        _table.delete_item(Key={"connection_id": connection_id})

    return {"statusCode": 200}
