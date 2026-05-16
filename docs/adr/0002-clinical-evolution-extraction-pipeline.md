# ADR 0002 — Extração estruturada da evolução assinada (pipeline assíncrono)

## Status

Aceite — implementação inicial (fatia vertical).

## Contexto

Após assinatura (`SIGNED`) da evolução em `ClinicalNote`, o produto precisa inferir dados estruturados para o prontuário com idempotência, auditoria mínima (hash, sem PHI completo no run), aplicação parcial com relatório de rejeições e desfazer numa janela configurável.

## Decisão

1. **Transporte assíncrono**: BullMQ + Redis (`clinical-note-extraction`), produtor em `ClinicalNotesService.sign` após `update` bem-sucedido.
2. **Orquestração de escrita**: NestJS (`EvolutionStructuringService`) carrega nota/versão, descriptografa Markdown, chama o ai-service via HTTP (`getAiServiceConfig` + `getAiServiceHeadersWithTenant`), aplica mutações com Prisma e persiste ledger para undo.
3. **ai-service**: rota dedicada `POST /api/v1/clinical-evolution/structure` (autenticação `BACKEND_SERVICE_TOKEN`), contrato Pydantic versionado (`extraction_schema_version`). **v2**: com chaves LLM, uma chamada `llm_provider.generate` + JSON (exames, medicamentos, comorbidades, `patient_patch`); sem chaves, resposta vazia determinística. Validação forte e writes ficam no Nest.
4. **Intervention**: tipo enum existente **`NOTE_ADDED`** — registo operacional de alteração ao prontuário ligada à nota/run (sem nova migration de enum).
5. **Idempotência**: `@@unique([clinicalNoteId, sectionsContentHash])` em `ClinicalNoteExtractionRun`.

## Consequências

- Redis torna-se dependência obrigatória do worker Nest em todos os ambientes que processam a fila.
- Novos domínios no JSON do ai-service exigem extensão coordenada do aplicador Nest + testes por módulo.

## Referências

- Plano: `assistente_extração_evolução_*.plan.md`
- Modelos: `backend/prisma/schema.prisma` (`ClinicalNoteExtractionRun`, `ClinicalNoteExtractionLedgerLine`)
