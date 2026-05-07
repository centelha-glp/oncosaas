# AGENTS.md

## Cursor Cloud specific instructions

### Services overview

| Service | Port | Command | Health check |
|---------|------|---------|--------------|
| Backend (NestJS) | 3002 | `cd backend && npm run start:dev` | `curl http://localhost:3002/api/v1/health` |
| Frontend (Next.js) | 3000 | `cd frontend && npm run dev` | `curl http://localhost:3000` |
| AI Service (FastAPI) | 8001 | `cd ai-service && uvicorn main:app --reload --host 0.0.0.0 --port 8001` | `curl http://localhost:8001/health` |
| PostgreSQL | 5432 | via Docker (`compose.infra.yml`) | `docker exec pg-database pg_isready` |
| Redis | 6379 | via Docker (`compose.infra.yml`) | `docker exec redis-cache redis-cli ping` |
| RabbitMQ | 5672/15672 | via Docker (`compose.infra.yml`) | `docker exec msg-service rabbitmq-diagnostics ping` |

### Starting infrastructure

```bash
# Docker daemon must be running first
sudo dockerd &>/tmp/dockerd.log &
sleep 3
docker compose -f compose.infra.yml up -d
```

Wait for containers to be healthy before running migrations or starting services.

### Database setup

After infrastructure is up (PostgreSQL healthy):

```bash
cd backend && npx prisma migrate deploy && npx prisma db seed
```

### Non-obvious caveats

- **Python PATH**: `pip install` installs binaries to `~/.local/bin`. Ensure `export PATH="$HOME/.local/bin:$PATH"` is set before running `uvicorn` or `pytest`.
- **Docker in this VM**: The environment runs Docker-in-Docker with `fuse-overlayfs` storage driver and `iptables-legacy`. Docker daemon needs to be started manually with `sudo dockerd`.
- **AI Service without LLM keys**: The service works without `OPENAI_API_KEY`/`ANTHROPIC_API_KEY`—it falls back to mocked responses. Clinical rules and ML model still function.
- **Backend service token**: The AI service requires `Authorization: Bearer <BACKEND_SERVICE_TOKEN>` for internal endpoints. In dev, this is `change-me-internal-service-token` (matching `backend/.env` and `ai-service/.env`).
- **Cookie-based auth**: Login returns JWT in HttpOnly cookies (not in response body). Use `curl -c cookies.txt` / `curl -b cookies.txt` for testing.
- **Each service has its own `.env`**: `backend/.env`, `frontend/.env`, `ai-service/.env`. The root `.env` is NOT used.

### Test credentials (seeded)

| Role | Email | Password |
|------|-------|----------|
| ADMIN | admin@hospitalteste.com | senha123 |
| ONCOLOGIST | oncologista@hospitalteste.com | senha123 |
| NURSE | enfermeira@hospitalteste.com | senha123 |

### Running tests

See `CLAUDE.md` and `README.md` for full command reference. Quick summary:
- Backend: `cd backend && npm test`
- Frontend: `cd frontend && npm test`
- AI Service: `cd ai-service && pytest`

### Running lint

- Backend: `cd backend && npm run lint`
- Frontend: `cd frontend && npm run lint`
- AI Service: `cd ai-service && ruff check .`
