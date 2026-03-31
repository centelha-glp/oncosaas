# ai-service — Rules & Patterns

Rules extraídas do código real em `ai-service/src/`. Qualquer alteração neste serviço deve obedecer estas convenções.

---

## 1. Estrutura do Agente Conversacional

O ponto de entrada é `AgentOrchestrator.process()` em `src/agent/orchestrator.py`. O método recebe um dict com `message`, `patient_id`, `tenant_id`, `clinical_context`, `protocol`, `conversation_history`, `agent_state` e `agent_config`, e retorna `response`, `actions`, `symptom_analysis`, `new_state`, `decisions`.

### Ordem obrigatória dos steps no pipeline principal

```
1.   Questionnaire fast-path    — agent_state["active_questionnaire"] presente
1.5. Intent classification      — intent_classifier.classify_async()
     Fast-paths: EMERGENCY → _build_emergency_response()
                 GREETING   → _build_greeting_response()
                 APPOINTMENT_QUERY → _build_appointment_response()

2.   Symptom analysis           — symptom_analyzer.analyze()   (keyword + LLM opcional)
2.5. Layer 1 — Clinical rules   — clinical_rules_engine.evaluate()   ← PRE-ML, obrigatório
3.   Protocol evaluation        — protocol_engine.evaluate()
4.   RAG context build          — context_builder.build_with_rag()
5.   Multi-agent LLM pipeline   — llm_provider.run_agentic_loop()   (se LLM disponível)
6.   Fallback se sem chaves      — llm_provider._fallback_response()
7.   Action compilation         — merge rules actions + LLM tool-call actions
```

Cada step é envolvido por um span de tracer: `tracer.start_span(trace, "nome_do_step")` / `span.finish(...)`.

### Regras do pipeline

- A ordem dos steps é invariante de segurança. **Nunca mova clinical_rules para depois do LLM.**
- `ER_IMMEDIATE` produzido por Layer 1 nunca é rebaixado por nenhum step posterior.
- Subagents (`SymptomAgent`, `NavigationAgent`, `QuestionnaireAgent`, `EmotionalSupportAgent`) **coletam** tool calls mas **não os executam**. Tool calls são devolvidos ao orquestrador e retornados como `actions` na resposta da API.
- Nunca chame `backend_client` de dentro do caminho crítico do pipeline. O backend NestJS executa as actions.

---

## 2. Como adicionar novos intents ou steps ao fluxo

### Novo intent

1. Declare a constante em `src/agent/intent_classifier.py`.
2. Adicione ao conjunto de intents reconhecidos dentro do classificador.
3. No `orchestrator.py`, adicione a verificação logo após o bloco `INTENT_APPOINTMENT_QUERY`:

```python
if intent == INTENT_MEDICATION_QUERY and intent_result.get("skip_full_pipeline"):
    trace.pipeline_path = "medication_query"
    return self._build_medication_query_response(clinical_context, agent_state)
```

4. Implemente `_build_<intent>_response()` como método privado de `AgentOrchestrator`.
5. Se o intent deve passar pelo pipeline principal (sem fast-path), adicione apenas o `intent_hint` ao `final_message` antes do step 5.

### Novo step intermediário

1. Crie o módulo em `src/agent/<modulo>.py` com um singleton no final.
2. Importe o singleton no topo do orchestrator.
3. Insira o step na posição correta da sequência — **clinical_rules deve sempre ser step 2.5**.
4. Envolva com `tracer.start_span(trace, "nome_legivel")` / `span.finish(resultado)`.
5. Trate exceções localmente quando o step é não-bloqueante.

---

## 3. Priority Model — Layer 3

### Classe e artefato

- Classe: `OncologyPriorityModel` em `src/models/priority_model.py`. O singleton global é `priority_model`.
- Artefato: `src/models/priority_model.joblib` — carregado no startup; se ausente, treino sintético automático.
- `PriorityModel` (legado) foi removido. Qualquer teste que importe essa classe vai falhar.

### 32 features (contrato imutável por versão)

Grupos: demographics (age, is_elderly), cancer profile (cancer_type_code, stage_num, is_palliative), treatment timing (days_since_last_chemo, in_nadir_window, in_risk_window, treatment_cycle), performance status (ecog_score, ecog_delta), symptoms ESAS-derived (pain_score, nausea_score, fatigue_score, dyspnea_score), vitals (temperature, has_fever, spo2), medication flags (has_anticoagulant, has_immunosuppressant, has_corticosteroid, has_opioid), comorbidity flags (has_sepsis_risk_comorbidity, has_thrombosis_risk_comorbidity, has_pulmonary_risk_comorbidity, has_renal_risk_comorbidity), validated scores (mascc_score, cisne_score), context (days_since_last_visit, is_alone), symptom summary (symptom_critical_count, symptom_high_count).

A lista canônica é `FEATURE_COLUMNS` em `priority_model.py`. **Nunca construa dicts de features manualmente** — use sempre `extract_features(clinical_context, symptom_analysis)`.

### 5 classes de saída (ordinal)

| idx | Disposition |
|-----|-------------|
| 0 | REMOTE_NURSING |
| 1 | SCHEDULED_CONSULT |
| 2 | ADVANCE_CONSULT |
| 3 | ER_DAYS |
| 4 | ER_IMMEDIATE |

`predict_single()` retorna `disposition` (string) + `probabilities` + `confidence` + `source`.

### Fallback sem modelo treinado

`_fallback_predict()` é ativado quando `is_trained == False`. Retorna `source: "fallback_rules"`. Lógica: febre + janela de risco (+4), dor >= 8 (+4), dor >= 6 (+2), ECOG >= 3 (+2), nadir (+1). O índice resultante é limitado a 4.

### Adicionando nova feature

1. Adicione o campo a `FEATURE_COLUMNS`.
2. Implemente a extração em `extract_features()`.
3. Adicione o campo ao schema `PredictRiskRequest` em `src/models/schemas.py` e ao mapeamento em `src/routes/risk.py`.
4. Retreine com `python -m scripts.train_model`.
5. Incremente `modelVersion` e registre no commit para auditoria.

### Retreino

```bash
# Sintético (5000 amostras)
python -m scripts.train_model

# Blendando dados reais exportados (peso 3x)
python -m scripts.train_model --real data.json

# Avaliar modelo atual sem retreinar
python -m scripts.train_model --eval
```

---

## 4. Clinical Rules Engine — Layer 1

### Estrutura e precedência

Arquivo: `src/agent/clinical_rules.py`. Singleton: `clinical_rules_engine`.

Avaliação em blocos de severidade decrescente com guards:

```
1-A  ER_IMMEDIATE  (R01–R11)  — avalia sempre
1-B  ER_DAYS       (R12–R17)  — só se has_immediate == False
1-C  ADVANCE_CONSULT (R18–R21) — só se has_er == False
1-D  SCHEDULED_CONSULT (R22–R23) — só se has_escalated == False
```

Após todos os blocos: Layer 2 (MASCC/CISNE) pode upgradar `ER_DAYS → ER_IMMEDIATE` mas nunca rebaixar um `ER_IMMEDIATE` já disparado.

### Como adicionar nova regra determinística

1. Escolha o bloco correto (1-A a 1-D) com base na severidade máxima da regra.
2. Atribua um ID sequencial: `R24_NOME_DESCRITIVO`.
3. Append um `RuleFinding`:

```python
findings.append(RuleFinding(
    rule_id="R24_NOME_DESCRITIVO",
    disposition=ER_DAYS,
    reason="Descrição clínica em português.",
    evidence={"campo": valor},
))
```

4. **Nunca adicione lógica probabilística** (scores LLM, valores ML) dentro de `clinical_rules.py`. Este arquivo é exclusivamente determinístico.
5. Regras de `ER_DAYS` em diante **devem** estar dentro dos guards correspondentes.

### Helpers disponíveis

- `self._has_symptom(symptom_names: set, targets: set) -> bool`
- `self._is_in_chemo(treatments) -> bool`
- `self._days_since_last_chemo(treatments) -> Optional[int]`
- `self._calculate_ecog_delta(history) -> Optional[int]`
- `self._has_medication_flag(medications, flag: str) -> bool`

### Dataclasses de output

- `RuleFinding(rule_id, disposition, reason, confidence=1.0, evidence={})`
- `ClinicalRulesResult(disposition, reasoning, findings, requires_immediate_action, confidence)`
  - `.is_er` — True se ER_DAYS ou ER_IMMEDIATE
  - `.is_immediate` — True se ER_IMMEDIATE

---

## 5. Clinical Scores — Layer 2

Arquivo: `src/agent/clinical_scores.py`. Singleton: `clinical_scores`. Invocado **dentro** do clinical rules engine, nunca diretamente pelo orchestrator.

### MASCC

Score máximo: 26. Alto risco: score <= 20.

| Variável | Pontos |
|---|---|
| Burden of illness nenhum/leve | 5 |
| Burden of illness moderado | 3 |
| Burden of illness grave/moribundo | 0 |
| Sem hipotensão (PAS >= 90) | 5 |
| Sem DPOC | 4 |
| Tumor sólido OU sem histórico fúngico | 4 |
| Sem desidratação | 3 |
| Status ambulatorial no início da febre | 3 |
| Idade < 60 anos | 2 |

### CISNE

Aplicável apenas a tumores sólidos. Score máximo: 8.

| Variável | Pontos |
|---|---|
| ECOG >= 2 | 2 |
| Hiperglicemia de estresse (glicose > 121 mg/dL, sem diabetes) | 2 |
| DPOC | 1 |
| Doença cardiovascular crônica | 1 |
| Mucosite NCI grau >= 2 | 1 |
| Monócitos < 200/µL | 1 |

Score 0 = baixo risco (~0.4%), 1-2 = intermediário (~4.5%), >= 3 = alto risco (~36%).

### Lógica combinada

- MASCC alto risco OU CISNE alto risco → `overall_febrile_neutropenia_risk = "HIGH"` → pode upgradar `ER_DAYS → ER_IMMEDIATE`
- Ambos baixo risco + fora do nadir + fora de quimio ativa → enriquece reason de R12 com nota ambulatorial (não rebaixa disposition)

---

## 6. FastAPI — Padrão de rotas e schemas

### Routers

Cada domínio tem seu router em `src/routes/<dominio>.py`. Registrado no router raiz em `src/routes/__init__.py`. Prefixo global: `/api/v1`.

### Pydantic models

Request/response de endpoints públicos em `src/models/schemas.py`. Models internos podem ficar no arquivo de rota.

```python
from pydantic import BaseModel, Field
from typing import List, Optional

class MinhaRequest(BaseModel):
    campo_obrigatorio: str
    campo_opcional: Optional[str] = None
    lista: List[str] = Field(default_factory=list)
```

### Padrão de endpoint

```python
@router.post("/recurso/acao", response_model=MinhaResponse)
async def acao_recurso(request: MinhaRequest):
    try:
        return MinhaResponse(...)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

### Endpoint `/risk/predict` — sequência de 4 layers

1. `clinical_rules_engine.evaluate()` — regras determinísticas
2. `clinical_scores.evaluate_febrile_neutropenia_risk()` — MASCC/CISNE (se febre)
3. `extract_features()` + `priority_model.predict_single()` — ML
4. Disposition mais severa entre Layer 1 e Layer 3 vence

---

## 7. Fallback quando sem API keys

- `llm_provider.has_any_llm_key(config)` retorna `False` → pipeline LLM não é chamado
- `llm_provider._fallback_response()` é usado
- Resposta de fallback: português, clinicamente neutra, sem conselhos clínicos específicos
- Layers 1 (clinical_rules) e 3 (ML model) continuam funcionando normalmente
- `has_any_llm_key()` relê o `.env` a cada chamada — não chamar em loops apertados

---

## 8. Logging

Usar `logging` padrão do Python com `_JsonFormatter` definido em `main.py`:

```python
import logging
logger = logging.getLogger(__name__)
```

Nunca usar `print()` ou `structlog`.

### Regras de logging

- **Nunca logar valores de API key** — usar `key[:4]...key[-4:]`
- `patient_id` e `tenant_id` apenas em objetos de trace estruturado (`AgentTracer`)
- `ER_IMMEDIATE` → `logger.warning()`, `ER_DAYS` → `logger.info()`, sem disparo → `logger.debug()`
- Exceções não-bloqueantes: `logger.warning(f"...: {e}")` e continue
- Exceções bloqueantes: `logger.error(f"...: {e}")` antes de re-raise ou fallback

---

## 9. Testes pytest

### Estrutura

```
tests/
  conftest.py
  agent/
    test_clinical_rules.py     # regras determinísticas, precedência, upgrade MASCC
    test_llm_provider.py       # resolução de chave, fallback, modo degradado
    test_agents_base.py        # base dos subagentes
  models/
    test_priority_model.py     # OncologyPriorityModel, extract_features()
  services/
    test_backend_client.py     # token, retry
  system/
    test_smoke.py              # smoke: imports, singletons
```

### Como rodar

```bash
cd ai-service && python -m pytest tests/ -v --tb=short
cd ai-service && python -m pytest tests/agent/test_clinical_rules.py -v
```

### Padrão para clinical_rules

```python
from src.agent.clinical_rules import clinical_rules_engine

symptom_analysis = {"detectedSymptoms": [], "structuredData": {"scales": {}}}
clinical_context = {"patient": {}, "treatments": [], "medications": [], "comorbidities": []}
result = clinical_rules_engine.evaluate(symptom_analysis, clinical_context)
assert result.disposition == "REMOTE_NURSING"
```

### O que NÃO testar em pytest

- Orchestrator end-to-end com chamadas LLM reais — usar `tools/manual/`
- RAG retrieval com embeddings reais — pesado demais para CI

---

## 10. O que NUNCA fazer no ai-service

- **Nunca adicionar lógica probabilística** dentro de `clinical_rules.py`
- **Nunca rebaixar `ER_IMMEDIATE`** gerado por Layer 1 em qualquer layer posterior
- **Nunca adicionar `tool_executor` a subagentes** — tool calls devem permanecer enfileiradas
- **Nunca chamar `backend_client`** de dentro do caminho crítico do triage
- **Nunca logar valor de API key** — apenas forma mascarada
- **Nunca usar `print()`** — sempre `logging.getLogger(__name__)`
- **Nunca construir dict de 32 features manualmente** — usar `extract_features()`
- **Nunca importar `PriorityModel`** (classe removida) — usar `OncologyPriorityModel`
- **Nunca adicionar nova feature** sem atualizar `FEATURE_COLUMNS`, `extract_features()`, schema e retreinar
- **Nunca expor `/api/v1/debug/llm-status`** sem autenticação em produção
- **Nunca deixar `oncology_corpus.json`** conter PII de pacientes
