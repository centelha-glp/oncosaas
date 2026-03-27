# Testes de proteção de dados
# Valida criptografia em repouso, SSM SecureString e configurações sensíveis do RDS

mock_provider "aws" {
  mock_data "aws_ami" {
    defaults = {
      id           = "ami-0mock00000000000a"
      architecture = "arm64"
    }
  }
}

mock_provider "random" {}

variables {
  github_repo = "centelha-glp/oncosaas"
}

# ---------------------------------------------------------------------------
# Criptografia em repouso — RDS
# ---------------------------------------------------------------------------

run "rds_storage_criptografado" {
  command = plan

  assert {
    condition     = aws_db_instance.postgres.storage_encrypted == true
    error_message = "RDS deve ter storage encryption habilitado (dados em repouso)"
  }
}

run "rds_protection_habilitada" {
  command = plan

  assert {
    condition     = aws_db_instance.postgres.deletion_protection == true
    error_message = "RDS deve ter deletion protection habilitada para evitar remoção acidental"
  }
}

run "rds_backup_retention_minimo_7_dias" {
  command = plan

  assert {
    condition     = aws_db_instance.postgres.backup_retention_period >= 7
    error_message = "RDS deve reter backups por no mínimo 7 dias"
  }
}

run "rds_backup_retention_customizavel" {
  command = plan

  variables {
    db_backup_retention_days = 14
  }

  assert {
    condition     = aws_db_instance.postgres.backup_retention_period == 14
    error_message = "db_backup_retention_days deve ser respeitado"
  }
}

run "rds_versao_postgres_17" {
  command = plan

  assert {
    condition     = aws_db_instance.postgres.engine == "postgres"
    error_message = "RDS deve usar engine postgres"
  }

  assert {
    condition     = startswith(aws_db_instance.postgres.engine_version, "17")
    error_message = "RDS deve usar PostgreSQL 17.x"
  }
}

# ---------------------------------------------------------------------------
# Criptografia em repouso — EC2
# ---------------------------------------------------------------------------

run "ec2_root_volume_criptografado" {
  command = plan

  assert {
    condition     = aws_instance.app.root_block_device[0].encrypted == true
    error_message = "Volume raiz do EC2 deve estar criptografado"
  }
}

run "ec2_root_volume_gp3" {
  command = plan

  assert {
    condition     = aws_instance.app.root_block_device[0].volume_type == "gp3"
    error_message = "Volume raiz deve ser gp3 (melhor custo/performance)"
  }
}

# ---------------------------------------------------------------------------
# SSM SecureString — segredos nunca em texto plano
# ---------------------------------------------------------------------------

run "ssm_jwt_secret_secure_string" {
  command = plan

  assert {
    condition     = aws_ssm_parameter.jwt_secret.type == "SecureString"
    error_message = "JWT_SECRET deve ser armazenado como SecureString no SSM"
  }
}

run "ssm_encryption_key_secure_string" {
  command = plan

  assert {
    condition     = aws_ssm_parameter.encryption_key.type == "SecureString"
    error_message = "ENCRYPTION_KEY deve ser armazenado como SecureString no SSM"
  }
}

run "ssm_nextauth_secret_secure_string" {
  command = plan

  assert {
    condition     = aws_ssm_parameter.nextauth_secret.type == "SecureString"
    error_message = "NEXTAUTH_SECRET deve ser armazenado como SecureString no SSM"
  }
}

run "ssm_backend_service_token_secure_string" {
  command = plan

  assert {
    condition     = aws_ssm_parameter.backend_service_token.type == "SecureString"
    error_message = "BACKEND_SERVICE_TOKEN deve ser armazenado como SecureString no SSM"
  }
}

run "ssm_db_password_secure_string" {
  command = plan

  assert {
    condition     = aws_ssm_parameter.db_master_password.type == "SecureString"
    error_message = "DB master password deve ser SecureString no SSM"
  }
}

run "ssm_db_url_secure_string" {
  command = plan

  assert {
    condition     = aws_ssm_parameter.db_url.type == "SecureString"
    error_message = "DB URL (contém credenciais) deve ser SecureString no SSM"
  }
}

# ---------------------------------------------------------------------------
# Prefixo SSM — parâmetros organizados por projeto/environment
# ---------------------------------------------------------------------------

run "ssm_parametros_seguem_prefixo_projeto" {
  command = plan

  assert {
    condition     = startswith(aws_ssm_parameter.jwt_secret.name, "/${var.project}/${var.environment}/")
    error_message = "Parâmetros SSM devem seguir o prefixo /{project}/{environment}/"
  }

  assert {
    condition     = startswith(aws_ssm_parameter.encryption_key.name, "/${var.project}/${var.environment}/")
    error_message = "Parâmetros SSM devem seguir o prefixo /{project}/{environment}/"
  }

  assert {
    condition     = startswith(aws_ssm_parameter.db_master_password.name, "/${var.project}/${var.environment}/")
    error_message = "Parâmetros SSM devem seguir o prefixo /{project}/{environment}/"
  }
}

# ---------------------------------------------------------------------------
# ECR — scan automático de vulnerabilidades
# ---------------------------------------------------------------------------

run "ecr_backend_scan_on_push" {
  command = plan

  assert {
    condition     = aws_ecr_repository.backend.image_scanning_configuration[0].scan_on_push == true
    error_message = "ECR backend deve ter scan_on_push habilitado"
  }
}

run "ecr_frontend_scan_on_push" {
  command = plan

  assert {
    condition     = aws_ecr_repository.frontend.image_scanning_configuration[0].scan_on_push == true
    error_message = "ECR frontend deve ter scan_on_push habilitado"
  }
}

run "ecr_ai_service_scan_on_push" {
  command = plan

  assert {
    condition     = aws_ecr_repository.ai_service.image_scanning_configuration[0].scan_on_push == true
    error_message = "ECR ai-service deve ter scan_on_push habilitado"
  }
}

# ---------------------------------------------------------------------------
# Observabilidade — alarmes críticos configurados
# ---------------------------------------------------------------------------

run "alarme_instance_status_configurado" {
  command = plan

  assert {
    condition     = aws_cloudwatch_metric_alarm.instance_status_failed.threshold == 1
    error_message = "Alarme de instance status check deve disparar com threshold = 1"
  }
}

run "alarme_disk_pressure_threshold_85" {
  command = plan

  assert {
    condition     = aws_cloudwatch_metric_alarm.disk_pressure.threshold == 85
    error_message = "Alarme de disk pressure deve usar threshold de 85%"
  }
}

run "log_group_retencao_30_dias" {
  command = plan

  assert {
    condition     = aws_cloudwatch_log_group.deploy.retention_in_days == 30
    error_message = "Log group de deploy deve ter retenção de 30 dias"
  }
}
