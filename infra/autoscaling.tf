# Scale the worker fleet on SQS backlog — all the way down to zero.
#
# Step scaling (not target tracking) is used deliberately: it lets us scale UP
# FROM ZERO via a CloudWatch alarm on queue depth. Target tracking can't reliably
# scale from 0 because its "backlog per task" ratio is undefined with no tasks.

resource "aws_appautoscaling_target" "worker" {
  service_namespace  = "ecs"
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.worker.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  min_capacity       = 0
  max_capacity       = var.worker_max_count

  # The scaleup/scaledown Lambdas adjust min_capacity at runtime — pinned to 1
  # while a job is queued/in-flight, released to 0 only when idle. Terraform must
  # not reset it underneath them, or it could strand an in-flight job.
  lifecycle {
    ignore_changes = [min_capacity]
  }
}

# Worker wake-up AND scale-down are both event-driven Lambdas (see scaleup.tf /
# scaledown.tf). We deliberately do NOT use a step-scaling scale-in policy: it
# adjusts desiredCount directly and races the event-driven wake (a stale, laggy
# idle alarm could reap a freshly-woken task before it starts). Instead the idle
# alarm below only signals "queue empty"; the scaledown Lambda acts on it and
# releases the autoscaling floor, so a queued job can never be scaled to zero.

# Scale in to zero only when the queue is TRULY empty — both waiting (visible)
# AND in-flight (not-visible) messages are gone. Watching visible-only would reap
# a worker the instant it picked up a job, killing the transcode mid-flight.
resource "aws_cloudwatch_metric_alarm" "idle" {
  alarm_name          = "${local.name}-worker-idle"
  alarm_description   = "No waiting or in-flight jobs - scaledown Lambda returns the worker to zero"
  comparison_operator = "LessThanThreshold"
  threshold           = 1
  evaluation_periods  = 5

  metric_query {
    id          = "total"
    expression  = "visible + inflight"
    label       = "TotalJobs"
    return_data = true
  }

  metric_query {
    id = "visible"
    metric {
      namespace   = "AWS/SQS"
      metric_name = "ApproximateNumberOfMessagesVisible"
      dimensions  = { QueueName = aws_sqs_queue.jobs.name }
      period      = 60
      stat        = "Maximum"
    }
  }

  metric_query {
    id = "inflight"
    metric {
      namespace   = "AWS/SQS"
      metric_name = "ApproximateNumberOfMessagesNotVisible"
      dimensions  = { QueueName = aws_sqs_queue.jobs.name }
      period      = 60
      stat        = "Maximum"
    }
  }
}
