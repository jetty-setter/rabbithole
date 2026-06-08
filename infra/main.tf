# RabbitHole infrastructure (Terraform)
#
# P0: skeleton — storage buckets only, so `terraform validate`/`plan` work in CI.
# Subsequent phases add: DynamoDB (P1), SQS+DLQ+EventBridge (P2), ECS Fargate
# service + autoscaling (P2/P4), Lambda+API Gateway (P1), CloudFront (P3),
# CloudWatch dashboards/alarms (P5).

data "aws_caller_identity" "current" {}

locals {
  name = "${var.project}-${var.environment}"
  # S3 bucket names are globally unique; suffix with the account ID.
  bucket_suffix = data.aws_caller_identity.current.account_id
}

# Raw uploads land here (presigned PUT from the browser).
resource "aws_s3_bucket" "uploads" {
  bucket = "${local.name}-uploads-${local.bucket_suffix}"
}

# Transcoded HLS renditions + thumbnails; fronted by CloudFront (P3).
resource "aws_s3_bucket" "streaming" {
  bucket = "${local.name}-streaming-${local.bucket_suffix}"
}

resource "aws_s3_bucket_public_access_block" "uploads" {
  bucket                  = aws_s3_bucket.uploads.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_public_access_block" "streaming" {
  bucket                  = aws_s3_bucket.streaming.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# CORS so the browser can PUT directly to the uploads bucket (P1).
resource "aws_s3_bucket_cors_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  cors_rule {
    allowed_methods = ["PUT", "GET"]
    allowed_origins = ["*"] # tighten to the frontend origin before prod
    allowed_headers = ["*"]
    max_age_seconds = 3000
  }
}

output "uploads_bucket" {
  value = aws_s3_bucket.uploads.bucket
}

output "streaming_bucket" {
  value = aws_s3_bucket.streaming.bucket
}
