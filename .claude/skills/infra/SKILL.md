---
name: infra
description: Aciona os agentes aws e terraform para infraestrutura AWS (ECS, RDS, VPC, IAM) e IaC Terraform
---

# Skill: /infra

## Descrição

Aciona os agentes `aws` e `terraform` para tarefas de infraestrutura cloud: provisionar recursos AWS, gerenciar Terraform, configurar segurança e networking.

## Uso

```
/infra [tarefa ou contexto]
```

### Exemplos

- `/infra provisionar novo ambiente staging` — planejar e aplicar Terraform
- `/infra adicionar alarme CloudWatch para CPU > 80%` — novo recurso de observabilidade
- `/infra revisar security groups do RDS` — auditoria de segurança de rede
- `/infra configurar OIDC para novo repositório GitHub` — IAM + OIDC
- `/infra escalar EC2 para t3.xlarge` — mudança de instância

## O que faz

1. Lê os arquivos Terraform em `infra/`
2. Para mudanças: executa `terraform plan` → revisa → confirma com você → `terraform apply`
3. Segue naming convention: `{projeto}-{ambiente}-{tipo}`
4. Aplica `default_tags` via provider (não por recurso individual)
5. Usa `prevent_destroy` em recursos com dados (RDS)
6. Garante que nenhum recurso fica fora de `sa-east-1` (LGPD)

## Comandos Terraform

```bash
terraform init       # inicializar (sempre após clonar ou trocar providers)
terraform validate   # validar sintaxe
terraform fmt -recursive  # formatar
terraform plan -out=tfplan  # planejar e revisar
terraform apply tfplan      # aplicar (após confirmação)
```

## Regras invariantes

- Nunca `terraform apply` sem `plan` prévio revisado
- Nunca `apply -auto-approve` em produção
- Nunca provisionar dados de pacientes fora de `sa-east-1`
- Nunca commitar `terraform.tfstate`
- Nunca abrir port 5432 do RDS para `0.0.0.0/0`
- Autenticação AWS via OIDC — nunca access keys estáticas

## Referências

- Rules: `.claude/rules/aws.md`, `.claude/rules/terraform.md`
- Infra Terraform: `infra/`
- Workflows de deploy: `.github/workflows/deploy.yml`
