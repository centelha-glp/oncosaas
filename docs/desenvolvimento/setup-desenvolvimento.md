# Setup de Desenvolvimento

## Pré-requisitos

- Node.js 18+ (recomendado usar nvm)
- Python 3.11+
- PostgreSQL 15+
- Docker e Docker Compose
- Git

## Setup Inicial

### 1. Clone o repositório

```bash
git clone <repository-url>
cd ONCONAV
```

### 2. Configure variáveis de ambiente

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
cp ai-service/.env.example ai-service/.env
# Edite os arquivos de cada serviço com suas configurações
```

### 3. Inicie serviços com Docker Compose

```bash
docker-compose up -d
```

Isso iniciará:

- PostgreSQL (porta 5432)
- Redis (porta 6379)
- RabbitMQ (porta 5672, management UI 15672)

### 4. Setup Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend estará disponível em: http://localhost:3000

### 5. Setup Backend

```bash
cd backend
npm install

# Gerar Prisma Client
npx prisma generate

# Executar migrations
npx prisma migrate dev

# Iniciar servidor
npm run start:dev
```

Backend estará disponível em: http://localhost:3002

### 6. Setup AI Service

```bash
cd ai-service
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Gerar dataset sintético
python ../scripts/generate_synthetic_data.py

# Treinar modelo (opcional)
python ../scripts/train_priority_model.py

# Iniciar servidor
uvicorn main:app --reload --port 8001
```

AI Service estará disponível em: http://localhost:8001

## Estrutura de Pastas

```
ONCONAV/
├── frontend/              # Next.js 14
│   ├── src/
│   │   ├── app/          # App Router
│   │   ├── components/   # Componentes React
│   │   └── lib/          # Utilitários
│   └── package.json
├── backend/               # NestJS
│   ├── src/
│   │   ├── modules/      # Módulos NestJS
│   │   ├── common/       # Interceptors, filters, guards
│   │   └── config/       # Configurações
│   ├── prisma/
│   │   └── schema.prisma
│   └── package.json
├── ai-service/            # Python FastAPI
│   ├── src/
│   │   ├── models/       # Modelos ML
│   │   ├── agent/        # Agente WhatsApp
│   │   └── api/          # Rotas API
│   └── requirements.txt
├── docs/                  # Documentação
├── scripts/               # Scripts utilitários
└── docker-compose.yml
```

## Comandos Úteis

### Desenvolvimento

```bash
# Frontend
cd frontend && npm run dev

# Backend
cd backend && npm run start:dev

# AI Service
cd ai-service && uvicorn main:app --reload --port 8001

# Todos os serviços
docker-compose up -d && npm run dev && cd backend && npm run start:dev
```

### Banco de Dados

```bash
# Prisma Studio (GUI para banco)
cd backend && npx prisma studio

# Criar nova migration
cd backend && npx prisma migrate dev --name nome_da_migration

# Resetar banco (CUIDADO: apaga todos os dados)
cd backend && npx prisma migrate reset
```

### Testes

```bash
# Frontend
cd frontend && npm run test

# Backend
cd backend && npm run test

# E2E
cd backend && npm run test:e2e
```

## Próximos Passos

1. Configurar autenticação (JWT + OAuth 2.0)
2. Implementar CRUD de pacientes
3. Implementar agente WhatsApp
4. Implementar dashboard

## Troubleshooting

### Erro de conexão com PostgreSQL

- Verifique se Docker Compose está rodando: `docker-compose ps`
- Verifique se a porta 5432 não está em uso
- Verifique as credenciais no `.env`

### Erro de Prisma

- Execute `npx prisma generate` novamente
- Verifique se `DATABASE_URL` está correto no `.env`

### Erro de módulos Python

- Ative o venv: `source ai-service/.venv/bin/activate`
- Reinstale dependências: `pip install -r requirements.txt`
