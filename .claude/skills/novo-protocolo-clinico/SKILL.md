---
name: novo-protocolo-clinico
description: Cria novo protocolo clínico oncológico com regras e scores no ai-service
---

# Skill: /novo-protocolo-clinico

## Descrição

Cria um novo protocolo clínico para um tipo de câncer, sincronizando backend (TypeScript) e AI Service (Python).

## Uso

```
/novo-protocolo-clinico <tipo-de-cancer>
```

Exemplo: `/novo-protocolo-clinico mama` (breast cancer)

## O que faz

### 1. Backend: Template de Protocolo

Cria `backend/src/clinical-protocols/templates/<tipo>.protocol.ts` seguindo o padrão existente:

```typescript
export const <TIPO>_PROTOCOL = {
  cancerType: '<tipo>',
  name: 'Protocolo de Navegação - Câncer de <Tipo>',
  journeyStages: {
    SCREENING: { steps: [...] },
    DIAGNOSIS: { steps: [...] },
    TREATMENT: { steps: [...] },
    FOLLOW_UP: { steps: [...] },
  },
  checkInRules: {
    SCREENING: { frequency: 'weekly', questionnaire: null },
    DIAGNOSIS: { frequency: 'twice_weekly', questionnaire: null },
    TREATMENT: { frequency: 'daily', questionnaire: 'ESAS' },
    FOLLOW_UP: { frequency: 'weekly', questionnaire: 'PRO_CTCAE' },
  },
  criticalSymptoms: [...],
  riskAdjustment: {...},
};
```

### 2. AI Service: Regras do Protocolo

Adiciona ao `ai-service/src/agent/protocol_engine.py` no dicionário `PROTOCOL_RULES`:

```python
"<tipo>": {
    "SCREENING": { "check_in_frequency": "weekly", ... },
    "DIAGNOSIS": { "check_in_frequency": "twice_weekly", ... },
    "TREATMENT": { "check_in_frequency": "daily", "questionnaire": "ESAS", ... },
    "FOLLOW_UP": { "check_in_frequency": "weekly", "questionnaire": "PRO_CTCAE", ... },
}
```

### 3. AI Service: Sintomas Críticos

Adiciona keywords de sintomas específicos ao `ai-service/src/agent/symptom_analyzer.py`.

### 4. Registrar no index de protocolos

### 5. AI Service: Novos intents e steps (quando necessário)

Se o protocolo introduz novos intents de navegação ou steps no pipeline do agente:
- `llm-agent-architect` — para adicionar novo intent ao `intent_classifier.py`, novo fast-path ou novo step ao pipeline do orchestrator
- `llm-context-engineer` — para atualizar `build_orchestrator_prompt()` e as regras de detecção de sintomas em `system_prompt.py` para refletir os sintomas críticos do novo tipo de câncer

## Fluxo obrigatório

```
novo-protocolo-clinico
    → clinical-domain      (validação clínica: limiares, criticalSymptoms, checkInRules)
    → (se novos intents/steps no ai-service)
        llm-agent-architect   (arquitetura do novo intent/step)
        llm-context-engineer  (atualizar prompts e regras de detecção de sintomas)
    → test-generator
    → seguranca-compliance
    → github-organizer
```

## ⚠️ Atenção — MVP

O MVP foca exclusivamente em **câncer de bexiga**. Novos protocolos devem ser criados com `enabledCancerTypes` configurado como `false` no tenant — **nunca ativar em produção sem revisão clínica completa e aprovação do time de produto**.

## Referências

- Template existente: `backend/src/clinical-protocols/templates/colorectal.protocol.ts`
- Protocol engine: `ai-service/src/agent/protocol_engine.py`
- Symptom analyzer: `ai-service/src/agent/symptom_analyzer.py`
- Rules: `.claude/rules/clinical-domain.md`, `.claude/rules/llm-agent-architect.md`, `.claude/rules/llm-context-engineer.md`
