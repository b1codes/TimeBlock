# TimeBlock Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provision the AWS infrastructure required for the TimeBlock backend using Infrastructure as Code to ensure a cost-optimized, serverless environment.

**Architecture:** The infrastructure consists of an Amazon DynamoDB table for storage, an AWS Lambda function running the FastAPI backend via Mangum, and an API Gateway to route HTTP requests. Critically, the API Gateway implements a strict Usage Plan to throttle requests and protect against runaway billing.

**Tech Stack:** Terraform, AWS (Lambda, API Gateway, DynamoDB, IAM).

---

### Task 1: Terraform Project Setup & Provider Configuration

**Files:**
- Create: `infra/main.tf`
- Create: `infra/variables.tf`

- [ ] **Step 1: Write provider and variables configuration**

```hcl
# infra/variables.tf
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
```

- [ ] **Step 2: Initialize the main terraform block**

```hcl
# infra/main.tf
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
  }
}

provider "aws" {
  region = var.aws_region
}
```

- [ ] **Step 3: Run Terraform Init to verify syntax and providers**

Run: `cd infra && terraform init`
Expected: "Terraform has been successfully initialized!"

- [ ] **Step 4: Commit**

```bash
git add infra/
git commit -m "chore: initialize terraform project for timeblock infrastructure"
```

---

### Task 2: DynamoDB Table Provisioning

**Files:**
- Create: `infra/dynamodb.tf`

- [ ] **Step 1: Write the DynamoDB resource definition**

```hcl
# infra/dynamodb.tf
resource "aws_dynamodb_table" "time_chunks" {
  name           = "${var.project_name}-time-chunks"
  billing_mode   = "PAY_PER_REQUEST" # On-demand pricing fits free-tier usage patterns best
  hash_key       = "user_id"
  range_key      = "chunk_id"

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
```

- [ ] **Step 2: Run Terraform Validate**

Run: `cd infra && terraform validate`
Expected: "Success! The configuration is valid."

- [ ] **Step 3: Commit**

```bash
git add infra/dynamodb.tf
git commit -m "feat: provision dynamodb table for time chunks"
```

---

### Task 3: Lambda Function & IAM Roles

**Files:**
- Create: `infra/lambda.tf`
- Create: `infra/iam.tf`

- [ ] **Step 1: Write IAM roles for Lambda**

```hcl
# infra/iam.tf
data "aws_iam_policy_document" "lambda_assume_role" {
  statement {
    effect = "Allow"
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
    actions = ["sts:AssumeRole"]
  }
}

resource "aws_iam_role" "lambda_role" {
  name               = "${var.project_name}-lambda-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "dynamodb_access" {
  name = "${var.project_name}-dynamodb-access"
  role = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:Query",
          "dynamodb:GetItem"
        ]
        Effect   = "Allow"
        Resource = aws_dynamodb_table.time_chunks.arn
      },
    ]
  })
}
```

- [ ] **Step 2: Write Lambda resource definition**

```hcl
# infra/lambda.tf
# Note: This assumes the backend code is zipped via CI/CD or a local build step before applying.
# We create a dummy archive here to allow Terraform to plan successfully without the backend artifact.

data "archive_file" "dummy_lambda" {
  type        = "zip"
  output_path = "${path.module}/dummy_payload.zip"
  
  source {
    content  = "def handler(event, context): pass"
    filename = "main.py"
  }
}

resource "aws_lambda_function" "api_backend" {
  function_name = "${var.project_name}-api-backend"
  role          = aws_iam_role.lambda_role.arn
  handler       = "src.main.handler" # Maps to the Mangum handler
  runtime       = "python3.11"

  # Uses the dummy payload initially. CI/CD will update this.
  filename         = data.archive_file.dummy_lambda.output_path
  source_code_hash = data.archive_file.dummy_lambda.output_base64sha256

  environment {
    variables = {
      DYNAMODB_TABLE = aws_dynamodb_table.time_chunks.name
    }
  }
}
```

- [ ] **Step 3: Run Terraform Validate**

Run: `cd infra && terraform validate`
Expected: "Success! The configuration is valid."

- [ ] **Step 4: Commit**

```bash
git add infra/lambda.tf infra/iam.tf
git commit -m "feat: setup lambda function and iam permissions"
```

---

### Task 4: API Gateway & Strict Throttling

**Files:**
- Create: `infra/apigateway.tf`

- [ ] **Step 1: Write API Gateway, Route, and Usage Plan definitions**

```hcl
# infra/apigateway.tf
resource "aws_apigatewayv2_api" "http_api" {
  name          = "${var.project_name}-http-api"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_integration" "lambda_integration" {
  api_id           = aws_apigatewayv2_api.http_api.id
  integration_type = "AWS_PROXY"

  integration_uri    = aws_lambda_function.api_backend.invoke_arn
  integration_method = "POST"
}

resource "aws_apigatewayv2_route" "default_route" {
  api_id    = aws_apigatewayv2_api.http_api.id
  route_key = "$default"
  target    = "integrations/${aws_apigatewayv2_integration.lambda_integration.id}"
}

resource "aws_apigatewayv2_stage" "default_stage" {
  api_id      = aws_apigatewayv2_api.http_api.id
  name        = "$default"
  auto_deploy = true
}

resource "aws_lambda_permission" "api_gw" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api_backend.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http_api.execution_arn}/*/*"
}

# ----------------------------------------------------------------
# Spec 7.3: Strict Rate Limiting to protect free tier
# ----------------------------------------------------------------

# Note: HTTP APIs (API Gateway v2) do not support per-IP rate limiting directly via Usage Plans natively without WAF.
# However, we can apply route-level throttling on the stage which applies globally to protect the Lambda.
# For true per-IP throttling, AWS WAF is required, but HTTP APIs don't support WAF.
# If strict per-IP is required, we would need a REST API instead. We use default route throttling here 
# as the simplest serverless safeguard for a prototype.

resource "aws_apigatewayv2_stage" "throttled_stage" {
  api_id      = aws_apigatewayv2_api.http_api.id
  name        = "prod"
  auto_deploy = true

  default_route_settings {
    throttling_burst_limit = 10 # Allow a small burst
    throttling_rate_limit  = 5  # Strict 5 requests per second
  }
}

output "api_endpoint" {
  value = aws_apigatewayv2_api.http_api.api_endpoint
}
```

- [ ] **Step 2: Run Terraform Validate**

Run: `cd infra && terraform validate`
Expected: "Success! The configuration is valid."

- [ ] **Step 3: Commit**

```bash
git add infra/apigateway.tf
git commit -m "feat: provision api gateway with strict throttling limits"
```
