# Guia de Setup e Deploy

> Última atualização: 2025-12-12

Este documento consolida todo o processo de preparação do ambiente de desenvolvimento e do deploy local/produção do ONCONAV. Siga os passos abaixo na ordem indicada para evitar erros comuns.

---

## 1. Pré-requisitos

| Ferramenta     | Versão mínima                        | Como verificar           |
| -------------- | ------------------------------------ | ------------------------ |
| Node.js        | 18.x                                 | `node -v`                |
| npm            | 9.x                                  | `npm -v`                 |
| Python         | 3.11+ (comando `python3`)            | `python3 --version`      |
| pip            | 23+                                  | `pip --version`          |
| Docker         | 24+                                  | `docker --version`       |
| Docker Compose | plugin integrado ou `docker-compose` | `docker compose version` |

> **Importante**: os scripts utilizam `python3`. Em ambientes Windows, garanta que o comando `python3` esteja mapeado (ou ajuste manualmente o script `ai:dev`).

---

## 2. Variáveis de Ambiente

1. Copie os templates por serviço:
   - `cp backend/.env.example backend/.env`
   - `cp frontend/.env.example frontend/.env`
   - `cp ai-service/.env.example ai-service/.env`
2. Ajuste as credenciais locais (Postgres/Redis/RabbitMQ já vêm preenchidos para uso com o `docker-compose`).
3. Para habilitar o agente de IA real, configure `OPENAI_API_KEY` e/ou `ANTHROPIC_API_KEY` no `ai-service/.env`.
4. Configure os endpoints de WhatsApp/FHIR conforme necessário (principalmente no `backend/.env`).

> Sem as chaves de LLM, o AI Service sobe em modo _mock_, respondendo com mensagens padrão para facilitar o desenvolvimento.

---

## 3. Instalação de Dependências

```bash
# Raiz (scripts utilitários)
npm install

# Frontend (Next.js)
cd frontend && npm install

# Backend (NestJS)
cd ../backend && npm install

# AI Service (FastAPI)
cd ../ai-service && pip install -r requirements.txt

# Voltar à raiz
cd ..
```

Após a primeira instalação, execute `npm run prepare` para ativar os hooks do Husky.

---

## 4. Infraestrutura Local (Postgres/Redis/RabbitMQ)

```bash
npm run docker:up        # equivale a docker-compose up -d
npm run docker:ps        # verifica se os containers estão saudáveis
```

> Se preferir controlar manualmente, use os comandos diretos do Docker Compose (`docker-compose up -d`, `docker-compose logs -f`, etc.).

---

## 5. Banco de Dados

1. Gere/atualize o cliente Prisma: `npm run db:generate`
2. Aplique migrations em modo dev: `npm run db:migrate`
3. **Popule o banco com dados de teste (seed)**:
   ```bash
   cd backend && npx prisma db seed
   ```
4. Para produção, execute `cd backend && npx prisma migrate deploy` (modo idempotente).

### 🔑 Credenciais de Teste (após seed)

| Usuário       | Email                           | Senha      | Perfil      |
| ------------- | ------------------------------- | ---------- | ----------- |
| Administrador | `admin@hospitalteste.com`       | `senha123` | ADMIN       |
| Oncologista   | `oncologista@hospitalteste.com` | `senha123` | ONCOLOGIST  |
| Enfermeira    | `enfermeira@hospitalteste.com`  | `senha123` | NURSE       |
| Coordenador   | `coordenador@hospitalteste.com` | `senha123` | COORDINATOR |

> ⚠️ **IMPORTANTE**: Sem executar o seed, não haverá usuários no sistema e o login não funcionará!

---

## 6. Ambiente de Desenvolvimento

```bash
npm run dev         # Frontend + Backend + AI Service
```

- O Frontend sobe em `http://localhost:3000`
- O Backend (NestJS) expõe `http://localhost:3002` e `ws://localhost:3002`
- O AI Service responde em `http://localhost:8001/health`
- Dependências (Postgres/Redis/RabbitMQ) ficam nos ports definidos em `docker-compose.yml`

Outros cenários:

- `npm run dev:https`: mesmo fluxo anterior, mas com certificados locais para Embedded Signup (consulte `README-HTTPS.md`).
- `npm run backend:dev` / `npm run frontend:dev` / `npm run ai:dev`: iniciam cada serviço isoladamente.

### Verificações rápidas

| Serviço  | URL                                   | O que esperar                    |
| -------- | ------------------------------------- | -------------------------------- |
| Frontend | `http://localhost:3000`               | Tela de login                    |
| Backend  | `http://localhost:3002/api/v1/health` | `{ "status": "ok" }`             |
| AI       | `http://localhost:8001/`              | `{ "message": "ONCONAV AI..." }` |

### Portas utilizadas

| Serviço     | Porta | Protocolo |
| ----------- | ----- | --------- |
| Frontend    | 3000  | HTTP      |
| Backend     | 3002  | HTTP      |
| AI Service  | 8001  | HTTP      |
| PostgreSQL  | 5432  | TCP       |
| Redis       | 6379  | TCP       |
| RabbitMQ    | 5672  | AMQP      |
| RabbitMQ UI | 15672 | HTTP      |

---

## 7. Deploy Local / Produção

1. **Build**
   ```bash
   npm run build   # next build + nest build
   ```
2. **Migrations (modo seguro)**
   ```bash
   cd backend && npx prisma migrate deploy
   ```
3. **Start**
   ```bash
   npm run start   # next start + nest start + uvicorn main:app --host 0.0.0.0 --port 8001
   ```
4. (Opcional) Configure um process manager (PM2, systemd, Supervisor) para manter os processos ativos.

> Para ambientes cloud/Kubernetes, considere criar arquivos específicos de deploy (Dockerfile/K8s). Atualmente o `docker-compose` contempla apenas as dependências (Postgres/Redis/RabbitMQ).

---

## 8. Troubleshooting

| Problema                                               | Sintoma                                      | Solução                                                                                             |
| ------------------------------------------------------ | -------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Login retorna "Invalid credentials"                    | Seed não foi executado                       | Execute `cd backend && npx prisma db seed` para criar usuários de teste.                            |
| `pip install` falha com Python 3.13                    | Incompatibilidade de versões                 | O `requirements.txt` usa versões flexíveis (`>=`). Reinstale `pip install -r requirements.txt`.     |
| Container Docker já existe                             | "The container name is already in use"       | Execute `docker rm <nome-container>` ou `docker-compose down -v` para remover containers antigos.   |
| Porta em uso (EADDRINUSE)                              | Backend ou Frontend não inicia               | Mate processos antigos: `taskkill //F //IM node.exe` (Windows) ou `killall node` (Linux/Mac).       |
| Erro CORS no login                                     | Frontend e Backend com protocolos diferentes | Certifique-se que ambos usam HTTP ou HTTPS. Verifique `FRONTEND_URL` no `.env` do backend.          |
| Migration falha "relation does not exist"              | Migrations fora de ordem                     | Execute `npx prisma migrate reset --force` para resetar o banco (⚠️ perde dados!).                  |
| `uvicorn: command not found` ao rodar `npm run ai:dev` | Scripts do pip ficam em `~/.local/bin`       | O script agora usa `python3 -m uvicorn ...`, eliminando a dependência do PATH.                      |
| `OPENAI_API_KEY não configurada` interrompia o boot    | AI Service não subia sem chave               | O agente agora funciona em modo _mock_ e loga um aviso. Configure a chave para ter respostas reais. |
| `npm run dev` não iniciava todos os serviços           | Era necessário abrir 3 terminais             | O script foi atualizado para levantar Frontend, Backend e AI Service em paralelo.                   |
| Esquecimento de instalar o Frontend                    | `npm run dev` falhava por falta de deps      | Lembre-se do passo `cd frontend && npm install`. O README e este guia foram atualizados.            |

---

## 9. Fluxo Resumido

```bash
# 0. Pré-requisitos (Node 18+, python3, Docker, etc.)

# 1. Configurar .env por serviço
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
cp ai-service/.env.example ai-service/.env

# 2. Instalar dependências
npm install
cd frontend && npm install && cd ..
cd backend && npm install && cd ..
cd ai-service && pip install -r requirements.txt && cd ..
npm run prepare

# 3. Infra + migrations + seed
npm run docker:up
npm run db:migrate
cd backend && npx prisma db seed && cd ..

# 4. Desenvolvimento
npm run dev

# Acesse http://localhost:3000
# Login: admin@hospitalteste.com / senha123

# 5. Deploy (produção)
npm run build
cd backend && npx prisma migrate deploy && cd ..
npm run start
```

---

Dúvidas adicionais? Consulte também:

- `docs/desenvolvimento/comandos-uteis.md`
- `docs/desenvolvimento/https-setup.md`
- `README-HTTPS.md`
