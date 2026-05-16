---
name: tarefa-langgraph-persistence-hitl
description: Configura checkpointers, threads e retomada em LangGraph e implementa human-in-the-loop com interrupt e Command. Use quando o pedido citar checkpointer, SqliteSaver, thread_id, durable execution, interrupt ou aprovação humana no grafo.
disable-model-invocation: true
---

# LangGraph — persistência e human-in-the-loop

## Objectivo

Execução durável e pontos de pausa seguros para revisão humana sem perder consistência de estado.

## Quando usar

- LG3/LG4: retomar após falha, múltiplas sessões, aprovação antes de acções externas.

## Passos

1. Revisar documentação de persistência e threads na doc LangGraph (secções de checkpointer no site oficial).
2. Escolher backend de checkpoint (ex.: SQLite/Postgres conforme ambiente); configurar `thread_id` estável por conversa ou utilizador.
3. Garantir que o estado serializável cobre o necessário para retomar; evitar objetos não serializáveis no state.
4. Para HITL, posicionar `interrupt` antes de efeitos irreversíveis (envio de mensagem, escrita clínica).
5. Documentar o fluxo `Command` / resume para operadores ou API interna.
6. Testar: interromper, inspecionar state, retomar e concluir o ramo esperado.
7. Rever timeouts e limpeza de threads em ambientes de teste.

## Links oficiais

- https://docs.langchain.com/oss/python/langgraph/overview
- https://docs.langchain.com/oss/python/langgraph/use-graph-api

## Anti-padrões

- Checkpoint sem migração quando o schema de estado muda (quebra retomadas).
- Interrupt depois de side-effects já executados.
- Expor IDs de thread ou estado clínico em logs públicos.

## Ligação ONCONAV

Dados clínicos persistidos e decisões de triagem continuam a seguir contratos do backend; HITL no grafo complementa, não substitui, auditoria e guards.
