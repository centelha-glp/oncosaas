output "ec2_instance_id" { value = aws_instance.app.id }
output "ec2_public_ip" { value = aws_instance.app.public_ip }
output "rds_endpoint" { value = aws_db_instance.postgres.address }
output "ecr_registry" { value = split("/", aws_ecr_repository.backend.repository_url)[0] }
output "github_deploy_role_arn" { value = aws_iam_role.github_deploy.arn }
output "runtime_ssm_prefix" { value = "/${var.project}/${var.environment}" }
