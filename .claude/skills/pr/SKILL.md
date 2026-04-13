Workflow completo de PR para o OncoNav. Execute cada etapa na ordem:

**1. Confirmar branch**
```bash
git branch --show-current
```
Se estiver em `main`, PARAR e criar branch:
```bash
git checkout -b <type>/<descricao-curta>
# Exemplos: fix/agent-priority-score, feat/fhir-patient-sync
```

**2. Verificar qualidade antes de commitar**
```bash
# Lint + format
npm run lint
npm run format:check

# Type check (só os serviços alterados)
cd backend && npm run type-check
cd frontend && npm run type-check

# Testes do módulo alterado
cd backend && npm test -- --testPathPattern=<modulo>
```

**3. Delegar commit ao github-organizer**
Nunca commitar diretamente. Sempre acionar o agente `github-organizer` para:
- Staging seletivo dos arquivos certos
- Commit message em conventional commits (pt-BR)
- Co-Authored-By: Claude Sonnet 4.6

**4. Abrir PR via github-organizer**
O agente `github-organizer` cria a PR com:
- Título: `<type>(<scope>): <descrição concisa>` (máx 70 chars)
- Body com Summary (bullets) + Test plan (checklist)
- Labels corretos por área

**Lembrete de segurança:** Se o PR toca `backend/src/` (controllers, services, DTOs, guards), acionar `seguranca-compliance` ANTES do commit.
