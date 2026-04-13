# Protótipo de Modelo de Priorização de Casos

## Objetivo

Desenvolver modelo de machine learning que prioriza pacientes oncológicos baseado em múltiplos fatores clínicos e dados coletados via WhatsApp.

## Features do Modelo

### Features de Entrada

**Dados Clínicos**:

- Tipo de câncer (categorical)
- Estadiamento (TNM ou estágio)
- Performance status (ECOG, Karnofsky)
- Comorbidades (lista)
- Idade
- Tempo desde diagnóstico

**Dados de Sintomas (via WhatsApp)**:

- Escala de dor (0-10)
- Escala de náusea (0-10)
- Escala de fadiga (0-10)
- Escala de dispneia (0-10)
- Outros sintomas (lista)

**Dados Temporais**:

- Tempo desde última consulta (dias)
- Tempo desde último exame (dias)
- Tempo desde início do tratamento (dias)
- Próxima consulta agendada (dias)

**Dados de Tratamento**:

- Tipo de tratamento (quimioterapia, radioterapia, cirurgia)
- Ciclo atual / total de ciclos
- Protocolo de tratamento
- Efeitos adversos recentes

**Dados de Engajamento**:

- Última interação com agente WhatsApp (dias)
- Taxa de resposta ao agente (%)
- Número de alertas gerados

### Features Derivadas

**Score de Sintomas**:

- Soma ponderada de sintomas
- Sintoma mais severo
- Mudança em relação ao baseline

**Score de Risco**:

- Risco de complicação (baseado em tipo de câncer + tratamento)
- Risco de readmissão
- Risco de atraso no tratamento

### Target (Saída)

**Score de Prioridade**: 0-100

- **0-20**: Baixa prioridade
- **21-50**: Média prioridade
- **51-75**: Alta prioridade
- **76-100**: Crítica

**Categoria**:

- `critico`: Casos que precisam atenção imediata
- `alto`: Casos que precisam atenção em 24-48h
- `medio`: Casos que precisam atenção em 1 semana
- `baixo`: Casos de rotina

**Razão da Priorização**:

- Explicação do score (explicabilidade)

## Dataset Sintético

### Geração de Dados

**Distribuição Realista**:

- Tipos de câncer comuns: mama, pulmão, colorretal, próstata
- Estadiamentos: I, II, III, IV (distribuição realista)
- Performance status: 0-4 (distribuição realista)
- Sintomas: distribuição baseada em literatura

**Exemplo de Dados**:

```python
import pandas as pd
import numpy as np

# Gerar dados sintéticos
n_samples = 1000

data = {
    'cancer_type': np.random.choice(
        ['mama', 'pulmao', 'colorectal', 'prostata', 'kidney', 'bladder', 'testicular'],
        n_samples,
        p=[0.25, 0.20, 0.20, 0.15, 0.08, 0.08, 0.04]
    ),
    'stage': np.random.choice(['I', 'II', 'III', 'IV'], n_samples, p=[0.2, 0.3, 0.3, 0.2]),
    'performance_status': np.random.choice([0, 1, 2, 3, 4], n_samples, p=[0.3, 0.3, 0.2, 0.15, 0.05]),
    'age': np.random.normal(60, 15, n_samples).astype(int),
    'pain_score': np.random.choice(range(11), n_samples, p=[0.2, 0.15, 0.1, 0.1, 0.1, 0.1, 0.1, 0.05, 0.05, 0.03, 0.02]),
    'nausea_score': np.random.choice(range(11), n_samples),
    'fatigue_score': np.random.choice(range(11), n_samples),
    'days_since_last_visit': np.random.exponential(30, n_samples).astype(int),
    'treatment_cycle': np.random.choice(range(1, 9), n_samples),
}

df = pd.DataFrame(data)
```

### Labels Sintéticos (Prioridade)

**Regras de Negócio para Labels**:

```python
def calculate_priority_label(row):
    score = 0

    # Critérios críticos
    if row['pain_score'] >= 8:
        score += 30
    if row['stage'] == 'IV':
        score += 20
    if row['performance_status'] >= 3:
        score += 25
    if row['days_since_last_visit'] > 60:
        score += 15

    # Critérios de alta prioridade
    if row['pain_score'] >= 6:
        score += 15
    if row['nausea_score'] >= 7:
        score += 10
    if row['stage'] == 'III':
        score += 10

    # Normalizar para 0-100
    score = min(100, score)

    # Categorizar
    if score >= 75:
        category = 'critico'
    elif score >= 50:
        category = 'alto'
    elif score >= 25:
        category = 'medio'
    else:
        category = 'baixo'

    return score, category

df['priority_score'], df['priority_category'] = zip(*df.apply(calculate_priority_label, axis=1))
```

## Modelo de Machine Learning

> **Produção no repositório:** o AI Service usa **LightGBM** para priorização (artefato e features alinhados ao contrato de produto). O texto abaixo descreve um **protótipo exploratório** com ensemble; não confundir com o único caminho de deploy.

### Abordagem: Ensemble

**Modelos Base**:

1. **Random Forest**: Bom para features categóricas e não-lineares
2. **XGBoost**: Alta performance, lida bem com dados faltantes (alternativa em experimentação)
3. **LightGBM**: Rápido, eficiente em memória — **alinhado ao modelo em produção**

**Ensemble**:

- Voting ou Stacking
- Pesos baseados em performance

### Implementação

```python
from sklearn.ensemble import RandomForestRegressor, VotingRegressor
from xgboost import XGBRegressor
from lightgbm import LGBMRegressor
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import mean_absolute_error, r2_score

# Preparar dados
X = df[['cancer_type', 'stage', 'performance_status', 'age',
        'pain_score', 'nausea_score', 'fatigue_score',
        'days_since_last_visit', 'treatment_cycle']]
y = df['priority_score']

# Encoding categórico
le_cancer = LabelEncoder()
le_stage = LabelEncoder()
X['cancer_type_encoded'] = le_cancer.fit_transform(X['cancer_type'])
X['stage_encoded'] = le_stage.fit_transform(X['stage'])
X = X.drop(['cancer_type', 'stage'], axis=1)

# Split
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# Modelos
rf = RandomForestRegressor(n_estimators=100, max_depth=10, random_state=42)
xgb = XGBRegressor(n_estimators=100, max_depth=6, random_state=42)
lgbm = LGBMRegressor(n_estimators=100, max_depth=6, random_state=42)

# Ensemble
ensemble = VotingRegressor([
    ('rf', rf),
    ('xgb', xgb),
    ('lgbm', lgbm)
], weights=[0.3, 0.4, 0.3])

# Treinar
ensemble.fit(X_train, y_train)

# Avaliar
y_pred = ensemble.predict(X_test)
mae = mean_absolute_error(y_test, y_pred)
r2 = r2_score(y_test, y_pred)

print(f"MAE: {mae:.2f}")
print(f"R²: {r2:.2f}")
```

### Explicabilidade

**SHAP Values**:

```python
import shap

# Explicar predições
explainer = shap.TreeExplainer(ensemble)
shap_values = explainer.shap_values(X_test)

# Visualizar
shap.summary_plot(shap_values, X_test)
```

**Feature Importance**:

- Identificar features mais importantes
- Usar para explicar razão da priorização

### Categorização

```python
def categorize_priority(score):
    if score >= 75:
        return 'critico'
    elif score >= 50:
        return 'alto'
    elif score >= 25:
        return 'medio'
    else:
        return 'baixo'
```

## Métricas de Validação

### Métricas de Regressão

- **MAE (Mean Absolute Error)**: Erro médio absoluto
- **RMSE (Root Mean Squared Error)**: Erro quadrático médio
- **R²**: Coeficiente de determinação

### Métricas de Classificação (Categoria)

- **Accuracy**: Acurácia
- **Precision**: Precisão por categoria
- **Recall**: Recall por categoria
- **F1-Score**: F1 por categoria
- **Confusion Matrix**: Matriz de confusão

### Validação Clínica

**Avaliação com Oncologistas**:

1. Apresentar casos com scores do modelo
2. Comparar com priorização manual dos médicos
3. Calcular concordância (Kappa)

**Métricas Clínicas**:

- **Sensibilidade**: % de casos críticos detectados
- **Especificidade**: % de casos não-críticos corretamente classificados
- **PPV (Positive Predictive Value)**: % de casos críticos que realmente precisam atenção

## Pipeline de Produção

### Treinamento

1. Coletar dados de produção
2. Feature engineering
3. Treinar modelo
4. Validação
5. Deploy (se melhor que modelo atual)

### Inferência

```python
# API endpoint
@app.post("/api/v1/prioritize")
async def prioritize_patient(patient_data: PatientData):
    # Feature engineering
    features = prepare_features(patient_data)

    # Predição
    score = model.predict(features)
    category = categorize_priority(score)

    # Explicação
    explanation = generate_explanation(features, score)

    return {
        "priority_score": float(score),
        "priority_category": category,
        "reason": explanation
    }
```

### Atualização Contínua

- **Online Learning**: Atualizar modelo com novos dados
- **Retreinamento**: Retreinar periodicamente (semanal/mensal)
- **A/B Testing**: Testar novos modelos

## Próximos Passos

1. Gerar dataset sintético maior (10k+ amostras)
2. Implementar modelo ensemble
3. Treinar e avaliar
4. Validar com oncologistas
5. Implementar API de inferência
6. Integrar com backend
