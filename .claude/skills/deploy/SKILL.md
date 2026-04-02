---
name: deploy
description: Aciona o agente devops para Docker, CI/CD GitHub Actions, health checks e configuração de ambientes
---

# Skill: /deploy

## Descrição

Aciona o agente `devops` para tarefas de infraestrutura de aplicação: Docker, docker-compose, pipelines CI/CD, health checks e configuração de ambientes (dev/staging/prod).

## Uso

```
/deploy [tarefa ou contexto]
```

### Exemplos

- `/deploy corrigir health check do backend no compose.prod` — diagnóstico e correção
- `/deploy adicionar job de scan Trivy no CI` — novo step no workflow
- `/deploy variáveis de ambiente faltando na produção` — diagnóstico de env vars
- `/deploy otimizar build time do Dockerfile do frontend` — otimização multi-stage
- `/deploy` — revisa os arquivos de infraestrutura e sugere melhorias

## O que faz

1. Lê os arquivos compose, Dockerfiles e workflows relevantes
2. Diagnostica ou implementa a mudança solicitada
3. Valida que health checks seguem o padrão correto por serviço
4. Garante que portas são vinculadas a `127.0.0.1` (nunca `0.0.0.0`)
5. Verifica que imagens usam versões fixas (nunca `latest`)
6. Garante entrypoint do backend não pula migrations

## Arquivos compose — quando usar cada um

| Arquivo | Uso |
|---------|-----|
| `compose.infra.yml` | Somente infra (PostgreSQL, Redis, RabbitMQ) |
| `compose.app.yml` | Somente aplicações |
| `docker-compose.dev.yml` | Stack completa dev |
| `docker-compose.prod.yml` | Produção (sem infra interna) |

## Regras invariantes

- Nunca usar `:latest` em imagens base dos Dockerfiles
- Nunca expor portas em `0.0.0.0` — sempre `127.0.0.1`
- `start_period: 60s` nos health checks de backend e ai-service
- Entrypoint do backend executa migrations antes de iniciar
- Build de imagens: plataforma `linux/arm64` (EC2 Graviton)

## Referências

- Rules: `.claude/rules/devops.md`
- Dockerfiles: `backend/Dockerfile`, `frontend/Dockerfile`, `ai-service/Dockerfile`
- Compose: `docker-compose.dev.yml`, `docker-compose.prod.yml`
- CI/CD: `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`
