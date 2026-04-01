---
name: squad-ia-dados
description: Squad IA/Dados — inteligência artificial e ciência de dados do ONCONAV
---

# Squad IA/Dados

Equipe responsável pelo agente conversacional, modelo de priorização e pipeline de dados do ONCONAV.

## Teammates

### ai-service
Papel: FastAPI, agente conversacional, orchestrator e pipeline ML.
Responsabilidades:
- Manter o orchestrator de 4 camadas (regras → scores → ML → fallback)
- Implementar novos endpoints FastAPI
- Integrar novas regras clínicas no `clinical_rules.py`
- Manter o agente conversacional e prompts

### data-scientist
Papel: LightGBM, feature engineering, MASCC/CISNE e bias em modelos.
Responsabilidades:
- Evoluir o modelo ordinal LightGBM (5 classes ClinicalDisposition)
- Manter o vetor de 32 features em `extract_features()`
- Analisar bias (subrepresentação de tipos de câncer, gênero)
- Avaliar performance: precision/recall por classe, AUC-ROC, under-triage rate

## Coordenação

1. **data-scientist** projeta features e valida metodologia ML
2. **ai-service** implementa no código FastAPI
3. **data-scientist** valida os resultados e métricas de saída

## Quando acionar este squad

- Evoluir o modelo de priorização
- Ajustar regras clínicas no ai-service
- Analisar dados de retreino via `ClinicalDispositionFeedback`
- Validar scores clínicos (MASCC/CISNE)
- Investigar taxa de under-triage ou over-triage
- Adicionar novo tipo de câncer ao pipeline
