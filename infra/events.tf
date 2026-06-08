# S3 ObjectCreated → EventBridge → SQS.
#
# EventBridge (vs. a direct S3→SQS notification) keeps the event routing
# decoupled and filterable — easy to fan out to more targets later.

resource "aws_s3_bucket_notification" "uploads" {
  bucket      = aws_s3_bucket.uploads.id
  eventbridge = true
}

resource "aws_cloudwatch_event_rule" "object_created" {
  name        = "${local.name}-object-created"
  description = "New upload landed in the uploads bucket"

  event_pattern = jsonencode({
    source        = ["aws.s3"]
    "detail-type" = ["Object Created"]
    detail = {
      bucket = { name = [aws_s3_bucket.uploads.id] }
    }
  })
}

resource "aws_cloudwatch_event_target" "to_sqs" {
  rule = aws_cloudwatch_event_rule.object_created.name
  arn  = aws_sqs_queue.jobs.arn
}

# Allow EventBridge to deliver to the queue.
data "aws_iam_policy_document" "jobs_queue" {
  statement {
    sid     = "AllowEventBridge"
    effect  = "Allow"
    actions = ["sqs:SendMessage"]

    principals {
      type        = "Service"
      identifiers = ["events.amazonaws.com"]
    }

    resources = [aws_sqs_queue.jobs.arn]

    condition {
      test     = "ArnEquals"
      variable = "aws:SourceArn"
      values   = [aws_cloudwatch_event_rule.object_created.arn]
    }
  }
}

resource "aws_sqs_queue_policy" "jobs" {
  queue_url = aws_sqs_queue.jobs.id
  policy    = data.aws_iam_policy_document.jobs_queue.json
}
