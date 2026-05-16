---
name: tarefa-crewai-tasks-tools
description: Define Task no CrewAI com contexto, expected_output, tools Python e callbacks. Use quando o pedido citar Task, expected_output, crew tools ou output estruturado da crew.
disable-model-invocation: true
---

# CrewAI — tasks, tools e outputs

## Objectivo

Ligar trabalho granular a agentes com contratos de saída e ferramentas seguras.

## Quando usar

- CR2/CR3: detalhe de tasks, integração de tools e callbacks.

## Passos

1. Consultar https://docs.crewai.com/ para assinatura de `Task` e passagem de `context`.
2. Ordenar dependências entre tasks; usar outputs anteriores como entrada explícita quando suportado.
3. Escrever `expected_output` mensurável (formato, campos, exemplos curtos).
4. Implementar tools como funções tipadas com validação de argumentos.
5. Tratar falhas de tool com mensagem clara para o agente e fallback.
6. Usar callbacks para métricas sem logar PII.
7. Testar crew com dataset mínimo e verificar formato final.

## Links oficiais

- https://docs.crewai.com/

## Anti-padrões

- `expected_output` ambíguo que o LLM não consegue verificar.
- Tools com efeitos colaterais sem idempotência ou sem controlo de tenant.
- Contexto excessivo que estoura janela de tokens.

## Ligação ONCONAV

Dados por tenant e decisões clínicas persistem via serviços NestJS/Prisma conforme arquitectura; tools acedem a APIs internas com token de serviço, não com credenciais em texto claro.
