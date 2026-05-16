---
name: tarefa-langchain-agents-tools
description: Configura tool calling com bind_tools e agentes ReAct ou equivalentes no ecossistema LangChain Python. Use quando o pedido citar bind_tools, tool_choice, create_react_agent ou agent executor.
disable-model-invocation: true
---

# LangChain — agentes e ferramentas

## Objectivo

Loops agente–ferramenta seguros com contratos de entrada/saída explícitos e tratamento de erros.

## Quando usar

- LC3: agente com uma ou mais tools Python expostas ao modelo.

## Passos

1. Ler secção de tools/agents em https://python.langchain.com/docs/
2. Definir schemas de tool (nome, descrição, args) alinhados ao que o modelo consegue preencher.
3. Usar `bind_tools` ou API equivalente da versão instalada; testar chamadas paralelas se activadas.
4. Limitar iterações máximas do loop agente–tool para evitar custo infinito.
5. Mapear erros de tool para mensagens úteis ao modelo e ao utilizador.
6. Validar permissões: tools não devem expor operações cross-tenant.
7. Testes com mocks de modelo que devolvem `tool_calls` fixos.

## Links oficiais

- https://python.langchain.com/docs/

## Anti-padrões

- Tools com efeitos irreversíveis sem confirmação no domínio ONCONAV.
- Ignorar formato de resposta do modelo quando `tool_calls` vêm vazios.
- Misturar lógica de autorização só no LLM.

## Ligação ONCONAV

Autorização e `tenantId` confiável vêm do backend; tools que acedem a dados sensíveis devem validar contexto injectado pelo servidor, não confiar no texto do utilizador.
