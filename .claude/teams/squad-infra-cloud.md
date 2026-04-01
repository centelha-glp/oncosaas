---
name: squad-infra-cloud
description: Squad Infra/Cloud — AWS, Terraform e CI/CD do ONCONAV
---

# Squad Infra/Cloud

Equipe responsável pela infraestrutura AWS, IaC Terraform e pipelines de deploy do ONCONAV.

## Teammates

### devops
Papel: Docker, docker-compose, GitHub Actions e CI/CD de aplicação.
Responsabilidades:
- Manter Dockerfiles e docker-compose (dev/prod)
- Configurar pipelines GitHub Actions (build → test → push → deploy)
- Gerenciar health checks e variáveis de ambiente por ambiente
- Garantir build reproducível entre dev e prod

### aws
Papel: ECS Fargate, RDS PostgreSQL, ElastiCache Redis, VPC, IAM, CloudWatch.
Responsabilidades:
- Dimensionar tasks ECS (frontend: 0.5vCPU/1GB; backend: 1vCPU/2GB; ai-service: 2vCPU/4GB)
- Configurar RDS Multi-AZ com `deletion_protection = true`
- Manter security groups com least privilege
- Configurar alarmes CloudWatch obrigatórios (CPU > 80%, task count = 0, 5xx > 1%)

### terraform
Papel: IaC, módulos Terraform, state S3+DynamoDB e provisionamento.
Responsabilidades:
- Manter módulos em `infra/modules/` (ecs-service, rds-postgres, elasticache-redis, alb, vpc)
- Garantir `prevent_destroy` em recursos críticos (RDS, S3 state)
- Nunca hardcodar secrets — sempre via Secrets Manager
- Executar `terraform plan` antes de qualquer `apply` em produção

## Coordenação

1. **aws** e **terraform** planejam a infraestrutura em paralelo
2. **terraform** codifica os recursos AWS como IaC
3. **devops** integra o deploy da aplicação com a infraestrutura provisionada

## Quando acionar este squad

- Provisionar novo ambiente (staging, prod)
- Escalar serviços ECS
- Configurar RDS ou Redis
- Criar pipeline de deploy
- Investigar custo ou performance de infraestrutura
- Configurar monitoramento e alertas CloudWatch
