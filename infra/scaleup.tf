# Event-driven worker wake-up: S3 upload -> EventBridge -> this Lambda -> set the
# worker service desiredCount to 1 immediately. Replaces the unreliable
# SQS-metric scale-out alarm (SQS only emits metrics every 5 min).

data "archive_file" "scaleup" {
  type        = "zip"
  source_dir  = "${path.module}/../lambdas/scaleup"
  output_path = "${path.module}/build/scaleup.zip"
}

resource "aws_iam_role" "scaleup" {
  name               = "${local.name}-scaleup"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

resource "aws_iam_role_policy" "scaleup" {
  name = "${local.name}-scaleup"
  role = aws_iam_role.scaleup.id
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

resource "aws_lambda_function" "scaleup" {
  function_name    = "${local.name}-scaleup"
  role             = aws_iam_role.scaleup.arn
  runtime          = "python3.12"
  handler          = "handler.handler"
  filename         = data.archive_file.scaleup.output_path
  source_code_hash = data.archive_file.scaleup.output_base64sha256
  timeout          = 15

  environment {
    variables = {
      CLUSTER      = aws_ecs_cluster.main.name
      SERVICE      = aws_ecs_service.worker.name
      MAX_CAPACITY = tostring(var.worker_max_count)
    }
  }
}

# Add the Lambda as a second target on the existing "object created" rule
# (the first target is the SQS job queue).
resource "aws_cloudwatch_event_target" "scaleup" {
  rule      = aws_cloudwatch_event_rule.object_created.name
  target_id = "scaleup"
  arn       = aws_lambda_function.scaleup.arn
}

resource "aws_lambda_permission" "scaleup_events" {
  statement_id  = "AllowEventBridgeScaleup"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.scaleup.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.object_created.arn
}
