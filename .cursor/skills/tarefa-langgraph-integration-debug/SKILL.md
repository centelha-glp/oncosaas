---
name: tarefa-langgraph-integration-debug
description: Integra LLM e tools LangChain como nós LangGraph, usa streaming stream_mode e depura com get_state e histórico. Use quando o pedido citar stream_mode, invoke/stream, get_state ou depuração de passos do grafo.
disable-model-invocation: true
---

# LangGraph — integração LLM/tools e depuração

## Objectivo

Encaixar modelos e ferramentas como nós observáveis e depuráveis com streaming controlado.

## Quando usar

- LG5/LG6: nós que chamam chat models ou runnables, necessidade de visibilidade passo-a-passo.

## Passos

1. Confirmar versões `langgraph` e `langchain` compatíveis na stack do projecto.
2. Encapsular chamadas LLM em nós pequenos; passar só slices de state necessários ao modelo.
3. Usar `stream_mode` adequado (updates, messages, custom) conforme a doc actual; validar no cliente ou testes.
4. Para tools, validar serialização de argumentos e erros devolvidos ao grafo.
5. Usar `get_state` / histórico para reproduzir falhas em desenvolvimento.
6. Adicionar logging estruturado sem PII desnecessário.
7. Escrever testes que percorrem um ramo com mock de LLM quando possível.

## Links oficiais

- https://docs.langchain.com/oss/python/langgraph/use-graph-api
- https://python.langchain.com/docs/

## Anti-padrões

- Stream sem backpressure em produtos sensíveis a latência.
- Esconder excepções de tool que impedem recovery no grafo.
- Duplicar regras clínicas só no prompt do nó.

## Ligação ONCONAV

Manter invariantes já definidos no `orchestrator` (ex.: regras clínicas antes do LLM) ao integrar novos nós; consultar `ai-service` e `llm-agent-architect` para alinhamento.
