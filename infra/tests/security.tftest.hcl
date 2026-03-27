# Testes de segurança
# Valida security groups, isolamento do RDS e hardening do EC2

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
# Security Group da aplicação — portas públicas
# ---------------------------------------------------------------------------

run "app_sg_permite_http_publico" {
  command = plan

  assert {
    condition = anytrue([
      for rule in aws_security_group.app.ingress :
      rule.from_port == 80 && rule.to_port == 80 &&
      rule.protocol == "tcp" && contains(rule.cidr_blocks, "0.0.0.0/0")
    ])
    error_message = "App SG deve permitir HTTP (80) de 0.0.0.0/0"
  }
}

run "app_sg_permite_https_publico" {
  command = plan

  assert {
    condition = anytrue([
      for rule in aws_security_group.app.ingress :
      rule.from_port == 443 && rule.to_port == 443 &&
      rule.protocol == "tcp" && contains(rule.cidr_blocks, "0.0.0.0/0")
    ])
    error_message = "App SG deve permitir HTTPS (443) de 0.0.0.0/0"
  }
}

# ---------------------------------------------------------------------------
# SSH — desabilitado por padrão (allow_ssh = false)
# ---------------------------------------------------------------------------

run "app_sg_sem_ssh_por_padrao" {
  command = plan

  assert {
    condition = alltrue([
      for rule in aws_security_group.app.ingress :
      !(rule.from_port == 22 || rule.to_port == 22)
    ])
    error_message = "App SG NÃO deve ter regra SSH quando allow_ssh = false"
  }
}

run "app_sg_permite_ssh_quando_habilitado" {
  command = plan

  variables {
    allow_ssh  = true
    admin_cidr = "203.0.113.10/32"
  }

  assert {
    condition = anytrue([
      for rule in aws_security_group.app.ingress :
      rule.from_port == 22 && rule.to_port == 22 &&
      rule.protocol == "tcp" && contains(rule.cidr_blocks, "203.0.113.10/32")
    ])
    error_message = "App SG deve permitir SSH restrito ao admin_cidr quando allow_ssh = true"
  }
}

# ---------------------------------------------------------------------------
# Security Group do banco — apenas a partir do app SG
# ---------------------------------------------------------------------------

run "db_sg_permite_postgres_somente_do_app_sg" {
  command = plan

  assert {
    condition = anytrue([
      for rule in aws_security_group.db.ingress :
      rule.from_port == 5432 && rule.to_port == 5432 &&
      rule.protocol == "tcp" && length(rule.security_groups) > 0 &&
      length(rule.cidr_blocks) == 0
    ])
    error_message = "DB SG deve aceitar Postgres (5432) apenas via security group, nunca via CIDR direto"
  }
}

run "db_sg_referencia_app_sg" {
  command = plan

  assert {
    condition = anytrue([
      for rule in aws_security_group.db.ingress :
      rule.from_port == 5432 && contains(rule.security_groups, aws_security_group.app.id)
    ])
    error_message = "DB SG deve referenciar o App SG como origem do tráfego Postgres"
  }
}

# ---------------------------------------------------------------------------
# RDS — isolamento de rede
# ---------------------------------------------------------------------------

run "rds_nao_acessivel_publicamente" {
  command = plan

  assert {
    condition     = aws_db_instance.postgres.publicly_accessible == false
    error_message = "RDS NÃO deve ser publicamente acessível"
  }
}

run "rds_ssl_forcado" {
  command = plan

  assert {
    condition = anytrue([
      for param in aws_db_parameter_group.postgres.parameter :
      param.name == "rds.force_ssl" && param.value == "1"
    ])
    error_message = "RDS deve ter rds.force_ssl=1 para forçar conexões TLS"
  }
}

run "rds_nao_usa_sg_app_diretamente" {
  command = plan

  assert {
    condition     = !contains(aws_db_instance.postgres.vpc_security_group_ids, aws_security_group.app.id)
    error_message = "RDS deve usar o DB SG dedicado, não o App SG"
  }
}

run "rds_em_subnet_group_privado" {
  command = plan

  assert {
    condition     = aws_db_instance.postgres.db_subnet_group_name == aws_db_subnet_group.main.name
    error_message = "RDS deve estar no DB subnet group com subnets privadas"
  }
}

# ---------------------------------------------------------------------------
# EC2 — hardening
# ---------------------------------------------------------------------------

run "ec2_imdsv2_obrigatorio" {
  command = plan

  assert {
    condition     = aws_instance.app.metadata_options[0].http_tokens == "required"
    error_message = "EC2 deve exigir IMDSv2 (http_tokens = required) para prevenir SSRF via IMDS"
  }
}

run "ec2_imds_hop_limit_1" {
  command = plan

  assert {
    condition     = aws_instance.app.metadata_options[0].http_put_response_hop_limit == 1
    error_message = "EC2 IMDS hop limit deve ser 1 para bloquear acesso de containers"
  }
}

run "ec2_usa_subnet_publica" {
  command = plan

  assert {
    condition     = aws_instance.app.subnet_id == aws_subnet.public.id
    error_message = "EC2 deve estar na subnet pública"
  }
}
