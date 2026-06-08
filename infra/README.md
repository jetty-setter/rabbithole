# Infrastructure (Terraform)

All AWS resources for RabbitHole, as code.

## Usage
```bash
cd infra
terraform init
terraform plan
terraform apply
```

## State
P0 uses local state. Before CI/shared use, uncomment the S3 backend in `versions.tf`
and create the state bucket + lock table.

## What's here by phase
- **P0** — S3 uploads + streaming buckets (this skeleton)
- **P1** — DynamoDB table, Lambda + API Gateway, IAM
- **P2** — SQS + DLQ, EventBridge rule, ECS cluster + Fargate task/service
- **P3** — CloudFront distribution in front of the streaming bucket
- **P4** — application autoscaling on SQS queue depth
- **P5** — CloudWatch dashboard + alarms
