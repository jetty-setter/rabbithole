#!/usr/bin/env bash
# Build the worker image and push it to ECR. Run after `terraform apply`.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
region="${AWS_REGION:-us-east-1}"

repo_url="$(cd "$here/../infra" && terraform output -raw worker_ecr_repo)"
registry="${repo_url%%/*}"

aws ecr get-login-password --region "$region" \
  | docker login --username AWS --password-stdin "$registry"

docker build -t "$repo_url:latest" "$here/../worker"
docker push "$repo_url:latest"

echo "pushed $repo_url:latest"
echo "force a new deployment to pick it up:"
echo "  aws ecs update-service --cluster rabbithole-dev --service rabbithole-dev-worker --force-new-deployment --region $region"
