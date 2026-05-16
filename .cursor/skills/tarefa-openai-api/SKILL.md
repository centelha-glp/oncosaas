---
name: tarefa-openai-api
description: Usa cliente OpenAI oficial com streaming, retries e structured outputs ou JSON schema. Use quando o pedido citar OpenAI Python SDK, AsyncOpenAI, streaming, response_format ou structured outputs.
disable-model-invocation: true
---

# OpenAI — cliente, streaming e structured outputs

## Objectivo

Chamadas robustas à API OpenAI com contratos de resposta explícitos.

## Quando usar

- OP1/OP2: integração base ou formato de saída estruturado.

## Passos

1. Ler https://platform.openai.com/docs para a superfície correcta (Chat Completions vs Responses) do projecto.
2. Instanciar cliente com timeout e chave via env; nunca hardcode.
3. Para streaming, consumir iterator/async iterator e propagar cancelamento.
4. Implementar retries com backoff para `rate_limit` e erros 5xx transitórios.
5. Para structured outputs, alinhar schema JSON ao validador (ex.: Pydantic) downstream.
6. Registar `model`, `usage` em logs agregados sem conteúdo clínico completo.
7. Testes com `pytest` + mocks HTTP ou biblioteca de mock oficial quando disponível.

## Links oficiais

- https://platform.openai.com/docs
- SDK Python: documentação ligada a partir do site acima

## Anti-padrões

- Ignorar limites de TPM/RPM em loops.
- Structured output sem validação local do JSON.
- Logar prompts/respostas com dados de saúde identificáveis.

## Ligação ONCONAV

Seguir `onconav-core` e políticas de secrets; o `ai-service` já orquestra LLMs — alinhar mudanças com `agente-ai-service` quando tocar em rotas ou config.
