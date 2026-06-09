# Public REST API: FastAPI as a container-image Lambda behind API Gateway (HTTP API).

resource "aws_ecr_repository" "api" {
  name                 = "${local.name}-api"
  image_tag_mutability = "MUTABLE"
  force_delete         = true
}

# Per-deploy JWT signing secret (not committed anywhere).
resource "random_password" "jwt" {
  length  = 48
  special = false
}

# ── Lambda role ────────────────────────────────────────────

resource "aws_iam_role" "api" {
  name               = "${local.name}-api-lambda"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

resource "aws_iam_role_policy" "api_lambda" {
  name = "${local.name}-api-lambda"
  role = aws_iam_role.api.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = ["s3:PutObject", "s3:GetObject", "s3:DeleteObject", "s3:ListBucket"]
        Resource = [
          aws_s3_bucket.uploads.arn, "${aws_s3_bucket.uploads.arn}/*",
          aws_s3_bucket.streaming.arn, "${aws_s3_bucket.streaming.arn}/*",
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem",
          "dynamodb:DeleteItem", "dynamodb:Scan", "dynamodb:Query",
          "dynamodb:BatchWriteItem",
        ]
        Resource = [
          aws_dynamodb_table.videos.arn,
          aws_dynamodb_table.users.arn,
          aws_dynamodb_table.comments.arn,
        ]
      },
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "*"
      },
    ]
  })
}

# ── Lambda (container image) ───────────────────────────────

resource "aws_lambda_function" "api" {
  function_name = "${local.name}-api"
  role          = aws_iam_role.api.arn
  package_type  = "Image"
  image_uri     = "${aws_ecr_repository.api.repository_url}:latest"
  architectures = ["arm64"]
  timeout       = 30
  memory_size   = 512

  environment {
    variables = {
      UPLOADS_BUCKET         = aws_s3_bucket.uploads.bucket
      STREAMING_BUCKET       = aws_s3_bucket.streaming.bucket
      VIDEOS_TABLE           = aws_dynamodb_table.videos.name
      USERS_TABLE            = aws_dynamodb_table.users.name
      COMMENTS_TABLE         = aws_dynamodb_table.comments.name
      CLOUDFRONT_DOMAIN      = aws_cloudfront_distribution.streaming.domain_name
      CREATOR_USERNAME       = "admin"
      JWT_SECRET             = random_password.jwt.result
      ALLOWED_ORIGINS        = "*"
      PRESIGN_EXPIRY_SECONDS = "900"
    }
  }
}

# ── HTTP API Gateway → Lambda (FastAPI handles CORS itself) ─

resource "aws_apigatewayv2_api" "http" {
  name          = "${local.name}-http"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_integration" "api" {
  api_id                 = aws_apigatewayv2_api.http.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.api.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "api" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "$default"
  target    = "integrations/${aws_apigatewayv2_integration.api.id}"
}

resource "aws_apigatewayv2_stage" "api" {
  api_id      = aws_apigatewayv2_api.http.id
  name        = "$default"
  auto_deploy = true
}

resource "aws_lambda_permission" "api_gw" {
  statement_id  = "AllowHTTPApi"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*/*"
}

output "api_url" {
  value = aws_apigatewayv2_stage.api.invoke_url
}

output "api_ecr_repo" {
  value = aws_ecr_repository.api.repository_url
}
