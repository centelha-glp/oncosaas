---
name: tarefa-anthropic-tools-structured
description: Configura tool_use e tool_choice na API Anthropic e saídas estruturadas JSON. Use quando o pedido citar tool_use, tool_result, tool_choice ou schema JSON com Claude.
disable-model-invocation: true
---

# Anthropic — tool use e saídas estruturadas

## Objectivo

Fluxos multi-turn com ferramentas e JSON fiável alinhado à API actual.

## Quando usar

- AN3/AN4: modelo deve invocar tools ou devolver JSON validável.

## Passos

1. Ler secção de tool use em https://docs.anthropic.com/
2. Definir `tools` com `name`, `description`, `input_schema` (JSON Schema) estritos.
3. Escolher `tool_choice` (`auto`, `any`, `tool`, `none`) conforme risco e necessidade.
4. Após `tool_use`, enviar `tool_result` com `tool_use_id` correspondente.
5. Para JSON estruturado, combinar com instruções de sistema e validação Pydantic no servidor.
6. Limitar número de voltas tool para controlar custo.
7. Testes com sequências fixas de `tool_use` simuladas.

## Links oficiais

- https://docs.anthropic.com/

## Anti-padrões

- `tool_result` fora de ordem ou com id incorrecto.
- Confiar no JSON do modelo sem validação local.
- Tools que alteram dados sem checagem de tenant.

## Ligação ONCONAV

Autorização e dados clínicos continuam no backend; tools só executam operações já aprovadas pelo desenho de API interna.
