# Event-driven scale-DOWN: the worker-idle alarm (queue empty 5 min) fires an
# EventBridge "Alarm State Change" event -> this Lambda -> release the
# autoscaling floor to 0 and set desiredCount to 0. Pairing this with the
# floor-pinning scaleup Lambda means the worker can ONLY drop to zero when the
# queue is genuinely empty — a stale/laggy metric can never strand a job.

data "archive_file" "scaledown" {
  type        = "zip"
  source_dir  = "${path.module}/../lambdas/scaledown"
  output_path = "${path.module}/build/scaledown.zip"
}

resource "aws_iam_role" "scaledown" {
  name               = "${local.name}-scaledown"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

resource "aws_iam_role_policy" "scaledown" {
  name = "${local.name}-scaledown"
  role = aws_iam_role.scaledown.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ecs:UpdateService", "ecs:DescribeServices",
          "application-autoscaling:RegisterScalableTarget",
          "application-autoscaling:DescribeScalableTargets",
        ]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "*"
      },
    ]
  })
}

resource "aws_lambda_function" "scaledown" {
  function_name    = "${local.name}-scaledown"
  role             = aws_iam_role.scaledown.arn
  runtime          = "python3.12"
  handler          = "handler.handler"
  filename         = data.archive_file.scaledown.output_path
  source_code_hash = data.archive_file.scaledown.output_base64sha256
  timeout          = 15

  environment {
    variables = {
      CLUSTER      = aws_ecs_cluster.main.name
      SERVICE      = aws_ecs_service.worker.name
      MAX_CAPACITY = tostring(var.worker_max_count)
    }
  }
}

# Fire when the idle alarm transitions INTO the ALARM state (queue empty 5 min).
resource "aws_cloudwatch_event_rule" "worker_idle" {
  name        = "${local.name}-worker-idle"
  description = "Worker idle alarm went off — scale the worker to zero"
  event_pattern = jsonencode({
    source      = ["aws.cloudwatch"]
    detail-type = ["CloudWatch Alarm State Change"]
    resources   = [aws_cloudwatch_metric_alarm.idle.arn]
    detail = {
      state = { value = ["ALARM"] }
    }
  })
}

resource "aws_cloudwatch_event_target" "scaledown" {
  rule      = aws_cloudwatch_event_rule.worker_idle.name
  target_id = "scaledown"
  arn       = aws_lambda_function.scaledown.arn
}

resource "aws_lambda_permission" "scaledown_events" {
  statement_id  = "AllowEventBridgeScaledown"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.scaledown.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.worker_idle.arn
}
