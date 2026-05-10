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
