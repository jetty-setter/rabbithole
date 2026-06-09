# Video + transcode-job metadata.
resource "aws_dynamodb_table" "videos" {
  name         = "${local.name}-videos"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "video_id"

  attribute {
    name = "video_id"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }

  # Stream powers the real-time status broadcaster (see websocket.tf).
  stream_enabled   = true
  stream_view_type = "NEW_AND_OLD_IMAGES"
}

output "videos_table" {
  value = aws_dynamodb_table.videos.name
}

# Registered user accounts (username + bcrypt password hash).
resource "aws_dynamodb_table" "users" {
  name         = "${local.name}-users"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "username"

  attribute {
    name = "username"
    type = "S"
  }
}

output "users_table" {
  value = aws_dynamodb_table.users.name
}
