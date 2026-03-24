resource "random_password" "db_master" {
  length           = 24
  special          = true
  override_special = "!#$%&*()-=+[]{}<>:?" # all tf special characters without '/', '@', '"', ' ' (rds requirement)
  keepers = {
    charset_version = "rds-safe-v2"
  }
}

resource "aws_ssm_parameter" "db_master_password" {
  name  = "/${var.project}/${var.environment}/db/master_password"
  type  = "SecureString"
  value = random_password.db_master.result
}

resource "aws_ssm_parameter" "db_url" {
  name  = "/${var.project}/${var.environment}/db/url"
  type  = "SecureString"
  value = "postgresql://${var.db_master_username}:${urlencode(random_password.db_master.result)}@${aws_db_instance.postgres.address}:5432/${var.db_name}?sslmode=require"
}

resource "aws_db_subnet_group" "main" {
  name       = "${var.project}-${var.environment}-db-subnets"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_db_parameter_group" "postgres" {
  name   = "${var.project}-${var.environment}-postgres"
  family = "postgres17"

  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }
}

resource "aws_db_instance" "postgres" {
  identifier            = "${var.project}-${var.environment}-pg"
  engine                = "postgres"
  engine_version        = "17.5"
  instance_class        = var.db_instance_class
  allocated_storage     = var.db_allocated_storage_gb
  max_allocated_storage = var.db_allocated_storage_gb

  db_name  = var.db_name
  username = var.db_master_username
  password = tostring(random_password.db_master.result)

  port                   = 5432
  publicly_accessible    = false
  vpc_security_group_ids = [aws_security_group.db.id]
  db_subnet_group_name   = aws_db_subnet_group.main.name
  parameter_group_name   = aws_db_parameter_group.postgres.name
  storage_encrypted      = true

  delete_automated_backups  = true
  backup_retention_period   = var.db_backup_retention_days
  deletion_protection       = true
  skip_final_snapshot       = true
  final_snapshot_identifier = "${var.project}-${var.environment}-pg-final"
  apply_immediately         = true
}
