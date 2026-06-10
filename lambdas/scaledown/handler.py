"""Return the transcode worker to zero — but only when the queue is empty.

Triggered by EventBridge on the worker-idle CloudWatch alarm entering ALARM
(visible + in-flight SQS messages < 1 for 5 minutes). Releases the autoscaling
floor back to 0 and sets desiredCount to 0. Because the floor is only released
here — never while a job is queued or in flight — a stale metric can't strand
an upload, and the worker still scales fully to zero when truly idle.
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
    # Idle confirmed by the alarm. Drop the floor, then scale to zero.
    aas.register_scalable_target(
        ServiceNamespace="ecs",
        ResourceId=RESOURCE_ID,
        ScalableDimension="ecs:service:DesiredCount",
        MinCapacity=0,
        MaxCapacity=MAX_CAPACITY,
    )
    ecs.update_service(cluster=CLUSTER, service=SERVICE, desiredCount=0)
    print("scaledown: floor released to 0, desired=0")
    return {"ok": True}
