---
name: modelo
description: Aciona o agente data-scientist para treino, avaliação e evolução do modelo LightGBM de priorização oncológica
---

# Skill: /modelo

## Descrição

Aciona o agente `data-scientist` para tarefas de ciência de dados e machine learning: análise exploratória, feature engineering, treino/avaliação do modelo LightGBM, validação de scores clínicos e análise de bias.

## Uso

```
/modelo [tarefa ou contexto]
```

### Exemplos

- `/modelo retreinar com dados reais` — treino com blend de dados reais + sintéticos
- `/modelo avaliar performance do modelo atual` — métricas sem retreinar
- `/modelo adicionar feature de delta_ecog` — nova feature nas 32 canônicas
- `/modelo analisar bias por tipo de câncer` — análise de equidade
- `/modelo validar MASCC e CISNE contra dados clínicos` — validação de scores

## O que faz

1. Lê `ai-service/src/models/priority_model.py` e `train_model.py`
2. Para retreino: executa pipeline com dados fornecidos
3. Para nova feature: atualiza `FEATURE_COLUMNS`, `extract_features()`, schema e retreina
4. Avalia métricas (accuracy, precision, recall por classe, AUC)
5. Detecta bias em grupos clínicos (tipo de câncer, ECOG, faixa etária)

## Comandos de retreino

```bash
# Sintético (5000 amostras)
python -m scripts.train_model

# Blendando dados reais (peso 3x)
python -m scripts.train_model --real data.json

# Avaliar sem retreinar
python -m scripts.train_model --eval
```

## 5 classes de saída (ordinal)

| idx | Disposition |
|-----|-------------|
| 0 | REMOTE_NURSING |
| 1 | SCHEDULED_CONSULT |
| 2 | ADVANCE_CONSULT |
| 3 | ER_DAYS |
| 4 | ER_IMMEDIATE |

## Regra crítica ao adicionar feature

Qualquer nova feature exige atualizar **todos** os 4 pontos:
1. `FEATURE_COLUMNS` em `priority_model.py`
2. `extract_features()` em `priority_model.py`
3. Schema `PredictRiskRequest` em `schemas.py`
4. Mapeamento em `routes/risk.py`
5. Retreino e incremento de `modelVersion`

## Referências

- Rules: `.claude/rules/ai-service.md` (seção 3)
- Modelo: `ai-service/src/models/priority_model.py`
- Treino: `ai-service/scripts/train_model.py`
- Scores: `ai-service/src/agent/clinical_scores.py`
