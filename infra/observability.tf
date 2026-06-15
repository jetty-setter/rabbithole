# Operations dashboard: pipeline health, worker + serverless metrics, and a
# FinOps row driven by the worker's custom transcode-cost metrics.

resource "aws_cloudwatch_dashboard" "ops" {
  dashboard_name = "${local.name}-ops"

  dashboard_body = jsonencode({
    widgets = [
      # ── Row 1: pipeline ────────────────────────────────────
      {
        type = "metric", x = 0, y = 0, width = 12, height = 6,
        properties = {
          title  = "Transcode queue depth"
          view   = "timeSeries"
          region = var.aws_region
          stat   = "Maximum"
          period = 60
          metrics = [
            ["AWS/SQS", "ApproximateNumberOfMessagesVisible", "QueueName", aws_sqs_queue.jobs.name, { label = "Visible" }],
            ["AWS/SQS", "ApproximateNumberOfMessagesNotVisible", "QueueName", aws_sqs_queue.jobs.name, { label = "In flight" }],
          ]
        }
      },
      {
        type = "metric", x = 12, y = 0, width = 6, height = 6,
        properties = {
          title   = "Oldest job age (s)"
          view    = "timeSeries"
          region  = var.aws_region
          stat    = "Maximum"
          period  = 60
          metrics = [["AWS/SQS", "ApproximateAgeOfOldestMessage", "QueueName", aws_sqs_queue.jobs.name]]
        }
      },
      {
        type = "metric", x = 18, y = 0, width = 6, height = 6,
        properties = {
          title   = "Dead-letter queue"
          view    = "singleValue"
          region  = var.aws_region
          stat    = "Maximum"
          period  = 300
          metrics = [["AWS/SQS", "ApproximateNumberOfMessagesVisible", "QueueName", aws_sqs_queue.jobs_dlq.name, { label = "DLQ messages" }]]
        }
      },

      # ── Row 2: worker + API ────────────────────────────────
      {
        type = "metric", x = 0, y = 6, width = 12, height = 6,
        properties = {
          title  = "Worker CPU / memory"
          view   = "timeSeries"
          region = var.aws_region
          stat   = "Average"
          period = 60
          metrics = [
            ["AWS/ECS", "CPUUtilization", "ClusterName", aws_ecs_cluster.main.name, "ServiceName", aws_ecs_service.worker.name, { label = "CPU %" }],
            ["AWS/ECS", "MemoryUtilization", "ClusterName", aws_ecs_cluster.main.name, "ServiceName", aws_ecs_service.worker.name, { label = "Mem %" }],
          ]
        }
      },
      {
        type = "metric", x = 12, y = 6, width = 12, height = 6,
        properties = {
          title  = "API — invocations & errors"
          view   = "timeSeries"
          region = var.aws_region
          stat   = "Sum"
          period = 300
          metrics = [
            ["AWS/Lambda", "Invocations", "FunctionName", aws_lambda_function.api.function_name, { label = "Invocations" }],
            ["AWS/Lambda", "Errors", "FunctionName", aws_lambda_function.api.function_name, { label = "Errors", color = "#d62728" }],
          ]
        }
      },

      # ── Row 3: latency + error counters ────────────────────
      {
        type = "metric", x = 0, y = 12, width = 12, height = 6,
        properties = {
          title   = "API latency p95 (ms)"
          view    = "timeSeries"
          region  = var.aws_region
          stat    = "p95"
          period  = 300
          metrics = [["AWS/Lambda", "Duration", "FunctionName", aws_lambda_function.api.function_name]]
        }
      },
      {
        type = "metric", x = 12, y = 12, width = 6, height = 6,
        properties = {
          title   = "API throttles"
          view    = "singleValue"
          region  = var.aws_region
          stat    = "Sum"
          period  = 300
          metrics = [["AWS/Lambda", "Throttles", "FunctionName", aws_lambda_function.api.function_name]]
        }
      },
      {
        type = "metric", x = 18, y = 12, width = 6, height = 6,
        properties = {
          title   = "Transcribe Lambda errors"
          view    = "singleValue"
          region  = var.aws_region
          stat    = "Sum"
          period  = 300
          metrics = [["AWS/Lambda", "Errors", "FunctionName", aws_lambda_function.transcribe_post.function_name]]
        }
      },

      # ── Row 4: FinOps (custom transcode metrics) ───────────
      {
        type = "metric", x = 0, y = 18, width = 4, height = 6,
        properties = {
          title   = "Transcodes"
          view    = "singleValue"
          region  = var.aws_region
          stat    = "Sum"
          period  = 86400
          metrics = [["RabbitHole/Transcode", "TranscodeCount"]]
        }
      },
      {
        type = "metric", x = 4, y = 18, width = 4, height = 6,
        properties = {
          title   = "Transcode spend (USD)"
          view    = "singleValue"
          region  = var.aws_region
          stat    = "Sum"
          period  = 86400
          metrics = [["RabbitHole/Transcode", "TranscodeCostUSD"]]
        }
      },
      {
        type = "metric", x = 8, y = 18, width = 4, height = 6,
        properties = {
          title   = "Avg transcode (s)"
          view    = "singleValue"
          region  = var.aws_region
          stat    = "Average"
          period  = 86400
          metrics = [["RabbitHole/Transcode", "TranscodeSeconds"]]
        }
      },
      {
        type = "metric", x = 12, y = 18, width = 12, height = 6,
        properties = {
          title   = "Transcode spend over time"
          view    = "timeSeries"
          region  = var.aws_region
          stat    = "Sum"
          period  = 300
          metrics = [["RabbitHole/Transcode", "TranscodeCostUSD", { label = "USD" }]]
        }
      },
    ]
  })
}

output "dashboard_url" {
  value = "https://${var.aws_region}.console.aws.amazon.com/cloudwatch/home?region=${var.aws_region}#dashboards/dashboard/${aws_cloudwatch_dashboard.ops.dashboard_name}"
}
