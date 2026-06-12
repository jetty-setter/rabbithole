# Speech-to-text pipeline (event-driven).
#
#   worker  --StartTranscriptionJob-->  AWS Transcribe
#                                            | (writes raw JSON to streaming bucket)
#                                            v
#   EventBridge "Transcribe Job State Change" (COMPLETED|FAILED)
#                                            |
#                                            v
#   post-processor Lambda  -->  cues.json + captions.vtt + DynamoDB flag
#
# Transcribe assumes a dedicated data-access role to read the audio it transcribes
# and write its output — the worker never hands Transcribe its own credentials.

# ── Data-access role Transcribe assumes for S3 I/O ─────────────
data "aws_iam_policy_document" "transcribe_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["transcribe.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
  }
}

resource "aws_iam_role" "transcribe" {
  name               = "${local.name}-transcribe"
  assume_role_policy = data.aws_iam_policy_document.transcribe_assume.json
}

resource "aws_iam_role_policy" "transcribe" {
  name = "${local.name}-transcribe"
  role = aws_iam_role.transcribe.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:PutObject"]
        Resource = ["${aws_s3_bucket.streaming.arn}/*"]
      },
    ]
  })
}

# ── Let the worker start jobs and pass the data-access role ────
resource "aws_iam_role_policy" "worker_transcribe" {
  name = "${local.name}-worker-transcribe"
  role = aws_iam_role.worker.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["transcribe:StartTranscriptionJob"]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = ["iam:PassRole"]
        Resource = [aws_iam_role.transcribe.arn]
        Condition = {
          StringEquals = { "iam:PassedToService" = "transcribe.amazonaws.com" }
        }
      },
    ]
  })
}

# ── Post-processor Lambda ──────────────────────────────────────
data "archive_file" "transcribe_post" {
  type        = "zip"
  source_dir  = "${path.module}/../lambdas/transcribe"
  output_path = "${path.module}/build/transcribe.zip"
}

resource "aws_iam_role" "transcribe_post" {
  name               = "${local.name}-transcribe-post"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

resource "aws_iam_role_policy" "transcribe_post" {
  name = "${local.name}-transcribe-post"
  role = aws_iam_role.transcribe_post.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["transcribe:GetTranscriptionJob"]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
        Resource = ["${aws_s3_bucket.streaming.arn}/*"]
      },
      {
        Effect   = "Allow"
        Action   = ["dynamodb:UpdateItem"]
        Resource = [aws_dynamodb_table.videos.arn]
      },
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "*"
      },
    ]
  })
}

resource "aws_lambda_function" "transcribe_post" {
  function_name    = "${local.name}-transcribe-post"
  role             = aws_iam_role.transcribe_post.arn
  runtime          = "python3.12"
  handler          = "handler.handler"
  filename         = data.archive_file.transcribe_post.output_path
  source_code_hash = data.archive_file.transcribe_post.output_base64sha256
  timeout          = 60
  memory_size      = 256

  environment {
    variables = {
      STREAMING_BUCKET = aws_s3_bucket.streaming.bucket
      VIDEOS_TABLE     = aws_dynamodb_table.videos.name
    }
  }
}

# Fire when a Transcribe job finishes (either way — the Lambda branches on status).
resource "aws_cloudwatch_event_rule" "transcribe_done" {
  name        = "${local.name}-transcribe-done"
  description = "Transcribe job completed or failed — post-process the result"
  event_pattern = jsonencode({
    source      = ["aws.transcribe"]
    detail-type = ["Transcribe Job State Change"]
    detail = {
      TranscriptionJobStatus = ["COMPLETED", "FAILED"]
    }
  })
}

resource "aws_cloudwatch_event_target" "transcribe_post" {
  rule      = aws_cloudwatch_event_rule.transcribe_done.name
  target_id = "transcribe-post"
  arn       = aws_lambda_function.transcribe_post.arn
}

resource "aws_lambda_permission" "transcribe_post_events" {
  statement_id  = "AllowEventBridgeTranscribePost"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.transcribe_post.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.transcribe_done.arn
}

output "transcribe_role_arn" {
  value = aws_iam_role.transcribe.arn
}
