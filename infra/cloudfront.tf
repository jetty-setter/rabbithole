# CloudFront in front of the (private) streaming bucket, using Origin Access
# Control so the bucket itself stays locked down — only CloudFront can read it.

data "aws_cloudfront_cache_policy" "optimized" {
  name = "Managed-CachingOptimized"
}

# Adds ACAO: * to responses that include an Origin request header.
# Safari native HLS workaround is in Player.tsx (captions fetched as blob URL
# so crossOrigin="anonymous" is not set on the <video> element in Safari).
resource "aws_cloudfront_response_headers_policy" "cors" {
  name = "${local.name}-unconditional-cors"

  cors_config {
    access_control_allow_credentials = false
    origin_override                  = true

    access_control_allow_headers {
      items = ["*"]
    }
    access_control_allow_methods {
      items = ["GET", "HEAD", "OPTIONS"]
    }
    access_control_allow_origins {
      items = ["*"]
    }
  }
}

resource "aws_cloudfront_origin_access_control" "streaming" {
  name                              = "${local.name}-streaming"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "streaming" {
  enabled     = true
  comment     = "${local.name} HLS streaming"
  price_class = "PriceClass_100" # NA + EU edges only — cheapest

  origin {
    domain_name              = aws_s3_bucket.streaming.bucket_regional_domain_name
    origin_id                = "streaming-s3"
    origin_access_control_id = aws_cloudfront_origin_access_control.streaming.id
  }

  default_cache_behavior {
    target_origin_id           = "streaming-s3"
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD", "OPTIONS"]
    cached_methods             = ["GET", "HEAD"]
    compress                   = true
    cache_policy_id            = data.aws_cloudfront_cache_policy.optimized.id
    response_headers_policy_id = aws_cloudfront_response_headers_policy.cors.id
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}

# Bucket policy: allow only this CloudFront distribution to read objects.
data "aws_iam_policy_document" "streaming_cf" {
  statement {
    sid       = "AllowCloudFrontRead"
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.streaming.arn}/*"]

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.streaming.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "streaming" {
  bucket = aws_s3_bucket.streaming.id
  policy = data.aws_iam_policy_document.streaming_cf.json
}

output "cloudfront_domain" {
  value = aws_cloudfront_distribution.streaming.domain_name
}
