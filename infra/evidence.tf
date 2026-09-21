# A published article is the durable outbox: stream -> dispatcher -> SQS -> worker.
# No network call is added to the publish request. Each source fails independently.
data "archive_file" "evidence" {
  type        = "zip"
  output_path = "${path.module}/build/evidence.zip"
  source {
    content  = file("${path.module}/../lambdas/evidence/evidence_handler.py")
    filename = "evidence_handler.py"
  }
  source {
    content  = file("${path.module}/../lambdas/evidence/evidence_fetch.py")
    filename = "evidence_fetch.py"
  }
}

resource "aws_s3_bucket" "evidence" {
  bucket = "${local.name}-evidence-${local.bucket_suffix}"
}
resource "aws_s3_bucket_public_access_block" "evidence" {
  bucket                  = aws_s3_bucket.evidence.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
resource "aws_s3_bucket_server_side_encryption_configuration" "evidence" {
  bucket = aws_s3_bucket.evidence.id
  rule {
    apply_server_side_encryption_by_default { sse_algorithm = "AES256" }
  }
}
resource "aws_s3_bucket_lifecycle_configuration" "evidence" {
  bucket = aws_s3_bucket.evidence.id
  rule {
    id     = "expire-snapshots"
    status = "Enabled"
    filter {}
    expiration { days = 90 }
  }
}

resource "aws_sqs_queue" "evidence_dead" {
  name                      = "${local.name}-evidence-dead"
  message_retention_seconds = 1209600
  sqs_managed_sse_enabled   = true
}
resource "aws_sqs_queue" "evidence_jobs" {
  name                       = "${local.name}-evidence-jobs"
  visibility_timeout_seconds = 540
  message_retention_seconds  = 345600
  sqs_managed_sse_enabled    = true
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.evidence_dead.arn
    maxReceiveCount     = 3
  })
}

resource "aws_iam_role" "evidence" {
  for_each           = toset(["dispatch", "worker"])
  name               = "${local.name}-evidence-${each.key}"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}
resource "aws_iam_role_policy" "evidence_dispatch" {
  role = aws_iam_role.evidence["dispatch"].id
  policy = jsonencode({ Version = "2012-10-17", Statement = [
    { Effect = "Allow", Action = ["dynamodb:DescribeStream", "dynamodb:GetRecords", "dynamodb:GetShardIterator", "dynamodb:ListStreams"], Resource = aws_dynamodb_table.rabbitholes.stream_arn },
    { Effect = "Allow", Action = ["dynamodb:PutItem"], Resource = aws_dynamodb_table.evidence.arn },
    { Effect = "Allow", Action = ["sqs:SendMessage"], Resource = [aws_sqs_queue.evidence_jobs.arn, aws_sqs_queue.evidence_dead.arn] }
  ] })
}
resource "aws_iam_role_policy" "evidence_worker" {
  role = aws_iam_role.evidence["worker"].id
  policy = jsonencode({ Version = "2012-10-17", Statement = [
    { Effect = "Allow", Action = ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"], Resource = aws_sqs_queue.evidence_jobs.arn },
    { Effect = "Allow", Action = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem"], Resource = aws_dynamodb_table.evidence.arn },
    { Effect = "Allow", Action = ["s3:PutObject"], Resource = "${aws_s3_bucket.evidence.arn}/*" }
  ] })
}
resource "aws_iam_role_policy" "evidence_api" {
  role = aws_iam_role.api.id
  policy = jsonencode({ Version = "2012-10-17", Statement = [
    { Effect = "Allow", Action = ["dynamodb:Query"], Resource = aws_dynamodb_table.evidence.arn }
  ] })
}
resource "aws_cloudwatch_log_group" "evidence" {
  for_each          = toset(["dispatch", "worker"])
  name              = "/aws/lambda/${local.name}-evidence-${each.key}"
  retention_in_days = 14
}
resource "aws_iam_role_policy" "evidence_logs" {
  for_each = toset(["dispatch", "worker"])
  role     = aws_iam_role.evidence[each.key].id
  policy = jsonencode({ Version = "2012-10-17", Statement = [
    { Effect = "Allow", Action = ["logs:CreateLogStream", "logs:PutLogEvents"], Resource = "${aws_cloudwatch_log_group.evidence[each.key].arn}:*" }
  ] })
}
resource "aws_lambda_function" "evidence" {
  for_each                       = toset(["dispatch", "worker"])
  function_name                  = "${local.name}-evidence-${each.key}"
  role                           = aws_iam_role.evidence[each.key].arn
  runtime                        = "python3.12"
  handler                        = "evidence_handler.${each.key}"
  filename                       = data.archive_file.evidence.output_path
  source_code_hash               = data.archive_file.evidence.output_base64sha256
  timeout                        = 90
  memory_size                    = 256
  reserved_concurrent_executions = each.key == "worker" ? 4 : 2
  environment {
    variables = {
      EVIDENCE_TABLE     = aws_dynamodb_table.evidence.name
      EVIDENCE_QUEUE_URL = aws_sqs_queue.evidence_jobs.url
      EVIDENCE_BUCKET    = aws_s3_bucket.evidence.id
    }
  }
  depends_on = [aws_iam_role_policy.evidence_dispatch, aws_iam_role_policy.evidence_worker, aws_iam_role_policy.evidence_logs]
}
resource "aws_lambda_event_source_mapping" "evidence_dispatch" {
  event_source_arn               = aws_dynamodb_table.rabbitholes.stream_arn
  function_name                  = aws_lambda_function.evidence["dispatch"].arn
  starting_position              = "TRIM_HORIZON"
  batch_size                     = 1
  maximum_retry_attempts         = 3
  maximum_record_age_in_seconds  = 86400
  bisect_batch_on_function_error = true
  function_response_types        = ["ReportBatchItemFailures"]
  destination_config {
    on_failure { destination_arn = aws_sqs_queue.evidence_dead.arn }
  }
  filter_criteria {
    filter {
      pattern = jsonencode({ dynamodb = { NewImage = { status = { S = ["published"] } } } })
    }
  }
}
resource "aws_lambda_event_source_mapping" "evidence_worker" {
  event_source_arn        = aws_sqs_queue.evidence_jobs.arn
  function_name           = aws_lambda_function.evidence["worker"].arn
  batch_size              = 1
  function_response_types = ["ReportBatchItemFailures"]
  scaling_config { maximum_concurrency = 4 }
}
resource "aws_cloudwatch_metric_alarm" "evidence_dead" {
  alarm_name          = "${local.name}-evidence-dead"
  alarm_description   = "Evidence jobs require investigation; see the evidence runbook."
  namespace           = "AWS/SQS"
  metric_name         = "ApproximateNumberOfMessagesVisible"
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 1
  comparison_operator = "GreaterThanThreshold"
  threshold           = 0
  treat_missing_data  = "notBreaching"
  dimensions          = { QueueName = aws_sqs_queue.evidence_dead.name }
}
