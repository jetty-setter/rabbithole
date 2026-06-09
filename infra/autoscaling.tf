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
}

resource "aws_appautoscaling_policy" "scale_in" {
  name               = "${local.name}-worker-scale-in"
  policy_type        = "StepScaling"
  service_namespace  = aws_appautoscaling_target.worker.service_namespace
  resource_id        = aws_appautoscaling_target.worker.resource_id
  scalable_dimension = aws_appautoscaling_target.worker.scalable_dimension

  step_scaling_policy_configuration {
    adjustment_type         = "ChangeInCapacity"
    cooldown                = 120
    metric_aggregation_type = "Maximum"

    step_adjustment {
      metric_interval_upper_bound = 0
      scaling_adjustment          = -1
    }
  }
}

# Worker wake-up is now event-driven (see scaleup.tf) — no SQS-metric scale-out
# alarm, because SQS only emits metrics every 5 min, which made it unreliable.

# Scale in to zero only when the queue is TRULY empty — both waiting (visible)
# AND in-flight (not-visible) messages are gone. Watching visible-only would reap
# a worker the instant it picked up a job, killing the transcode mid-flight.
resource "aws_cloudwatch_metric_alarm" "idle" {
  alarm_name          = "${local.name}-worker-idle"
  alarm_description   = "No waiting or in-flight jobs - scale the worker fleet to zero"
  comparison_operator = "LessThanThreshold"
  threshold           = 1
  evaluation_periods  = 5
  alarm_actions       = [aws_appautoscaling_policy.scale_in.arn]

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
