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

## Referências

- Template existente: `backend/src/clinical-protocols/templates/colorectal.protocol.ts`
- Protocol engine: `ai-service/src/agent/protocol_engine.py`
- Symptom analyzer: `ai-service/src/agent/symptom_analyzer.py`
