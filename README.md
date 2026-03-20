# ONCONAV (OncoSaaS)

Plataforma de navegação oncológica com arquitetura de microsserviços:

- `frontend`: Next.js (dashboard e fluxos operacionais)
- `backend`: NestJS + Prisma (API, regras de negócio, autenticação)
- `ai-service`: FastAPI (agente conversacional, priorização e endpoints de IA)

## Funcionalidades principais

- Visualização e navegação oncológica ponta a ponta (rastreio, diagnóstico, tratamento e seguimento).
- Dashboard clínico para acompanhamento de pacientes, status de etapas e prioridades.
- Priorização inteligente de casos com modelo de risco/urgência no AI Service.
- Agente conversacional para interação com paciente e coleta estruturada de informações.
- Sistema de alertas para atrasos, pendências e pontos críticos da jornada.
- Estrutura preparada para integração com ecossistema hospitalar (ex.: FHIR/HL7 e WhatsApp).

## Arquitetura

```text
.
├── frontend/            # Next.js (porta 3000)
├── backend/             # NestJS (porta 3002)
├── ai-service/          # FastAPI (porta 8001)
├── docs/                # documentação funcional e técnica
├── docker-compose.dev.yml
├── compose.infra.yml
└── compose.app.yml
```

## Stack

- Frontend: Next.js 15 + React 19 + TypeScript
- Backend: NestJS 11 + Prisma + PostgreSQL
- AI: FastAPI + scikit-learn/LightGBM + provedores LLM (OpenAI/Anthropic)
- Infra local: PostgreSQL, Redis e RabbitMQ via Docker Compose

## Pré-requisitos

- Node.js 20+
- Python 3.11+
- Docker + Docker Compose

## Configuração de ambiente

1. Copie os templates de cada serviço:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
cp ai-service/.env.example ai-service/.env
```

2. Ajuste segredos e integrações por serviço (por exemplo: `backend/.env` para `JWT_SECRET` e `DATABASE_URL`; `ai-service/.env` para `OPENAI_API_KEY`/`ANTHROPIC_API_KEY`).

## Subir com Docker (recomendado)

### Opção A: stack completa de desenvolvimento

```bash
docker compose -f docker-compose.dev.yml up -d --build
```

### Opção B: somente infraestrutura (para rodar apps localmente)

```bash
docker compose -f compose.infra.yml up -d
```

### Opção C: composição modular (infra + app)

```bash
docker compose -f compose.infra.yml -f compose.app.yml up -d --build
```

Para parar qualquer stack:

```bash
docker compose -f docker-compose.dev.yml down
```

## Rodar localmente (sem app em Docker)

Use esta opção quando quiser debug por serviço.

1. Suba infra:

```bash
docker compose -f compose.infra.yml up -d
```

2. Instale dependências:

```bash
cd frontend && npm install
cd ../backend && npm install
cd ../ai-service && python3 -m pip install -r requirements.txt
cd ..
```

3. Rode as aplicações em 3 terminais:

```bash
# terminal 1
cd backend && npm run start:dev

# terminal 2
cd frontend && npm run dev

# terminal 3
cd ai-service && python3 -m uvicorn main:app --reload --host 0.0.0.0 --port 8001
```

## Banco de dados (Prisma)

Com backend local (fora de Docker):

```bash
cd backend
npx prisma migrate dev
npx prisma db seed
```

Com backend em Docker, as migrations rodam automaticamente no startup (`prisma migrate deploy`) e o seed é executado quando o banco está vazio.

## Credenciais de seed

Após o seed inicial:

- `admin@hospitalteste.com` / `senha123`
- `oncologista@hospitalteste.com` / `senha123`
- `enfermeira@hospitalteste.com` / `senha123`
- `coordenador@hospitalteste.com` / `senha123`

## URLs locais

- Frontend: <http://localhost:3000>
- Backend API: <http://localhost:3002/api/v1>
- Backend health: <http://localhost:3002/api/v1/health>
- AI service health: <http://localhost:8001/health>
- RabbitMQ UI: <http://localhost:15672>

## HTTPS local (Embedded Signup / Meta)

1. Gere certificados:

```bash
node scripts/generate-ssl-certs.js
```

2. Rode frontend e backend com HTTPS:

```bash
cd frontend && npm run dev:https
cd backend && npm run start:dev:https
```

Guia completo: [README-HTTPS.md](README-HTTPS.md)

## Testes e qualidade

Frontend:

```bash
cd frontend
npm run lint
npm run test
```

Backend:

```bash
cd backend
npm run lint
npm run test
```

AI Service:

```bash
cd ai-service
pytest
```

## Documentação

- [SPECS.md](SPECS.md)
- [docs/](docs/)
- [docs/desenvolvimento/setup-e-deploy.md](docs/desenvolvimento/setup-e-deploy.md)
- [docs/desenvolvimento/comandos-uteis.md](docs/desenvolvimento/comandos-uteis.md)

## Licença

Este projeto está sob a licença definida em [LICENSE](LICENSE).
