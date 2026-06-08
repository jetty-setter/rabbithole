# Transcode job queue + dead-letter queue.
resource "aws_sqs_queue" "jobs_dlq" {
  name                      = "${local.name}-jobs-dlq"
  message_retention_seconds = 1209600 # 14 days
}

resource "aws_sqs_queue" "jobs" {
  name = "${local.name}-jobs"

  # Must exceed worst-case transcode time so a job isn't redelivered mid-flight.
  visibility_timeout_seconds = 900

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.jobs_dlq.arn
    maxReceiveCount     = 3
  })
}

output "jobs_queue_url" {
  value = aws_sqs_queue.jobs.url
}
