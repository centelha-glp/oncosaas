Antes de alterar qualquer código, execute o seguinte checklist de diagnóstico na ordem:

**1. Estado dos containers Docker**
```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
docker compose ps
```
Se algum container estiver com status diferente de "Up" ou "healthy", reiniciar antes de prosseguir:
```bash
docker compose restart <serviço>
# ou para stack completa:
docker compose down && docker compose up -d
```

**2. Verificar .env nos locais corretos (monorepo)**
- Root `.env` — variáveis globais
- `backend/.env` — lido pelo NestJS
- `frontend/.env` — lido pelo Next.js
- `ai-service/.env` — lido pelo FastAPI

**3. Confirmar branch correta**
```bash
git branch --show-current
git status
```
Se estiver em `main`, criar branch antes de qualquer mudança:
```bash
git checkout -b fix/<descricao-curta>
```

**4. Type-check rápido**
```bash
# Para TypeScript (backend ou frontend)
cd backend && npx tsc --noEmit 2>&1 | head -20
cd frontend && npx tsc --noEmit 2>&1 | head -20

# Para Python (ai-service)
cd ai-service && python -m pytest tests/ -x -q 2>&1 | head -20
```

**5. Logs do serviço com problema**
```bash
docker compose logs --tail=50 <serviço>
```

Só após concluir este checklist e descartar problemas de infraestrutura, investigar o código-fonte.
