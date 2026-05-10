variable "aws_region" {
  description = "The AWS region to deploy to"
  default     = "us-east-1"
  type        = string
}

variable "project_name" {
  description = "The name of the project"
  default     = "timeblock"
  type        = string
}
