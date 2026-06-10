resource "aws_ecs_cluster" "main" {
  name = local.name
}

# Anthropic API key for AI auto-metadata. Stored out-of-band as an SSM
# SecureString (so the secret never lands in Terraform state); injected into
# the worker at runtime. Create it once with:
#   aws ssm put-parameter --name /rabbithole-dev/anthropic-api-key \
#     --type SecureString --value 'sk-ant-...' --profile rabbithole
locals {
  anthropic_key_param = "/${local.name}/anthropic-api-key"
  anthropic_key_arn   = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter${local.anthropic_key_param}"
}

resource "aws_cloudwatch_log_group" "worker" {
  name              = "/ecs/${local.name}-worker"
  retention_in_days = 14
}

# Egress-only: nothing can reach the worker; it only makes outbound calls.
resource "aws_security_group" "worker" {
  name        = "${local.name}-worker"
  description = "RabbitHole worker - egress only, no inbound"
  vpc_id      = aws_vpc.main.id

  egress {
    description = "All outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${local.name}-worker" }
}

resource "aws_ecs_task_definition" "worker" {
  family                   = "${local.name}-worker"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.worker_cpu
  memory                   = var.worker_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.worker.arn

  # Graviton/ARM64 — matches local Apple-silicon builds and is ~20% cheaper.
  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "ARM64"
  }

  container_definitions = jsonencode([
    {
      name      = "worker"
      image     = "${aws_ecr_repository.worker.repository_url}:latest"
      essential = true

      environment = [
        { name = "JOB_QUEUE_URL", value = aws_sqs_queue.jobs.url },
        { name = "STREAMING_BUCKET", value = aws_s3_bucket.streaming.bucket },
        { name = "VIDEOS_TABLE", value = aws_dynamodb_table.videos.name },
        { name = "AWS_REGION", value = var.aws_region },
        { name = "FARGATE_CPU_UNITS", value = var.worker_cpu },
        { name = "FARGATE_MEMORY_MIB", value = var.worker_memory },
        { name = "PYTHONUNBUFFERED", value = "1" },
        { name = "AI_MODEL", value = var.ai_model },
      ]

      # Injected from SSM at task start (never stored in the task def or state).
      secrets = [
        { name = "ANTHROPIC_API_KEY", valueFrom = local.anthropic_key_arn },
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.worker.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "worker"
        }
      }
    }
  ])
}

resource "aws_ecs_service" "worker" {
  name            = "${local.name}-worker"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.worker.arn
  desired_count   = var.worker_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.public[*].id
    security_groups  = [aws_security_group.worker.id]
    assign_public_ip = true # required in public subnets to pull from ECR
  }

  # Application Auto Scaling owns the task count after creation (see autoscaling.tf).
  lifecycle {
    ignore_changes = [desired_count]
  }
}
