---
name: agente-rag-engineer
description: Ativa o subagente rag-engineer (corpus oncológico, FAISS, embeddings, retrieval) no ONCONAV. Use para qualidade de passagens, top-k ou índice vetorial.
---

# Agente `rag-engineer`

## Delegar

- **Task** `subagent_type`: `rag-engineer`
- **Definição:** `.cursor/agents/rag-engineer.md`

## Regras (@)

- `.cursor/rules/onconav-core.mdc`
- `.cursor/rules/rag-engineer.mdc`

## Skill legada

- [rag](../rag/SKILL.md)

## Ajuda transversal

- [agente-onconav](../agente-onconav/SKILL.md)
