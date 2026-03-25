# Testes de IAM — princípio do menor privilégio
# Valida roles, policies e GitHub OIDC

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
  github_repo   = "centelha-glp/oncosaas"
  github_branch = "main"
}

# ---------------------------------------------------------------------------
# IAM Role EC2
# ---------------------------------------------------------------------------

run "ec2_role_assume_policy_ec2_service" {
  command = plan

  assert {
    condition = can(
      jsondecode(aws_iam_role.ec2.assume_role_policy).Statement[0].Principal.Service == "ec2.amazonaws.com"
    )
    error_message = "EC2 role deve ter trust policy para ec2.amazonaws.com"
  }
}

run "ec2_role_permite_only_assumrole" {
  command = plan

  assert {
    condition = can(
      jsondecode(aws_iam_role.ec2.assume_role_policy).Statement[0].Action == "sts:AssumeRole"
    )
    error_message = "EC2 trust policy deve usar sts:AssumeRole"
  }
}

# ---------------------------------------------------------------------------
# Managed policies do EC2
# ---------------------------------------------------------------------------

run "ec2_tem_ssm_managed_instance_core" {
  command = plan

  assert {
    condition     = aws_iam_role_policy_attachment.ec2_ssm_core.policy_arn == "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
    error_message = "EC2 deve ter AmazonSSMManagedInstanceCore para acesso via SSM Session Manager"
  }
}

run "ec2_tem_ecr_read_only" {
  command = plan

  assert {
    condition     = aws_iam_role_policy_attachment.ec2_ecr_read.policy_arn == "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
    error_message = "EC2 deve ter ECR ReadOnly — write no ECR é responsabilidade do pipeline CI/CD"
  }
}

run "ec2_tem_cloudwatch_agent" {
  command = plan

  assert {
    condition     = aws_iam_role_policy_attachment.ec2_cw_agent.policy_arn == "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
    error_message = "EC2 deve ter CloudWatchAgentServerPolicy para métricas e logs"
  }
}

# ---------------------------------------------------------------------------
# Runtime policy (SSM parameters restritos ao prefixo do projeto)
# ---------------------------------------------------------------------------

run "ec2_runtime_policy_ssm_restrito_ao_projeto" {
  command = plan

  assert {
    condition = can(jsondecode(aws_iam_policy.ec2_runtime.policy).Statement[0].Action[0] == "ssm:GetParameter")
    error_message = "EC2 runtime policy deve incluir ssm:GetParameter"
  }

  assert {
    condition = anytrue([
      for resource in jsondecode(aws_iam_policy.ec2_runtime.policy).Statement[0].Resource :
      can(regex("parameter/${var.project}/${var.environment}/\\*", resource))
    ])
    error_message = "EC2 runtime policy deve restringir SSM ao prefixo /{project}/{environment}/*"
  }
}

run "ec2_instance_profile_usa_role_correta" {
  command = plan

  assert {
    condition     = aws_iam_instance_profile.ec2.role == aws_iam_role.ec2.name
    error_message = "Instance profile deve referenciar a EC2 role correta"
  }
}

# ---------------------------------------------------------------------------
# GitHub OIDC
# ---------------------------------------------------------------------------

run "github_oidc_url_correto" {
  command = plan

  assert {
    condition     = aws_iam_openid_connect_provider.github.url == "https://token.actions.githubusercontent.com"
    error_message = "OIDC provider deve usar a URL oficial do GitHub Actions"
  }
}

run "github_oidc_audience_sts" {
  command = plan

  assert {
    condition     = contains(aws_iam_openid_connect_provider.github.client_id_list, "sts.amazonaws.com")
    error_message = "OIDC provider deve ter audience sts.amazonaws.com"
  }
}

run "github_deploy_role_usa_web_identity" {
  command = plan

  assert {
    condition = can(
      jsondecode(aws_iam_role.github_deploy.assume_role_policy).Statement[0].Action == "sts:AssumeRoleWithWebIdentity"
    )
    error_message = "GitHub deploy role deve usar sts:AssumeRoleWithWebIdentity"
  }
}

run "github_deploy_role_restringe_ao_repo_configurado" {
  command = plan

  assert {
    condition = can(
      regex(
        var.github_repo,
        jsondecode(aws_iam_role.github_deploy.assume_role_policy).Statement[0].Condition.StringLike["token.actions.githubusercontent.com:sub"]
      )
    )
    error_message = "GitHub deploy role deve restringir assumeRole ao repositório configurado em github_repo"
  }
}

run "github_deploy_role_restringe_a_branch_configurada" {
  command = plan

  assert {
    condition = can(
      regex(
        var.github_branch,
        jsondecode(aws_iam_role.github_deploy.assume_role_policy).Statement[0].Condition.StringLike["token.actions.githubusercontent.com:sub"]
      )
    )
    error_message = "GitHub deploy role deve restringir assumeRole à branch configurada em github_branch"
  }
}

run "github_deploy_policy_tem_ecr_push" {
  command = plan

  assert {
    condition = anytrue([
      for stmt in jsondecode(aws_iam_policy.github_deploy.policy).Statement :
      contains(stmt.Action, "ecr:PutImage")
    ])
    error_message = "GitHub deploy policy deve incluir ecr:PutImage para publicar imagens"
  }
}

run "github_deploy_policy_tem_ssm_send_command" {
  command = plan

  assert {
    condition = anytrue([
      for stmt in jsondecode(aws_iam_policy.github_deploy.policy).Statement :
      contains(stmt.Action, "ssm:SendCommand")
    ])
    error_message = "GitHub deploy policy deve incluir ssm:SendCommand para deploy remoto via SSM"
  }
}
