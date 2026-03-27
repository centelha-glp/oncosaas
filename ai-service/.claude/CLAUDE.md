# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Start the service
uvicorn main:app --reload --port 8001

# Install dependencies
pip install -r requirements.txt

# Run tests
python -m pytest tests/
python -m pytest tests/models/test_priority_model.py -v    # single file, verbose

# Validate before committing
python -m pytest tests/
black --check .
flake8 .

# Lint & format
black .
flake8 .
pylint src/

# Train the priority model
python -m scripts.train_model                        # synthetic training (5000 samples)
python -m scripts.train_model --real data.json       # blend synthetic + real feedback
python -m scripts.train_model --eval                 # evaluate current model

# Docker build
docker build -t onconav-ai-service:latest .
```

Do not claim code is correct unless it has been validated by the relevant commands or you explicitly state what remains unverified.

## Testing

Tests use **pytest**. Config lives in `pyproject.toml` (`testpaths = ["tests"]`).

### What to test

- **ML model** — `OncologyPriorityModel` (not the legacy `PriorityModel` which no longer exists)
- **Clinical rules engine** — deterministic rules must fire for the correct clinical scenarios
- **Degraded-mode paths** — fallback behavior when no LLM key is present, when model is untrained
- **Feature extraction** — `extract_features()` with realistic clinical context dicts

### What NOT to test

- End-to-end orchestrator with live LLM calls — use manual scripts in `tools/manual/`
- RAG retrieval with live embeddings — too heavy for CI

### Patterns

```python
# Test priority model — always use OncologyPriorityModel, never PriorityModel (removed)
from src.models.priority_model import OncologyPriorityModel, FEATURE_COLUMNS

# Build a minimal 32-feature row
row = {col: 0 for col in FEATURE_COLUMNS}
row.update({"age": 60, "pain_score": 8, "has_fever": 1, "in_nadir_window": 1})

# Test clinical rules with realistic context
from src.agent.clinical_rules import clinical_rules_engine
symptom_analysis = {"detectedSymptoms": [], "structuredData": {"scales": {}}}
clinical_context = {"patient": {}, "treatments": [], "medications": [], "comorbidities": []}
result = clinical_rules_engine.evaluate(symptom_analysis, clinical_context)
```

### File locations

Place test files by domain:
- `tests/models/test_priority_model.py` — `OncologyPriorityModel`, `extract_features()`
- `tests/agent/test_clinical_rules.py` — deterministic rule firing, precedence, MASCC upgrade
- `tests/agent/test_llm_provider.py` — key resolution, fallback response, degraded mode
- `tests/services/test_backend_client.py` — token behaviour, retry decision logic
- `tests/system/test_smoke.py` — import smoke tests, singletons, constant cardinality

## How to work in this repo

### Before changing code
- Inspect the relevant files end-to-end
- Trace the data flow: route → orchestrator → rules engine → ML model → actions
- Understand which layer you are modifying (deterministic vs. probabilistic vs. generative)
- Prefer minimal, targeted diffs over broad refactors
- Preserve existing architecture unless there is a clear, justified improvement

### When proposing changes
- Explain the root cause, not just the symptom
- Align with existing patterns already used in the repo
- Avoid introducing new libraries or abstractions unless clearly necessary
- Call out tradeoffs, clinical safety implications, and follow-up work

### When performing a technical assessment
- Identify architecture strengths and weaknesses
- Separate issues by severity and urgency
- Distinguish critical fixes from high-priority improvements, nice-to-haves, and future features
- Propose a phased plan before implementation
- Prefer evidence from the codebase over assumptions

## Architecture

FastAPI microservice (port 8001). **Stateless per request** — receives full clinical context from the NestJS backend on every call. No direct database access. Model files and RAG index persisted locally on disk.

### Multi-layer triage pipeline

The core safety invariant: **deterministic rules (Layer 1) always fire before ML (Layer 3) and LLM (agents)**. Layer 1 cannot be weakened or overridden by downstream layers.

```
Incoming message
    │
    ├─ [Fast path] Intent = EMERGENCY → _build_emergency_response()
    ├─ [Fast path] Intent = GREETING  → _build_greeting_response()
    │
    └─ [Main path]
          ├─ Layer 0: Symptom Analyzer (keyword regex + optional LLM nuance detection)
          ├─ Layer 1: ClinicalRulesEngine (23 deterministic rules R01–R23)
          │    └─ Layer 2: MASCC/CISNE scores (called inside rules engine when fever present)
          ├─ Layer 3: OncologyPriorityModel (LightGBM, 32 features, 5 ordinal classes)
          │    └─ Layer 4: Social modifiers applied post-prediction
          ├─ RAG ContextBuilder (FAISS retrieval injected into LLM prompt)
          ├─ Multi-agent pipeline (Opus orchestrator → Sonnet subagents)
          └─ Action compilation (rule actions merged with LLM tool-call actions)
```

Dispositions (ascending severity): `REMOTE_NURSING` → `SCHEDULED_CONSULT` → `ADVANCE_CONSULT` → `ER_DAYS` → `ER_IMMEDIATE`

### Layer 1 — Hard Rules (`src/agent/clinical_rules.py`)

Rules R01–R23 are evaluated in priority order (ER_IMMEDIATE first). Once a higher tier fires, lower tiers are skipped — if R01–R11 fire ER_IMMEDIATE, the ER_DAYS block (R12–R17) is not evaluated. **This precedence is a safety invariant — never weaken it.**

Layer 2 (MASCC/CISNE) is invoked from inside the rules engine when fever is present. It can upgrade `ER_DAYS → ER_IMMEDIATE` but cannot downgrade an already-fired ER_IMMEDIATE.

#### Rules
- Hard rules must always evaluate before the ML model and before the LLM pipeline
- `ER_IMMEDIATE` findings are never downgraded by any downstream layer
- Never add probabilistic logic (LLM output, ML scores) into `clinical_rules.py`

### Layer 3 — ML Priority Model (`src/models/priority_model.py`)

- **Class:** `OncologyPriorityModel` (the legacy `PriorityModel` class was removed; tests that import it will fail)
- **Type:** LightGBM ordinal classifier, 32 features, 5 output classes
- **Artifact:** `src/models/priority_model.joblib` — loaded on startup, auto-trained synthetically if missing
- **Fallback:** `_fallback_predict()` — rule-based heuristic when model is not trained (returns `source: "fallback_rules"`)
- **Legacy compat:** `predict()` returns 0–100 float score for the old `/prioritize` endpoint; `predict_single()` returns disposition string for all new endpoints
- **Feature extraction:** always use `extract_features(clinical_context, symptom_analysis)` — never construct feature dicts manually
- Training uses stratified 80/20 split — the logged F1 score is evaluated on a held-out validation set

### Multi-agent pipeline (`src/agent/orchestrator.py`, `src/agent/subagents/`)

Orchestrator uses `claude-opus-4-6` with adaptive thinking (max 8 iterations). Subagents use `claude-sonnet-4-6` (max 6 iterations). Subagents **do not execute tool calls** — they collect tool calls and return them to the orchestrator. The orchestrator compiles all tool calls into `actions`, returned in the API response for the NestJS backend to execute.

#### Rules
- Never add `tool_executor` to subagents — tool calls must remain queued, not executed
- Hard rules always run before the multi-agent pipeline, not inside it
- On empty LLM response, use `llm_provider._fallback_response()` — not an empty string

### LLM Provider (`src/agent/llm_provider.py`)

Anthropic (Claude) is preferred. OpenAI is the fallback. `run_agentic_loop()` handles both. When no key is present, all generation methods return `_fallback_response()` — a safe Portuguese message that must never contain clinical advice or technical details.

Key resolution order: explicit runtime config → `ai-service/.env` → OS env.

#### Rules
- Never log API key values — log masked forms only (`key[:4]...key[-4:]`)
- All LLM API calls must have a timeout configured
- Fallback responses must be in Portuguese and clinically neutral
- `has_any_llm_key()` and `has_anthropic_key()` re-read `.env` files on every call — avoid calling in tight loops; cache the result per request

### RAG System (`src/agent/rag/knowledge_base.py`)

Corpus loaded from `src/agent/rag/oncology_corpus.json` (not committed — RAG is silently disabled if missing). FAISS index cached in `.index_cache/`. Embedding model: fastembed (production Docker) or sentence-transformers (dev fallback).

#### Rules
- Empty RAG results (`[]`) must never break the pipeline — all callers handle `[]` gracefully
- Do not inject raw retrieved passages into prompts without the `format_context()` wrapper
- Corpus documents must not contain PII

### Backend Integration (`src/services/backend_client.py`)

`BackendClient` singleton makes HTTP calls to NestJS for alert creation, disposition updates, and ECOG recording. Token read from `os.getenv("BACKEND_SERVICE_TOKEN")`.

**The main `/agent/process` endpoint does not call `backend_client` directly.** It returns `actions` in the response and the NestJS backend executes them. `backend_client` is used by specific sub-endpoints only.

#### Rules
- Never call `backend_client` from inside the critical triage path — keep it side-effect-free
- Always include `tenant_id` via `X-Tenant-Id` header in backend calls
- Treat 4xx as permanent failures (don't retry except 429), 5xx as transient (do retry)
- `BACKEND_SERVICE_TOKEN` absence is a warning, not a startup failure — alert creation silently no-ops

## Key Components

| Path | Responsibility |
|------|----------------|
| `main.py` | App entry, dotenv loading, startup (model load/train, RAG init), CORS |
| `src/routes/` | API endpoints under `/api/v1` |
| `src/models/priority_model.py` | `OncologyPriorityModel` + `extract_features()` |
| `src/models/train_priority.py` | Synthetic data generation + `load_or_train()` |
| `src/models/schemas.py` | All Pydantic request/response models |
| `src/agent/orchestrator.py` | Main async pipeline, intent routing, multi-agent dispatch |
| `src/agent/clinical_rules.py` | Layer 1 deterministic triage (23 rules — DO NOT add ML logic) |
| `src/agent/clinical_scores.py` | Layer 2 MASCC/CISNE validated scores |
| `src/agent/llm_provider.py` | Multi-LLM abstraction (Anthropic preferred, OpenAI fallback) |
| `src/agent/context_builder.py` | Formats clinical context into structured LLM prompt sections |
| `src/agent/rag/knowledge_base.py` | RAG retrieval via FAISS + fastembed |
| `src/agent/subagents/` | Specialized subagents (Symptom, Navigation, Questionnaire, EmotionalSupport) |
| `src/agent/tracer.py` | Ring-buffer traces (max 500, in-memory, not persistent across restarts) |
| `src/services/backend_client.py` | Async HTTP client for backend side-effects |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ANTHROPIC_API_KEY` | Claude API key (preferred for agentic loops) | — |
| `OPENAI_API_KEY` | OpenAI fallback | — |
| `BACKEND_URL` | NestJS backend URL | `http://localhost:3002` |
| `BACKEND_SERVICE_TOKEN` | Auth token for backend API calls | — |
| `CORS_ORIGINS` | Comma-separated allowed origins | `http://localhost:3000,http://localhost:3002` |
| `RAG_EMBEDDING_MODEL` | Sentence-transformers model for RAG | `paraphrase-multilingual-MiniLM-L12-v2` |
| `RAG_TOP_K` | Top K RAG passages | `4` |
| `RAG_SCORE_THRESHOLD` | RAG similarity threshold | `0.30` |

`.env` source: `ai-service/.env` (service-local config).

When assessing configuration:
- Verify env vars are read after `load_dotenv()` runs — singletons constructed at module import time may read before dotenv loads
- Never log env var values; use `key[:4]...key[-4:]` for API keys, boolean presence for tokens
- `BACKEND_SERVICE_TOKEN` absence is a warning, not a crash

## Observability

- **Structured JSON logging** — single-line JSON per entry via `_JsonFormatter` in `main.py`. Fields: `time`, `level`, `name`, `message`.
- **Traces** — `AgentTracer` ring buffer (max 500) at `GET /api/v1/observability/traces` and `/stats`. Cleared at `DELETE /api/v1/observability/traces`. Stores `patient_id`, `tenant_id`, dispositions, symptom severities — treat as sensitive PHI.
- **Health check** — `GET /health` returns `{status, service, version, model_trained, capabilities}`.
- **Debug endpoint** — `GET /api/v1/debug/llm-status` shows masked key presence. Do not expose without authentication in production.

## Known Issues

No critical blocking issues remain. Items previously tracked (startup SyntaxError, broken test suite, missing emergency disposition, always-zero features, broken retry logic, token timing, LLM timeouts) have all been resolved.

## Safety Invariants — Never Violate

- Hard rules (Layer 1) must always execute before ML and LLM layers
- `ER_IMMEDIATE` disposition cannot be downgraded by any downstream layer
- Clinical actions must never execute automatically inside subagents — return them as action objects
- Fallback responses must be in Portuguese and must not contain clinical advice or technical details
- `patient_id` and `tenant_id` must not appear as plain strings in log message fields (only in structured trace objects)

## Agent Workflow

| Situação | Agent | Quando acionar |
|---|---|---|
| Implementar/modificar orchestrator, clinical rules, ML model ou endpoints FastAPI | `ai-service` | Tarefas complexas de múltiplos arquivos |
| Após criar ou modificar qualquer código | `test-generator` | **Sempre** — gera/atualiza testes antes do commit |
| Commitar mudanças | `github-organizer` | **Sempre** — nunca commitar diretamente |
| Adicionar protocolo clínico | skill `/novo-protocolo-clinico` | Sincroniza backend + ai-service |

**Ordem obrigatória pré-commit:**
```
código alterado → test-generator → github-organizer
```
