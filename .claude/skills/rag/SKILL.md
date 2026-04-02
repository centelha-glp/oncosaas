---
name: rag
description: Aciona o agente rag-engineer para gerenciar o corpus oncológico, FAISS, embeddings e qualidade de retrieval
---

# Skill: /rag

## Descrição

Aciona o agente `rag-engineer` para tarefas do pipeline RAG oncológico: curar o corpus, otimizar retrieval, gerenciar cache FAISS e garantir qualidade das respostas baseadas em conhecimento.

## Uso

```
/rag [tarefa ou contexto]
```

### Exemplos

- `/rag adicionar documentos sobre nutrição durante quimio` — curar corpus
- `/rag retrieval não retorna docs sobre febre` — debug de retrieval
- `/rag ajustar threshold de score` — tuning de parâmetros
- `/rag invalidar cache FAISS após atualização do corpus` — rebuild do índice
- `/rag validar 5 queries de referência` — teste de qualidade pós-mudança

## O que faz

1. Lê `ai-service/src/agent/rag/oncology_corpus.json` e `knowledge_base.py`
2. Adiciona/edita documentos seguindo o schema obrigatório
3. Valida clinicamente documentos de `category: "emergencia"` via `clinical-domain`
4. Testa retrieval com queries de referência após mudanças
5. Invalida cache FAISS quando necessário

## Schema obrigatório de documento

```json
{
  "id": "categoria-topico-numero",
  "category": "emergencia",
  "cancer_types": ["ALL"],
  "title": "Título descritivo em português",
  "content": "Conteúdo em linguagem acessível ao paciente..."
}
```

## Queries de referência (devem retornar score ≥ 0.30)

| Query | Doc esperado |
|-------|-------------|
| "febre após quimio" | Neutropenia febril |
| "o que posso comer durante tratamento" | Alimentação segura |
| "quando ir ao pronto-socorro" | Sinais de emergência |
| "estou com muito cansaço" | Fadiga oncológica |
| "dor muito forte" | Manejo da dor |

## Fluxo para documentos de emergência

```
/rag adicionar doc de emergência
    → /validar-clinico (limiares clínicos)
    → teste de retrieval
    → github-organizer
```

## Referências

- Rules: `.claude/rules/rag-engineer.md`
- Corpus: `ai-service/src/agent/rag/oncology_corpus.json`
- Knowledge base: `ai-service/src/agent/rag/knowledge_base.py`
