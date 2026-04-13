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

### Autenticação e sessão (cookies HttpOnly)

- **Recomendação de segurança:** usar **`NEXT_PUBLIC_USE_RELATIVE_API=true`** + **`BACKEND_URL`** para o JWT ficar só em cookie **HttpOnly** na mesma origem do app e **não** depender do espelho legível **`auth_token`** (reduz impacto de XSS). Em desenvolvimento com Nest em HTTPS, alinhe `BACKEND_URL` ao protocolo do backend (ex.: `https://localhost:3002`).
- **Dev local (Nest HTTPS + certificado autoassinado):** o proxy de `/api/v1` está em **`src/app/api/v1/[[...path]]/route.ts`** (não nos rewrites nativos do Next). O `fetch` usa um **Agent Undici** com `rejectUnauthorized: false` **apenas em `NODE_ENV !== 'production'`**, para aceitar cert local. Em produção o proxy usa verificação TLS normal — use certificados válidos ou HTTP interno (ex. Docker `http://backend:3002`).
- O backend emite **refresh** (path `/api/v1/auth`) e **access** JWT em cookie **HttpOnly** com path `/` no host da API (inclui `/api/v1/*` e Socket.io). O cliente Axios **não** envia `Authorization: Bearer`; o JWT vai no cookie; use **`withCredentials: true`** (CORS com credenciais).
- Com **`NEXT_PUBLIC_USE_RELATIVE_API=true`** e **`BACKEND_URL`** (ex.: `http://localhost:3002` ou `http://backend:3002` no Docker), o Next faz **rewrite** de `/api/v1/*` para o Nest: cookies ficam na **mesma origem** do app e o middleware valida o cookie **`access_token`** (HttpOnly). O espelho **`auth_token`** não é necessário nesse modo.
- Com API **direta** na porta do Nest (`NEXT_PUBLIC_USE_RELATIVE_API=false`), o access token **não** é persistido em `localStorage`; pode manter-se um espelho **`auth_token`** (cookie legível) só para o middleware do Next, com **`JWT_SECRET`** em `frontend/.env`.
- WebSocket continua tipicamente na URL do Nest (`NEXT_PUBLIC_WS_URL`); com API relativa, o cliente chama **`POST /api/v1/auth/socket-ticket`** (cookie de sessão) e envia o **`ticket`** opaco no `auth` do Socket.io — o JWT não vai no JSON da resposta HTTP.
- Em produção, o `next.config` aplica **CSP** restritiva; `connect-src` inclui `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL`, `NEXT_PUBLIC_CSP_CONNECT_EXTRA` e integrações declaradas. Em desenvolvimento o CSP não é aplicado (evita bloquear HMR); mantenha bibliotecas e `dangerouslySetInnerHTML` sob controlo — em produção a CSP ajuda a limitar XSS.
- **Automação de browser / MCP:** trate sessões de login como postos com acesso clínico; não use credenciais reais ou dados de pacientes em fluxos automatizados em ambientes partilhados.
- **Imagem Docker (build):** defina `ARG`/`ENV` na build — `NEXT_PUBLIC_*` e `BACKEND_URL` entram no `next build` (rewrite e bundle). Ex.: `docker build --build-arg BACKEND_URL=http://backend:3002 --build-arg NEXT_PUBLIC_USE_RELATIVE_API=true ...` (valores já têm padrão no `frontend/Dockerfile`).
- **Exportação de dados:** CSV e relatórios com identificadores devem preferir **mascaramento** na UI; exportações completas só com **permissão** e, quando aplicável, **trilha de auditoria** no backend (evitar downloads não rastreados em postos compartilhados).
- **Dependências:** rode `npm audit` no `frontend` e `backend` periodicamente e na CI; corrija vulnerabilidades críticas antes de releases.

## Subir com Docker (recomendado)

### Opção A: stack completa de desenvolvimento

```bash
docker compose -f docker-compose.dev.yml up --watch
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
cd ../ai-service && python -m pip install -r requirements.txt
cd ..
```

3. Rode as aplicações em 3 terminais:

```bash
# terminal 1
cd backend && npm run start:dev

# terminal 2
cd frontend && npm run dev

# terminal 3
cd ai-service && python -m uvicorn main:app --reload --host 0.0.0.0 --port 8001
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

- Frontend: [http://localhost:3000](http://localhost:3000)
- Backend API: [http://localhost:3002/api/v1](http://localhost:3002/api/v1)
- Backend health: [http://localhost:3002/api/v1/health](http://localhost:3002/api/v1/health)
- AI service health: [http://localhost:8001/health](http://localhost:8001/health)
- RabbitMQ UI: [http://localhost:15672](http://localhost:15672)

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
- [Índice da documentação (`docs/README.md`)](docs/README.md)
- [docs/](docs/)
- [Contratos de API (Nest vs AI Service)](docs/api/contratos-api.md)
- [Índice HL7 / FHIR](docs/fhir/README.md)
- [Índice IA — priorização e agente](docs/ia-modelo-priorizacao/README.md)
- [docs/desenvolvimento/setup-e-deploy.md](docs/desenvolvimento/setup-e-deploy.md)
- [docs/desenvolvimento/comandos-uteis.md](docs/desenvolvimento/comandos-uteis.md)

## Licença

Este projeto está sob a licença definida em [LICENSE](LICENSE).
