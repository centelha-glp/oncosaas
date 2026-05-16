---
name: tarefa-langgraph-orchestration
description: Modela StateGraph ou MessageGraph em LangGraph com estado tipado, nós, arestas, reducers e fluxo condicional. Use quando o utilizador ou código mencionar StateGraph, TypedDict de estado, add_node, add_conditional_edges ou reducers de canal.
disable-model-invocation: true
---

# LangGraph — orquestração de grafo e estado

## Objectivo

Definir grafos claros, estado bem tipado e fluxo de controlo previsível antes de persistência ou HITL.

## Quando usar

- LG1/LG2: novo fluxo LangGraph, refactor de nós, branches ou merge de updates no state.

## Passos

1. Ler a visão geral e o guia mental: https://docs.langchain.com/oss/python/langgraph/overview e https://docs.langchain.com/oss/python/langgraph/thinking-in-langgraph
2. Escolher entre Graph API e Functional API conforme o caso; para fluxos explícitos, preferir Graph API: https://docs.langchain.com/oss/python/langgraph/use-graph-api
3. Definir o schema de estado (TypedDict ou schema suportado); campos que acumulam listas devem usar `Annotated` + reducer explícito quando necessário.
4. Listar nós como funções puras em relação ao update de estado; evitar efeitos laterais fora do state.
5. Mapear arestas fixas e condicionais; garantir que todo o caminho relevante tem _exit_ ou ciclo controlado.
6. Validar tipos e chaves de estado partilhadas entre nós antes de integrar LLM.
7. Escrever testes mínimos que invocam o graph com state inicial e verificam keys finais.

## Links oficiais

- https://docs.langchain.com/oss/python/langgraph/use-graph-api
- https://docs.langchain.com/oss/python/langgraph/functional-api

## Anti-padrões

- Estado mutável partilhado fora do grafo sem serialização.
- Ramificações sem condição de fallback que deixem o grafo sem saída.
- Misturar responsabilidade clínica crítica só no LLM sem invariantes no backend.

## Ligação ONCONAV

Regras clínicas e isolamento por tenant permanecem no NestJS e nas camadas determinísticas do `ai-service`; o grafo não deve ser a única barreira a dados sensíveis.
