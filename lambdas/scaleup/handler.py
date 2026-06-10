"""Wake the transcode worker the instant an upload lands.

Triggered by EventBridge (S3 ObjectCreated on the uploads bucket). Pins the
worker's autoscaling floor to 1 and sets desiredCount to 1 so a task starts
immediately — and, crucially, CANNOT be scaled back to zero by a stale idle
alarm while the job is still queued. The scaledown Lambda releases the floor
back to 0 once the idle alarm confirms the queue is genuinely empty.
"""

import os

import boto3

ecs = boto3.client("ecs")
aas = boto3.client("application-autoscaling")
CLUSTER = os.environ["CLUSTER"]
SERVICE = os.environ["SERVICE"]
MAX_CAPACITY = int(os.environ.get("MAX_CAPACITY", "4"))
RESOURCE_ID = f"service/{CLUSTER}/{SERVICE}"


def handler(event, _context):
    # Pin the floor to 1: autoscaling cannot drop below this, so the laggy idle
    # alarm (SQS metrics trail by ~5 min) can't reap the freshly-woken task.
    aas.register_scalable_target(
        ServiceNamespace="ecs",
        ResourceId=RESOURCE_ID,
        ScalableDimension="ecs:service:DesiredCount",
        MinCapacity=1,
        MaxCapacity=MAX_CAPACITY,
    )
    # Kick desiredCount up now rather than waiting for autoscaling to react.
    resp = ecs.describe_services(cluster=CLUSTER, services=[SERVICE])
    desired = resp["services"][0]["desiredCount"] if resp.get("services") else 0
    if desired < 1:
        ecs.update_service(cluster=CLUSTER, service=SERVICE, desiredCount=1)
    print(f"scaleup: floor pinned to 1, desired>=1 (was {desired})")
    return {"ok": True}
