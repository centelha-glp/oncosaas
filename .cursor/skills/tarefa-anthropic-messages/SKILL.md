---
name: tarefa-anthropic-messages
description: Usa Messages API da Anthropic com blocos system, gestão de contexto longo e prompt caching. Use quando o pedido citar Messages API, Claude, prompt caching ou cache_control.
disable-model-invocation: true
---

# Anthropic — Messages e caching

## Objectivo

Conversas corretas com Claude, uso disciplinado de contexto e caching para custo/latência.

## Quando usar

- AN1/AN2: integração base ou otimização de contexto.

## Passos

1. Ler https://docs.anthropic.com/ para formato de mensagens e limites do modelo escolhido.
2. Estruturar `system` (estático vs dinâmico) conforme boas práticas de caching da doc.
3. Controlar tamanho da história: truncar, resumir ou arquivar mensagens antigas.
4. Validar tipos de bloco (`text`, `tool_use`, `tool_result`) em cada turno.
5. Configurar `max_tokens` e `temperature` alinhados ao caso de uso.
6. Tratar erros `overloaded` / rate limit com backoff.
7. Testes com fixture de mensagens multi-turn.

## Links oficiais

- https://docs.anthropic.com/

## Anti-padrões

- System gigante mutável que invalida cache em todo pedido.
- Histórico ilimitado até estourar contexto sem política.
- Logar blocos completos com dados sensíveis.

## Ligação ONCONAV

Dados de saúde: minimização e bases legais conforme política interna; alinhar com `seguranca-compliance` em mudanças sensíveis.
