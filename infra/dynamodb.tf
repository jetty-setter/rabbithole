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

# Comments, one row per comment, partitioned by video.
# comment_id is timestamp-prefixed so a Query returns them in time order.
resource "aws_dynamodb_table" "comments" {
  name         = "${local.name}-comments"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "video_id"
  range_key    = "comment_id"

  attribute {
    name = "video_id"
    type = "S"
  }

  attribute {
    name = "comment_id"
    type = "S"
  }
}

output "comments_table" {
  value = aws_dynamodb_table.comments.name
}

# Transcript-chunk embeddings for cross-video semantic search. One row per
# passage: partitioned by video (so a video's chunks Query/delete together),
# sorted by chunk index. The vector is a base64 float32 blob.
resource "aws_dynamodb_table" "embeddings" {
  name         = "${local.name}-embeddings"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "video_id"
  range_key    = "chunk"

  attribute {
    name = "video_id"
    type = "S"
  }

  attribute {
    name = "chunk"
    type = "S"
  }
}

output "embeddings_table" {
  value = aws_dynamodb_table.embeddings.name
}

# Curated Topic/Concept entities -- the semantic layer above raw video tags.
# `slug` is the natural key: it's
# what the API and frontend already address a topic by (/topics/{slug}),
# so there's no separate UUID indirection to look up first.
resource "aws_dynamodb_table" "topics" {
  name         = "${local.name}-topics"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "slug"

  attribute {
    name = "slug"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }
}

output "topics_table" {
  value = aws_dynamodb_table.topics.name
}

# First-class relationships between two Topics (relationship_type + a short
# "why this connects" explanation) -- what Map reads instead of only ever
# deriving an edge from tag co-occurrence. Keyed by the natural pair
# (from_topic, to_topic), so a re-run of the seed script overwrites the same
# row rather than duplicating it. At the scale of a handful of curated
# networks (dozens to low hundreds of rows), the read endpoint scans the
# whole table and filters for either side of the pair in the API layer
# (matching the existing videos/embeddings scan-at-this-scale pattern) --
# a GSI on to_topic would be the move if this table ever needs to serve a
# much larger connection graph.
#
# Named "topic_connections" (not "connections") because that name is
# already taken by the WebSocket connection-id table below (websocket.tf).
resource "aws_dynamodb_table" "topic_connections" {
  name         = "${local.name}-topic-connections"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "from_topic"
  range_key    = "to_topic"

  attribute {
    name = "from_topic"
    type = "S"
  }

  attribute {
    name = "to_topic"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }
}

output "topic_connections_table" {
  value = aws_dynamodb_table.topic_connections.name
}

# ── RabbitHole V1 content model (docs/RABBITHOLE_SCHEMA.md) ──────────────
# A RabbitHole is one item (prose + bounded sub-sections + sources embedded
# as JSON); SLUG#<slug> sentinel items in the same table reserve slugs via a
# conditional TransactWriteItems. No DynamoDB Streams -- RabbitHoles have no
# real-time surface.

resource "aws_dynamodb_table" "rabbitholes" {
  name         = "${local.name}-rabbitholes"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }
  attribute {
    name = "slug"
    type = "S"
  }
  attribute {
    name = "status"
    type = "S"
  }
  attribute {
    name = "updated_at"
    type = "S"
  }
  attribute {
    name = "gsi_pub"
    type = "S"
  }
  attribute {
    name = "published_at"
    type = "S"
  }

  # get RabbitHole by slug (the public read path)
  global_secondary_index {
    name            = "by-slug"
    hash_key        = "slug"
    projection_type = "ALL"
  }

  # editorial listing: every RabbitHole in a status, newest-updated first
  global_secondary_index {
    name            = "by-status"
    hash_key        = "status"
    range_key       = "updated_at"
    projection_type = "ALL"
  }

  # public feed: sparse -- only published items carry gsi_pub ("PUB")
  global_secondary_index {
    name            = "published-feed"
    hash_key        = "gsi_pub"
    range_key       = "published_at"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = true
  }
}

output "rabbitholes_table" {
  value = aws_dynamodb_table.rabbitholes.name
}

# Directed "Keep Digging" edges. One item per edge; reverse edges are derived
# from the `inbound` GSI, never stored twice.
resource "aws_dynamodb_table" "rabbithole_connections" {
  name         = "${local.name}-rabbithole-connections"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "source_id"
  range_key    = "dest_key"

  attribute {
    name = "source_id"
    type = "S"
  }
  attribute {
    name = "dest_key"
    type = "S"
  }
  attribute {
    name = "destination_id"
    type = "S"
  }

  # "what leads here" -- sparse: stub edges have no destination_id
  global_secondary_index {
    name            = "inbound"
    hash_key        = "destination_id"
    range_key       = "source_id"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = true
  }
}

output "rabbithole_connections_table" {
  value = aws_dynamodb_table.rabbithole_connections.name
}

# Append-only snapshot of the full RabbitHole item on each publish.
resource "aws_dynamodb_table" "rabbithole_revisions" {
  name         = "${local.name}-rabbithole-revisions"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"
  range_key    = "rev"

  attribute {
    name = "id"
    type = "S"
  }
  attribute {
    name = "rev"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }
}

output "rabbithole_revisions_table" {
  value = aws_dynamodb_table.rabbithole_revisions.name
}
