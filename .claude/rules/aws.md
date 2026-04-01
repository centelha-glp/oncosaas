# aws — Rules & Patterns

Rules derivadas da infraestrutura real em `infra/` e `.github/workflows/deploy.yml`. Aplica-se a toda operação em serviços AWS do ONCONAV.

---

## 1. Serviços AWS em Uso

| Serviço | Propósito | Configuração atual |
|---------|-----------|-------------------|
| **EC2** | Host da aplicação (docker-compose) | t3.large, ARM64, Ubuntu 24.04, sa-east-1a |
| **RDS** | PostgreSQL 17.5 | db.t4g.medium, 50GB, encrypted, Multi-AZ: não (dev/staging) |
| **ECR** | Registry de containers | 3 repositórios: backend, frontend, ai-service |
| **SSM** | Execução de comandos no EC2 + secrets | AmazonSSMManagedInstanceCore na role do EC2 |
| **IAM** | Autenticação e autorização | OIDC para GitHub Actions, role para EC2 |
| **CloudWatch** | Logs e alarmes | Agent instalado no EC2 |
| **VPC** | Rede isolada | CIDR 10.60.0.0/16, sa-east-1 |

---

## 2. Região e Disponibilidade

- **Região padrão:** `sa-east-1` (São Paulo) — obrigatório para conformidade com LGPD.
- **AZ aplicação:** `sa-east-1a`
- **AZs RDS:** `sa-east-1a` + `sa-east-1b` (subnets privadas para Multi-AZ futuro)

Nunca provisionar recursos de dados de pacientes fora de `sa-east-1` sem aprovação legal (LGPD exige dados em território nacional ou com garantias contratuais equivalentes).

---

## 3. Naming Convention

Padrão: `{projeto}-{ambiente}-{tipo-de-recurso}`

| Recurso | Padrão | Exemplo |
|---------|--------|---------|
| EC2 | `oncosaas-{env}-app` | `oncosaas-prod-app` |
| RDS | `oncosaas-{env}-pg` | `oncosaas-prod-pg` |
| Security Group | `oncosaas-{env}-{tipo}-sg` | `oncosaas-prod-app-sg` |
| IAM Role | `oncosaas-{env}-{função}-role` | `oncosaas-prod-github-deploy-role` |
| ECR Repository | `oncosaas-{serviço}` | `oncosaas-backend` |
| SSM Parameter | `/{projeto}/{env}/{domínio}/{chave}` | `/oncosaas/prod/db/master_password` |
| CloudWatch Log Group | `/oncosaas/{env}/{serviço}` | `/oncosaas/prod/backend` |

Nunca usar nomes genéricos (`app`, `server`, `db`) sem o prefixo do projeto.

---

## 4. IAM — Princípio do Menor Privilégio

### GitHub OIDC (Deploy Role)

A role `oncosaas-prod-github-deploy-role` é assumida pelo GitHub Actions via OIDC (sem AWS access keys estáticas):

```json
{
  "Condition": {
    "StringLike": {
      "token.actions.githubusercontent.com:sub": "repo:org/oncosaas:ref:refs/heads/main"
    }
  }
}
```

Permissões mínimas necessárias:
- ECR: `GetAuthorizationToken`, `BatchCheckLayerAvailability`, `PutImage`, `InitiateLayerUpload`, `UploadLayerPart`, `CompleteLayerUpload`, `BatchGetImage`
- SSM: `SendCommand` (apenas para o EC2 específico), `GetCommandInvocation`
- EC2: `DescribeInstances`

### EC2 Instance Role

`oncosaas-prod-ec2-role` com políticas:
- `AmazonSSMManagedInstanceCore` — obrigatório para SSM Agent
- `AmazonEC2ContainerRegistryReadOnly` — pull de imagens do ECR
- `CloudWatchAgentServerPolicy` — métricas e logs
- Policy customizada: SSM Parameter Store (leitura), KMS (decrypt)

**Nunca adicionar `AdministratorAccess` ou `PowerUserAccess` a roles de aplicação.**

---

## 5. Deploy — Sequência via SSM

O deploy é feito via `aws ssm send-command` — sem SSH direto ao EC2:

```bash
# 1. Encodar docker-compose.prod.yml em base64 e enviar via SSM
# 2. Pull das imagens com SHA específico (nunca :latest em prod)
docker pull ${ECR_REGISTRY}/oncosaas-backend:${GITHUB_SHA}
docker pull ${ECR_REGISTRY}/oncosaas-frontend:${GITHUB_SHA}
docker pull ${ECR_REGISTRY}/oncosaas-ai-service:${GITHUB_SHA}

# 3. Validar compose antes do up
docker compose -f docker-compose.prod.yml config

# 4. Subir serviços
docker compose -f docker-compose.prod.yml up -d --no-build --force-recreate --remove-orphans

# 5. Health checks
curl -fsS http://localhost:3002/api/v1/health
curl -fsS http://localhost:8001/health
curl -fsS http://localhost:3000

# 6. Cleanup
docker container prune -f
docker image prune -f
```

### Regras de deploy

- **Nunca usar `:latest`** em produção — sempre tag com `${github.sha}`.
- **Nunca fazer `docker compose up --build`** — imagens devem vir do ECR, não ser buildadas no EC2.
- **Nunca pular `docker compose config`** antes do `up` — valida o compose antes de reiniciar serviços.
- Health checks após deploy são obrigatórios — deploy só é considerado bem-sucedido com 3 healthchecks passando.

---

## 6. ECR — Container Registry

### Repositórios

| Repositório | Imagem | Plataforma |
|-------------|--------|-----------|
| `oncosaas-backend` | NestJS + Node 24 Alpine | `linux/arm64` |
| `oncosaas-frontend` | Next.js + Distroless | `linux/arm64` |
| `oncosaas-ai-service` | FastAPI + Python 3.11 | `linux/arm64` |

**Plataforma ARM64 obrigatória** — EC2 usa Graviton (ARM). Imagens AMD64 não rodam.

### Scan de vulnerabilidades (Trivy)

| Serviço | Severity CRITICAL | Severity HIGH |
|---------|------------------|---------------|
| backend | Bloqueia deploy | Aviso |
| frontend | Bloqueia deploy | Aviso |
| ai-service | Aviso | Aviso |

Vulnerabilidades sem fix disponível são ignoradas (`--ignore-unfixed`).

### Lifecycle Policy

Recomendado configurar lifecycle policy para manter apenas as últimas 10 imagens por tag prefix — reduz custos de storage.

---

## 7. Rede — VPC

```
VPC: 10.60.0.0/16 (oncosaas-prod-vpc)
  │
  ├── Subnet Pública (sa-east-1a): 10.60.10.0/24
  │     └── EC2 (aplicação)
  │
  ├── Subnet Privada RDS A (sa-east-1a): 10.60.20.0/24
  │     └── RDS primary
  │
  └── Subnet Privada RDS B (sa-east-1b): 10.60.30.0/24
        └── RDS standby (Multi-AZ futuro)
```

### Security Groups

- **`oncosaas-prod-app-sg`** (EC2): Inbound 443 (HTTPS) da internet, 22 (SSH) de IP específico de gestão. Outbound: all.
- **`oncosaas-prod-db-sg`** (RDS): Inbound 5432 apenas de `oncosaas-prod-app-sg`. Sem acesso público.

Nunca abrir port 5432 do RDS para `0.0.0.0/0`.

---

## 8. SSM Parameter Store — Secrets

Segredos de produção armazenados em SSM Parameter Store como `SecureString`:

| Parâmetro | Conteúdo |
|-----------|---------|
| `/oncosaas/prod/db/master_password` | Senha master RDS |
| `/oncosaas/prod/app/jwt_secret` | JWT secret |
| `/oncosaas/prod/app/encryption_key` | Chave de criptografia AES |
| `/oncosaas/prod/whatsapp/app_secret` | Meta App Secret |

**Nunca armazenar secrets em variáveis de ambiente do repositório GitHub** para dados de produção — usar SSM Parameter Store + EC2 instance role para leitura.

---

## 9. CloudWatch

- Log group por serviço: `/oncosaas/prod/{serviço}`
- Retenção recomendada: 90 dias (compliance + custo)
- Alarmes obrigatórios:
  - CPU EC2 > 80% por 5 min
  - Conexões RDS > 80% do máximo
  - Erros 5xx no Application Load Balancer (quando implantado)

---

## 10. O Que NUNCA Fazer

- **Nunca** usar AWS access keys estáticas no repositório — apenas OIDC.
- **Nunca** provisionar recursos de dados de pacientes fora de `sa-east-1`.
- **Nunca** usar `:latest` como tag de imagem em produção.
- **Nunca** abrir port 5432 do RDS para `0.0.0.0/0`.
- **Nunca** buildar imagens no EC2 durante o deploy — sempre pull do ECR.
- **Nunca** adicionar `AdministratorAccess` a roles de aplicação.
- **Nunca** acessar EC2 via SSH em produção sem registrar motivo — preferir SSM Session Manager.
- **Nunca** buildar imagens `amd64` — EC2 é ARM64 (Graviton).
- **Nunca** rodar `docker volume prune` em produção sem verificar `backend_uploads`.
- **Nunca** pular health checks após deploy — um serviço pode subir mas estar em estado inválido.
