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

resource "aws_appautoscaling_policy" "scale_out" {
  name               = "${local.name}-worker-scale-out"
  policy_type        = "StepScaling"
  service_namespace  = aws_appautoscaling_target.worker.service_namespace
  resource_id        = aws_appautoscaling_target.worker.resource_id
  scalable_dimension = aws_appautoscaling_target.worker.scalable_dimension

  step_scaling_policy_configuration {
    adjustment_type         = "ChangeInCapacity"
    cooldown                = 60
    metric_aggregation_type = "Maximum"

    step_adjustment {
      metric_interval_lower_bound = 0
      scaling_adjustment          = 1
    }
  }
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

# Backlog present → scale out.
resource "aws_cloudwatch_metric_alarm" "backlog" {
  alarm_name          = "${local.name}-worker-backlog"
  alarm_description   = "Jobs waiting in the queue - scale the worker fleet out"
  namespace           = "AWS/SQS"
  metric_name         = "ApproximateNumberOfMessagesVisible"
  dimensions          = { QueueName = aws_sqs_queue.jobs.name }
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 1
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  alarm_actions       = [aws_appautoscaling_policy.scale_out.arn]
}

# Queue drained for 5 min → scale in (to zero).
# NOTE: this watches visible messages only; with a 900s visibility timeout a job
# in flight won't be lost if a task is reaped — SQS redelivers and the transcode
# is idempotent.
resource "aws_cloudwatch_metric_alarm" "idle" {
  alarm_name          = "${local.name}-worker-idle"
  alarm_description   = "Queue drained - scale the worker fleet in (to zero)"
  namespace           = "AWS/SQS"
  metric_name         = "ApproximateNumberOfMessagesVisible"
  dimensions          = { QueueName = aws_sqs_queue.jobs.name }
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 5
  threshold           = 1
  comparison_operator = "LessThanThreshold"
  alarm_actions       = [aws_appautoscaling_policy.scale_in.arn]
}
