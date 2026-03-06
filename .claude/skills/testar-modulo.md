# Skill: /testar-modulo

## Descrição

Executa testes de um módulo específico no serviço indicado.

## Uso

```
/testar-modulo <servico> [modulo]
```

Exemplos:

- `/testar-modulo backend patients` — Testa o módulo patients do backend
- `/testar-modulo frontend` — Testa todo o frontend
- `/testar-modulo ai-service priority` — Testa o módulo priority do AI service

## Comandos por Serviço

### Backend (Jest)

```bash
# Módulo específico
cd backend && npx jest --testPathPattern=<modulo> --verbose --forceExit

# Todos os testes
cd backend && npm test -- --forceExit

# Com cobertura
cd backend && npm run test:cov
```

### Frontend (Jest)

```bash
# Módulo específico
cd frontend && npx jest --testPathPattern=<modulo> --verbose --watchAll=false

# Todos os testes
cd frontend && npm test -- --passWithNoTests --watchAll=false
```

### AI Service (pytest)

```bash
# Módulo específico
cd ai-service && pytest tests/test_<modulo>.py -v --tb=short

# Todos os testes
cd ai-service && pytest tests/ -v --tb=short
```

## Após os Testes

- Se falhar: analisar o erro e sugerir fix
- Se passar: mostrar resumo de cobertura (se disponível)
- Sempre mostrar tempo total de execução
