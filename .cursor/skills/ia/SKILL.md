---
name: ia
description: Aciona o agente ai-service para tarefas do agente conversacional oncológico, pipeline de triage e FastAPI
---

# Skill: /ia

## Descrição

Aciona o agente `ai-service` para tarefas do serviço Python: agente conversacional, pipeline de triage, endpoints FastAPI e integração com o orquestrador multi-agente.

## Uso

```
/ia [tarefa ou contexto]
```

### Exemplos

- `/ia adicionar novo fast-path para intent de consulta de medicamentos` — novo intent no orchestrator
- `/ia debug pipeline de triage não disparando R01` — diagnóstico no pipeline
- `/ia novo endpoint FastAPI para análise de risco` — novo endpoint seguindo padrões
- `/ia fallback sem API key não está retornando resposta segura` — correção de fallback
- `/ia` — analisa o estado do ai-service e sugere melhorias

## O que faz

1. Lê os arquivos relevantes em `ai-service/src/`
2. Implementa ou corrige seguindo a ordem invariante do pipeline:
   ```
   Intent fast-paths → Symptom Analysis → Clinical Rules (Layer 1)
   → Protocol Engine → ML Model (Layer 3) → RAG → LLM Pipeline
   ```
3. Garante que `clinical_rules_engine.evaluate()` nunca é movido após o LLM
4. Testa com `python -m pytest tests/ -v`

## Regras invariantes do pipeline

- `clinical_rules_engine.evaluate()` é step 2.5 — SEMPRE antes do LLM
- `ER_IMMEDIATE` gerado por Layer 1 NUNCA é rebaixado
- Subagentes usam `tool_executor=None` — nunca executam tool calls
- Nunca chamar `backend_client` do caminho crítico do triage
- Nunca usar `print()` — sempre `logging.getLogger(__name__)`

## Referências

- Rules: `.cursor/rules/ai-service.mdc`
- Orchestrator: `ai-service/src/agent/orchestrator.py`
- Clinical rules: `ai-service/src/agent/clinical_rules.py`
- FastAPI: `ai-service/src/routes/`
