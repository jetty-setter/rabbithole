# Continuous deployment: GitHub Actions assumes this role via OIDC (no long-lived
# AWS keys in the repo) to ship application artifacts on a push to main —
# container images, the API Lambda, the worker service, and the frontend.
#
# Infrastructure itself is still applied manually (`terraform apply`) because the
# state is local; migrating to a remote S3 backend is the prerequisite for
# automating infra changes too.

locals {
  github_repo = "jetty-setter/rabbithole"
}

resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  # GitHub's OIDC root CA thumbprints (AWS no longer verifies these, but the
  # argument is still required).
  thumbprint_list = [
    "6938fd4d98bab03faadb97b34396831e3780aea1",
    "1c58a3a8518e8759bf075b76b750d4f2df264fcd",
  ]
}

data "aws_iam_policy_document" "deploy_assume" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    # Only the main branch of this exact repo can assume the role.
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${local.github_repo}:ref:refs/heads/main"]
    }
  }
}

resource "aws_iam_role" "deploy" {
  name               = "${local.name}-deploy"
  assume_role_policy = data.aws_iam_policy_document.deploy_assume.json
}

data "aws_iam_policy_document" "deploy" {
  # Push images to ECR.
  statement {
    sid       = "EcrAuth"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }
  statement {
    sid = "EcrPush"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:InitiateLayerUpload",
      "ecr:UploadLayerPart",
      "ecr:CompleteLayerUpload",
      "ecr:PutImage",
      "ecr:BatchGetImage",
    ]
    resources = [aws_ecr_repository.api.arn, aws_ecr_repository.worker.arn]
  }

  # Roll out the new API image.
  statement {
    sid       = "LambdaDeploy"
    actions   = ["lambda:UpdateFunctionCode", "lambda:GetFunction"]
    resources = [aws_lambda_function.api.arn]
  }

  # Roll out the new worker image.
  statement {
    sid       = "EcsDeploy"
    actions   = ["ecs:UpdateService", "ecs:DescribeServices"]
    resources = [aws_ecs_service.worker.id]
  }

  # Publish the frontend + bust the CDN cache.
  statement {
    sid       = "FrontendS3"
    actions   = ["s3:PutObject", "s3:DeleteObject", "s3:GetObject", "s3:ListBucket"]
    resources = [aws_s3_bucket.frontend.arn, "${aws_s3_bucket.frontend.arn}/*"]
  }
  statement {
    sid       = "CdnInvalidate"
    actions   = ["cloudfront:CreateInvalidation"]
    resources = [aws_cloudfront_distribution.frontend.arn]
  }
}

resource "aws_iam_role_policy" "deploy" {
  name   = "${local.name}-deploy"
  role   = aws_iam_role.deploy.id
  policy = data.aws_iam_policy_document.deploy.json
}

output "deploy_role_arn" {
  value = aws_iam_role.deploy.arn
}
