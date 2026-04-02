---
name: fhir
description: Aciona o agente fhir-integration para tarefas de integração HL7/FHIR R4 com sistemas hospitalares
---

# Skill: /fhir

## Descrição

Aciona o agente `fhir-integration` para implementar ou manter a integração HL7/FHIR R4 entre o ONCONAV e sistemas hospitalares externos (HIS/PEP).

## Uso

```
/fhir [contexto ou tarefa]
```

### Exemplos

- `/fhir mapear Patient para FHIR R4` — implementa o transformer de paciente
- `/fhir configurar sync bidirecional para tenant HUCAM` — configura sincronização
- `/fhir debugar sync de observações falhando` — diagnóstico de falha
- `/fhir adicionar suporte a recurso Condition` — expande recursos suportados
- `/fhir validar bundle de sincronização` — valida payload FHIR

## O que faz

1. Lê a configuração FHIR existente em `backend/src/integrations/fhir/`
2. Implementa ou corrige mapeamentos FHIR R4 (Patient, Observation, Condition, Bundle)
3. Configura autenticação multi-método (OAuth2, Basic, API Key)
4. Garante retry com exponential backoff para chamadas ao EHR
5. Valida isolamento de tenant em todas as operações de sync
6. Nunca expõe credenciais — sempre criptografadas via `encryptSensitiveData`

## Recursos FHIR suportados

| Recurso | Status |
|---------|--------|
| Patient | Implementado |
| Observation | Implementado |
| Bundle | Implementado |
| Condition | A implementar |
| MedicationRequest | A implementar |

## Referências

- Rules: `.cursor/rules/fhir-integration.mdc`
- Módulo: `backend/src/integrations/fhir/`
- Transformer: `backend/src/integrations/fhir/services/fhir-transformer.service.ts`
