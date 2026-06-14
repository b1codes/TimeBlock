resource "aws_dynamodb_table" "time_chunks" {
  name         = "${var.project_name}-time-chunks"
  billing_mode = "PAY_PER_REQUEST" # On-demand pricing fits free-tier usage patterns best
  hash_key     = "user_id"
  range_key    = "chunk_id"

  attribute {
    name = "user_id"
    type = "S"
  }

  attribute {
    name = "chunk_id"
    type = "S"
  }

  tags = {
    Environment = "production"
    Project     = var.project_name
  }
}
