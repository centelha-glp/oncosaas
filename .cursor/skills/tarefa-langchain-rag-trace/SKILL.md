---
name: tarefa-langchain-rag-trace
description: Encaixa retrievers e document loaders LangChain e configura traços mínimos (ex. LangSmith). Use quando o pedido citar BaseRetriever, loaders, LangSmith ou observabilidade de chains. Para corpus FAISS ONCONAV usar agente-rag-engineer.
disable-model-invocation: true
---

# LangChain — retrieval leve e observabilidade

## Objectivo

Ligar componentes de retrieval do LangChain ao pipeline sem duplicar a política de corpus interna do ONCONAV.

## Quando usar

- LC4/LC5: prototipagem RAG com abstracções LangChain ou visibilidade de execução.

## Passos

1. Confirmar se o escopo é **genérico LangChain** ou **corpus ONCONAV**; se for o segundo, envolver `rag-engineer` e ler `agente-rag-engineer/SKILL.md`.
2. Escolher loader/retriever adequado ao tipo de documento e tamanho.
3. Definir top-k, score threshold e formato de contexto injectado no prompt.
4. Para LangSmith (ou similar), configurar variáveis de ambiente e projecto; não enviar PII em traces de produção.
5. Medir latência de retrieval vs geração.
6. Testar com corpus pequeno fixo antes de integrar produção.
7. Documentar limitações conhecidas (idioma, truncagem).

## Links oficiais

- https://python.langchain.com/docs/
- LangSmith: https://docs.smith.langchain.com/ (quando aplicável)

## Anti-padrões

- Substituir o índice FAISS e regras de `ai-service` sem revisão de `rag-engineer`.
- Traces com conteúdo clínico completo em ambientes partilhados.

## Ligação ONCONAV

O RAG de produção do ONCONAV vive no `ai-service` com corpus oncológico dedicado; esta skill cobre integração LangChain, não a titularidade do índice interno.
