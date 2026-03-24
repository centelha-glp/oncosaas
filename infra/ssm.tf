resource "random_password" "jwt_secret" {
  length  = 48
  special = false
}

resource "random_password" "encryption_key" {
  length  = 32
  special = false
}

resource "random_password" "nextauth_secret" {
  length  = 48
  special = false
}

resource "random_password" "backend_service_token" {
  length  = 48
  special = false
}

resource "aws_ssm_parameter" "jwt_secret" {
  name  = "/${var.project}/${var.environment}/backend/JWT_SECRET"
  type  = "SecureString"
  value = random_password.jwt_secret.result
}

resource "aws_ssm_parameter" "encryption_key" {
  name  = "/${var.project}/${var.environment}/backend/ENCRYPTION_KEY"
  type  = "SecureString"
  value = random_password.encryption_key.result
}

resource "aws_ssm_parameter" "nextauth_secret" {
  name  = "/${var.project}/${var.environment}/frontend/NEXTAUTH_SECRET"
  type  = "SecureString"
  value = random_password.nextauth_secret.result
}

resource "aws_ssm_parameter" "backend_service_token" {
  name  = "/${var.project}/${var.environment}/shared/BACKEND_SERVICE_TOKEN"
  type  = "SecureString"
  value = random_password.backend_service_token.result
}

resource "aws_ssm_parameter" "deploy_current" {
  name  = "/${var.project}/${var.environment}/deploy/current"
  type  = "String"
  value = "bootstrap"
}

resource "aws_ssm_parameter" "deploy_last_known_good" {
  name  = "/${var.project}/${var.environment}/deploy/last_known_good"
  type  = "String"
  value = "bootstrap"
}
