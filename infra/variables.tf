variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "us-east-1"
}

variable "project" {
  description = "Project name prefix for resources"
  type        = string
  default     = "rabbithole"
}

variable "environment" {
  description = "Deployment environment (dev/prod)"
  type        = string
  default     = "dev"
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "worker_cpu" {
  description = "Fargate task CPU units (256/512/1024/...)"
  type        = string
  default     = "512"
}

variable "worker_memory" {
  description = "Fargate task memory (MiB)"
  type        = string
  default     = "1024"
}

variable "worker_desired_count" {
  description = "Initial worker task count. Autoscaling manages it thereafter (min 0)."
  type        = number
  default     = 0
}

variable "worker_max_count" {
  description = "Maximum worker tasks the autoscaler may run."
  type        = number
  default     = 4
}
