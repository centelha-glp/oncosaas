---
name: tarefa-langchain-compose
description: Compõe pipelines LCEL com Runnable, branches e paralelismo; prompt templates, parsers e memória de conversa em LangChain. Use quando o pedido citar LCEL, RunnableSequence, RunnableParallel, ChatPromptTemplate ou ConversationBufferMemory.
disable-model-invocation: true
---

# LangChain — composição LCEL e memória

## Objectivo

Construir cadeias legíveis, testáveis e com separação clara entre formatação de prompt, modelo e pós-processamento.

## Quando usar

- LC1/LC2: encadeamento de passos sem grafo LangGraph dedicado.

## Passos

1. Consultar https://python.langchain.com/docs/ para o padrão LCEL actual do projecto.
2. Modelar o fluxo como `Runnable` explícitos; usar `|` para sequência e `RunnableParallel` quando fizer sentido.
3. Externalizar prompts em `ChatPromptTemplate` com variáveis nomeadas e validação.
4. Escolher parser de saída (StrOutputParser, JsonOutputParser, etc.) coerente com o contrato downstream.
5. Para memória, limitar janela ou resumir para controlar tokens.
6. Testar entradas vazias, limites de tamanho e caracteres especiais.
7. Documentar dependências opcionais (integrações) no `pyproject`/`requirements`.

## Links oficiais

- https://python.langchain.com/docs/

## Anti-padrões

- Cadeias gigantes num único ficheiro sem testes.
- Misturar I/O de rede dentro de funções que deveriam ser puras de transformação.
- Memória ilimitada em conversas longas sem política de truncagem.

## Ligação ONCONAV

Conteúdo clínico em prompts segue LGPD e minimização; não embutir dados reais de paciente em exemplos versionados.
