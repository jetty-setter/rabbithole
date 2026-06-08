# Least-privilege policy for the API (used locally now, attached to the
# Lambda execution role when the API is deployed serverless).
data "aws_iam_policy_document" "api" {
  statement {
    sid       = "PresignUploads"
    actions   = ["s3:PutObject"]
    resources = ["${aws_s3_bucket.uploads.arn}/uploads/*"]
  }

  statement {
    sid = "VideosTable"
    actions = [
      "dynamodb:PutItem",
      "dynamodb:GetItem",
      "dynamodb:Scan",
    ]
    resources = [aws_dynamodb_table.videos.arn]
  }
}

resource "aws_iam_policy" "api" {
  name   = "${local.name}-api"
  policy = data.aws_iam_policy_document.api.json
}

output "api_policy_arn" {
  value = aws_iam_policy.api.arn
}

# ── ECS roles ──────────────────────────────────────────────

data "aws_iam_policy_document" "ecs_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

# Execution role: lets ECS pull the image and ship logs.
resource "aws_iam_role" "ecs_execution" {
  name               = "${local.name}-ecs-exec"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Task role: the worker's own least-privilege app permissions.
data "aws_iam_policy_document" "worker" {
  statement {
    sid       = "ReadUploads"
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.uploads.arn}/*"]
  }

  statement {
    sid       = "WriteStreaming"
    actions   = ["s3:PutObject"]
    resources = ["${aws_s3_bucket.streaming.arn}/*"]
  }

  statement {
    sid       = "ConsumeJobs"
    actions   = ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"]
    resources = [aws_sqs_queue.jobs.arn]
  }

  statement {
    sid       = "UpdateStatus"
    actions   = ["dynamodb:UpdateItem", "dynamodb:GetItem"]
    resources = [aws_dynamodb_table.videos.arn]
  }
}

resource "aws_iam_role" "worker" {
  name               = "${local.name}-worker"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

resource "aws_iam_role_policy" "worker" {
  name   = "${local.name}-worker"
  role   = aws_iam_role.worker.id
  policy = data.aws_iam_policy_document.worker.json
}
