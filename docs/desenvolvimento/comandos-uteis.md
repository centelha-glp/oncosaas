# Comandos Úteis - Referência Rápida

Guia rápido de comandos para desenvolvimento diário.

---

## 🚀 Desenvolvimento

### Iniciar Serviços

```bash
# Todos juntos (Frontend + Backend + AI)
npm run dev
npm run dev:https          # versão com HTTPS para Meta/WhatsApp

# Produção (Next + Nest + Uvicorn)
npm run start

# Frontend (Next.js)
cd frontend && npm run dev

# Backend (NestJS)
cd backend && npm run start:dev

# AI Service (FastAPI)
cd ai-service && python3 -m uvicorn main:app --reload --port 8001

# Todos via Docker Compose
docker-compose up -d
```

### Build

```bash
# Frontend
cd frontend && npm run build

# Backend
cd backend && npm run build

# Todos
npm run build
```

---

## 🔍 Qualidade de Código

### Lint

```bash
# Frontend
cd frontend && npm run lint
cd frontend && npm run lint:fix

# Backend
cd backend && npm run lint
cd backend && npm run lint:check

# Raiz (se configurado)
npm run lint
```

### Formatação

```bash
# Formatar tudo
npm run format

# Verificar sem modificar
npm run format:check

# Frontend
cd frontend && npm run format

# Backend
cd backend && npm run format
```

### Type Check

```bash
# Frontend
cd frontend && npm run type-check

# Backend
cd backend && npm run type-check
```

---

## 🧪 Testes

### Backend (Jest)

```bash
# Todos os testes
cd backend && npm test

# Modo watch (re-executa ao mudar arquivos)
cd backend && npm run test:watch

# Com cobertura
cd backend && npm run test:cov

# Testes E2E
cd backend && npm run test:e2e

# Debug
cd backend && npm run test:debug
```

### AI Service (pytest)

```bash
# Todos os testes
cd ai-service && pytest

# Com cobertura
cd ai-service && pytest --cov=src --cov-report=html

# Modo verbose
cd ai-service && pytest -v

# Teste específico
cd ai-service && pytest tests/test_priority_model.py
```

---

## 🗄️ Banco de Dados

### Prisma

```bash
# Gerar cliente Prisma
cd backend && npm run prisma:generate

# Criar migration
cd backend && npm run prisma:migrate

# Abrir Prisma Studio (GUI)
cd backend && npm run prisma:studio

# Reset database (CUIDADO!)
cd backend && npx prisma migrate reset
```

---

## 🐳 Docker

```bash
# Iniciar todos os serviços
docker-compose up -d

# Ver logs
docker-compose logs -f

# Parar serviços
docker-compose down

# Rebuild imagens
docker-compose build --no-cache

# Limpar volumes (CUIDADO!)
docker-compose down -v
```

---

## 📦 Dependências

### Instalar

```bash
# Frontend
cd frontend && npm install

# Backend
cd backend && npm install

# AI Service
cd ai-service && pip install -r requirements.txt

# Todas
npm install
cd backend && npm install
cd ai-service && pip install -r requirements.txt
```

### Atualizar

```bash
# Frontend
cd frontend && npm update

# Backend
cd backend && npm update

# AI Service
cd ai-service && pip install --upgrade -r requirements.txt
```

---

## 🔐 Variáveis de Ambiente

```bash
# Copiar exemplos por serviço
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
cp ai-service/.env.example ai-service/.env

# Editar
nano backend/.env
nano frontend/.env
nano ai-service/.env
```

---

## 📝 Git

### Workflow Básico

```bash
# Criar branch
git checkout -b feature/nova-feature

# Commitar (Husky executa lint-staged automaticamente)
git add .
git commit -m "feat: nova feature"

# Push (Husky executa testes)
git push origin feature/nova-feature
```

### Verificar Status

```bash
# Status
git status

# Log
git log --oneline

# Diferenças
git diff
```

---

## 🐍 Python (AI Service)

### Formatação

```bash
# Black (formatação automática)
cd ai-service && black src/

# Verificar sem modificar
cd ai-service && black --check src/
```

### Lint

```bash
# Pylint
cd ai-service && pylint src/

# Flake8
cd ai-service && flake8 src/
```

### Ambiente Virtual

```bash
# Criar
cd ai-service && python -m venv .venv

# Ativar (Linux/Mac)
source .venv/bin/activate

# Ativar (Windows)
.venv\Scripts\activate

# Desativar
deactivate
```

---

## 🔧 Troubleshooting

### Limpar Cache

```bash
# Next.js
cd frontend && rm -rf .next

# Node modules
rm -rf node_modules && npm install

# Prisma
cd backend && rm -rf node_modules/.prisma && npm run prisma:generate
```

### Portas em Uso

```bash
# Linux/Mac - Verificar porta
lsof -i :3000
lsof -i :3002
lsof -i :8001

# Matar processo
kill -9 <PID>

# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

---

## 📊 Monitoramento

### Logs

```bash
# Docker Compose
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f ai-service

# Backend (se rodando localmente)
cd backend && npm run start:dev
```

---

## 🎯 Scripts Personalizados

### Rodar Tudo

```bash
# Criar script personalizado (opcional)
# scripts/dev-all.sh
#!/bin/bash
docker-compose up -d db redis
cd backend && npm run start:dev &
cd frontend && npm run dev &
cd ai-service && uvicorn main:app --reload --port 8001
```

---

**Última atualização**: 2024-01-XX  
**Versão**: 1.0.0
