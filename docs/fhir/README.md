# HL7 / FHIR — índice e ordem de leitura

> **Última atualização:** 2026-04-13  

A implementação no código está em `backend/src/integrations/fhir/`. Os documentos descritivos ficam em [`../arquitetura/`](../arquitetura/). Use esta página para **navegar em sequência** sem duplicar conteúdo.

## Ordem sugerida

| Passo | Documento | Quando usar |
|-------|-----------|-------------|
| 1 | [`integracao-fhir-resumo.md`](../arquitetura/integracao-fhir-resumo.md) | Visão rápida do que existe (serviços, endpoints, sync) |
| 2 | [`integracao-fhir-explicacao.md`](../arquitetura/integracao-fhir-explicacao.md) | Contexto e fluxos em mais detalhe |
| 3 | [`integracao-hl7-fhir.md`](../arquitetura/integracao-hl7-fhir.md) | Especificação HL7 v2 + FHIR (mensagens, recursos) |
| 4 | [`integracao-fhir-completa.md`](../arquitetura/integracao-fhir-completa.md) | Referência ampla da integração |

## API REST (Nest)

Rotas sob **`/api/v1/fhir`** e **`/api/v1/fhir/config`** — ver mapa geral em [`../api/contratos-api.md`](../api/contratos-api.md). Exemplos com **cURL** e tabelas de métodos: [`../desenvolvimento/testar-endpoints.md`](../desenvolvimento/testar-endpoints.md) (secção **FHIR (integração)**).

## Manutenção

Novos documentos FHIR devem continuar em `docs/arquitetura/` com nomes `integracao-fhir-*.md` ou `integracao-hl7-fhir.md`; atualize a tabela acima se adicionar um guia novo.
