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
  # The app is served from a custom domain (managed on the frontend distribution)
  # and the default CloudFront domain; both are valid browser origins for CORS.
  frontend_custom_domain = "rabbithole.stephsimmons.dev"
  frontend_acm_cert_arn  = "arn:aws:acm:us-east-1:936922781601:certificate/37dec03b-9b1d-44f7-b099-4993542d302c"
  frontend_origins = [
    "https://${local.frontend_custom_domain}",
    "https://${aws_cloudfront_distribution.frontend.domain_name}",
  ]
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
    # Scoped to the deployed frontend(s) + local dev — no longer a wildcard.
    allowed_origins = concat(local.frontend_origins, ["http://localhost:5173"])
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
