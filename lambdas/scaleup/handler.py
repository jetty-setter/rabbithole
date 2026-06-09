"""Wake the transcode worker the instant an upload lands.

Triggered by EventBridge (S3 ObjectCreated on the uploads bucket). Sets the
worker service's desired count to 1 so a task starts immediately — no waiting on
laggy SQS CloudWatch metrics. The in-flight-aware scale-in alarm returns it to 0.
"""

import os

import boto3

ecs = boto3.client("ecs")
CLUSTER = os.environ["CLUSTER"]
SERVICE = os.environ["SERVICE"]


def handler(event, _context):
    resp = ecs.describe_services(cluster=CLUSTER, services=[SERVICE])
    desired = resp["services"][0]["desiredCount"] if resp.get("services") else 0
    if desired < 1:
        ecs.update_service(cluster=CLUSTER, service=SERVICE, desiredCount=1)
        print(f"scaled {SERVICE} 0 -> 1")
    else:
        print(f"{SERVICE} already at {desired}")
    return {"ok": True}
