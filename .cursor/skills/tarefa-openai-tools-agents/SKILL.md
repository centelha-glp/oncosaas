---
name: tarefa-openai-tools-agents
description: Implementa function calling, parallel tool calls e padrões do OpenAI Agents SDK quando aplicável. Use quando o pedido citar tool_calls, parallel_tool_calls, Agents SDK, handoff ou guardrails OpenAI.
disable-model-invocation: true
---

# OpenAI — tools e Agents SDK

## Objectivo

Loops modelo–ferramenta fiáveis e, quando pedido, composição com Agents SDK.

## Quando usar

- OP3/OP4: tools na API OpenAI ou agentes/handoffs no SDK de agentes.

## Passos

1. Ler https://platform.openai.com/docs sobre function calling e paralelismo.
2. Se Agents SDK: https://openai.github.io/openai-agents-python/ — seguir padrões de agente, `Runner` e transferências.
3. Definir tools com JSON Schema claro; validar argumentos no servidor antes de efeitos.
4. Limitar iterações e detectar ciclos de tool sem progresso.
5. Mapear erros de execução de tool para mensagens `tool` result.
6. Rever segurança multi-tenant em cada tool que acede a dados.
7. Testes com respostas sintéticas do modelo contendo `tool_calls`.

## Links oficiais

- https://platform.openai.com/docs
- https://openai.github.io/openai-agents-python/

## Anti-padrões

- Expor operações privilegiadas só pela descrição da tool.
- Handoffs sem estado mínimo compartilhado entre agentes.
- Misturar SDK de agentes com fluxo legacy sem fronteira clara.

## Ligação ONCONAV

O produto prioriza invariantes clínicos no pipeline actual; novos agentes OpenAI devem respeitar o mesmo contrato com o backend ao emitir acções.
