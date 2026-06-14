terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # Remote state: versioned/encrypted S3 with native S3 state locking
  # (use_lockfile, Terraform >= 1.10 — no DynamoDB table needed). Bootstrapped
  # out-of-band since a backend can't manage the bucket it lives in. No `profile`
  # here — creds come from the environment (local AWS_PROFILE, or OIDC in CI).
  backend "s3" {
    bucket       = "rabbithole-dev-tfstate-936922781601"
    key          = "rabbithole-dev/terraform.tfstate"
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project   = "rabbithole"
      ManagedBy = "terraform"
    }
  }
}
