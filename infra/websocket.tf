# Real-time status: DynamoDB Stream (videos) → broadcaster Lambda →
# API Gateway WebSocket → browser. Connection IDs live in their own table.

resource "aws_dynamodb_table" "connections" {
  name         = "${local.name}-connections"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "connection_id"

  attribute {
    name = "connection_id"
    type = "S"
  }
}

resource "aws_apigatewayv2_api" "ws" {
  name                       = "${local.name}-ws"
  protocol_type              = "WEBSOCKET"
  route_selection_expression = "$request.body.action"
}

resource "aws_apigatewayv2_stage" "ws" {
  api_id      = aws_apigatewayv2_api.ws.id
  name        = "prod"
  auto_deploy = true
}

# ── Lambda packaging ───────────────────────────────────────

data "archive_file" "connections" {
  type        = "zip"
  source_dir  = "${path.module}/../lambdas/connections"
  output_path = "${path.module}/build/connections.zip"
}

data "archive_file" "broadcaster" {
  type        = "zip"
  source_dir  = "${path.module}/../lambdas/broadcaster"
  output_path = "${path.module}/build/broadcaster.zip"
}

data "aws_iam_policy_document" "lambda_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

# ── $connect / $disconnect Lambda ──────────────────────────

resource "aws_iam_role" "connections" {
  name               = "${local.name}-connections"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

resource "aws_iam_role_policy" "connections" {
  name = "${local.name}-connections"
  role = aws_iam_role.connections.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["dynamodb:PutItem", "dynamodb:DeleteItem"]
        Resource = aws_dynamodb_table.connections.arn
      },
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "*"
      },
    ]
  })
}

resource "aws_lambda_function" "connections" {
  function_name    = "${local.name}-connections"
  role             = aws_iam_role.connections.arn
  runtime          = "python3.12"
  handler          = "handler.handler"
  filename         = data.archive_file.connections.output_path
  source_code_hash = data.archive_file.connections.output_base64sha256

  environment {
    variables = {
      CONNECTIONS_TABLE = aws_dynamodb_table.connections.name
    }
  }
}

resource "aws_apigatewayv2_integration" "connections" {
  api_id           = aws_apigatewayv2_api.ws.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.connections.invoke_arn
}

resource "aws_apigatewayv2_route" "connect" {
  api_id    = aws_apigatewayv2_api.ws.id
  route_key = "$connect"
  target    = "integrations/${aws_apigatewayv2_integration.connections.id}"
}

resource "aws_apigatewayv2_route" "disconnect" {
  api_id    = aws_apigatewayv2_api.ws.id
  route_key = "$disconnect"
  target    = "integrations/${aws_apigatewayv2_integration.connections.id}"
}

resource "aws_lambda_permission" "ws_invoke" {
  statement_id  = "AllowWSInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.connections.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.ws.execution_arn}/*/*"
}

# ── Broadcaster Lambda (DynamoDB stream → WebSocket) ───────

resource "aws_iam_role" "broadcaster" {
  name               = "${local.name}-broadcaster"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

resource "aws_iam_role_policy" "broadcaster" {
  name = "${local.name}-broadcaster"
  role = aws_iam_role.broadcaster.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["dynamodb:Scan", "dynamodb:DeleteItem"]
        Resource = aws_dynamodb_table.connections.arn
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetRecords",
          "dynamodb:GetShardIterator",
          "dynamodb:DescribeStream",
          "dynamodb:ListStreams",
        ]
        Resource = aws_dynamodb_table.videos.stream_arn
      },
      {
        Effect   = "Allow"
        Action   = ["execute-api:ManageConnections"]
        Resource = "${aws_apigatewayv2_api.ws.execution_arn}/*"
      },
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "*"
      },
    ]
  })
}

resource "aws_lambda_function" "broadcaster" {
  function_name    = "${local.name}-broadcaster"
  role             = aws_iam_role.broadcaster.arn
  runtime          = "python3.12"
  handler          = "handler.handler"
  filename         = data.archive_file.broadcaster.output_path
  source_code_hash = data.archive_file.broadcaster.output_base64sha256

  environment {
    variables = {
      CONNECTIONS_TABLE = aws_dynamodb_table.connections.name
      WS_ENDPOINT       = "https://${aws_apigatewayv2_api.ws.id}.execute-api.${var.aws_region}.amazonaws.com/${aws_apigatewayv2_stage.ws.name}"
    }
  }
}

resource "aws_lambda_event_source_mapping" "videos_stream" {
  event_source_arn  = aws_dynamodb_table.videos.stream_arn
  function_name     = aws_lambda_function.broadcaster.arn
  starting_position = "LATEST"
  batch_size        = 10
}

output "websocket_url" {
  value = "wss://${aws_apigatewayv2_api.ws.id}.execute-api.${var.aws_region}.amazonaws.com/${aws_apigatewayv2_stage.ws.name}"
}
