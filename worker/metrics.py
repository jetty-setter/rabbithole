"""CloudWatch metric emission."""

from __future__ import annotations

import os

import boto3

# Fargate pricing inputs for the per-video cost estimate (us-east-1 defaults).
FARGATE_CPU_UNITS = int(os.getenv("FARGATE_CPU_UNITS", "512"))
FARGATE_MEMORY_MIB = int(os.getenv("FARGATE_MEMORY_MIB", "1024"))
FARGATE_VCPU_HOUR = float(os.getenv("FARGATE_VCPU_HOUR", "0.04048"))
FARGATE_GB_HOUR = float(os.getenv("FARGATE_GB_HOUR", "0.004445"))

METRIC_NAMESPACE = "RabbitHole/Transcode"

_cloudwatch = None


def _get_cloudwatch():
    global _cloudwatch
    if _cloudwatch is None:
        _cloudwatch = boto3.client("cloudwatch")
    return _cloudwatch


def estimate_cost(seconds: float) -> float:
    """Estimated Fargate compute cost for `seconds` of processing."""
    vcpu = FARGATE_CPU_UNITS / 1024
    gb = FARGATE_MEMORY_MIB / 1024
    return seconds / 3600 * (vcpu * FARGATE_VCPU_HOUR + gb * FARGATE_GB_HOUR)


def emit_metrics(seconds: float, cost: float) -> None:
    """Publish transcode throughput + cost so the CloudWatch dashboard can show
    jobs/hour and $/day. Best-effort — telemetry never fails a job."""
    try:
        _get_cloudwatch().put_metric_data(
            Namespace=METRIC_NAMESPACE,
            MetricData=[
                {"MetricName": "TranscodeCount", "Value": 1, "Unit": "Count"},
                {"MetricName": "TranscodeSeconds", "Value": seconds, "Unit": "Seconds"},
                {"MetricName": "TranscodeCostUSD", "Value": cost, "Unit": "None"},
            ],
        )
    except Exception as exc:  # noqa: BLE001
        print(f"metric emit skipped: {exc}")
