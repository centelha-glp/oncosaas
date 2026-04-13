# Documentação ONCONAV

> **Última atualização:** 2026-04-13 (datas `2024-01-XX` normalizadas em guias; ver secção [Migrações](#migrações-de-ficheiros-2026-04-13); índices em [`api/`](api/), [`fhir/`](fhir/), [`ia-modelo-priorizacao/`](ia-modelo-priorizacao/))  

Este diretório concentra documentação **funcional**, **técnica** e **de pesquisa**. A **fonte de verdade** para versões de stack, portas, variáveis de ambiente e arranque rápido continua a ser o [`README.md`](../README.md) na raiz do repositório.

## Mapa por pasta

| Pasta | Conteúdo típico |
|--------|-------------------|
| [`api/`](api/) | Mapa de contratos (Nest vs AI Service), onde está o OpenAPI/Swagger |
| [`arquitetura/`](arquitetura/) | ADRs, diagramas, stack, FHIR, tempo real |
| [`banco-dados/`](banco-dados/) | ERD, PostgreSQL, referência rápida |
| [`desenvolvimento/`](desenvolvimento/) | Guias de API, setup, integrações, implementações |
| [`fhir/`](fhir/) | Índice HL7/FHIR (textos completos em `arquitetura/`) |
| [`ia-modelo-priorizacao/`](ia-modelo-priorizacao/) | Modelo LightGBM, priorização; [README](ia-modelo-priorizacao/README.md) com ordem de leitura (IA/agente) |
| [`pesquisa/`](pesquisa/) | CEP/EBSERH, TCLE, metodologia |
| [`producao/`](producao/) | Runbooks, segurança operacional |
| [`centelha-espirito-santo/`](centelha-espirito-santo/) | Textos e formulários Centelha ES |
| Outros (`analise-dashboard/`, `sistema-alertas/`, …) | Especificações por tema |

## Migrações de ficheiros (2026-04-13)

| Antes (`docs/…`) | Depois |
|------------------|--------|
| `integracao-fhir-completa.md` | [`arquitetura/integracao-fhir-completa.md`](arquitetura/integracao-fhir-completa.md) |
| `integracao-fhir-resumo.md` | [`arquitetura/integracao-fhir-resumo.md`](arquitetura/integracao-fhir-resumo.md) |
| `integracao-fhir-explicacao.md` | [`arquitetura/integracao-fhir-explicacao.md`](arquitetura/integracao-fhir-explicacao.md) |
| `ia-multiagente-detalhes.md` | [`arquitetura/ia-multiagente-detalhes.md`](arquitetura/ia-multiagente-detalhes.md) |
| `env-vars-classification.md` | [`desenvolvimento/env-vars-classification.md`](desenvolvimento/env-vars-classification.md) |
| `business-rules-roadmap.md` | [`planejamento/business-rules-roadmap.md`](planejamento/business-rules-roadmap.md) |

## Ficheiros na raiz de `docs/`

- [`README.md`](README.md) — este índice  
- [`INFRA.md`](INFRA.md) — **redirecionamento** para o runbook em [`producao/INFRA.md`](producao/INFRA.md) (mantido para atalhos antigos)  

O conteúdo completo de infraestrutura/hardening está em **`producao/INFRA.md`**.

Para novos documentos, use o subdiretório temático; a navegação central é este ficheiro e o [`README.md`](../README.md) na raiz do repositório.

## Entregas recentes

- [`desenvolvimento/resumo-entregas-chats-abr-2026.md`](desenvolvimento/resumo-entregas-chats-abr-2026.md) — registo de PRs e âmbito (abril/2026).

## Stack atual (resumo)

- Frontend: Next.js 15, React 19  
- Backend: NestJS 11, Prisma, PostgreSQL  
- AI Service: FastAPI, LightGBM, FAISS/RAG  

Detalhe: [`arquitetura/stack-tecnologico.md`](arquitetura/stack-tecnologico.md).
