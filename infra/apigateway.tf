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
