# Tests Layout

Domain-based test organization:

- `tests/agent/`
  - Agent orchestration, clinical rules, LLM provider behavior.
- `tests/models/`
  - Priority model training/prediction tests.
- `tests/services/`
  - Backend client retry/token behavior.
- `tests/system/`
  - Smoke/import tests.
- `tests/fixtures/`
  - Static payloads used by tests.

## Running

- Full suite: `python3 -m pytest -q`
- Agent-only: `python3 -m pytest -q tests/agent`
- Single file: `python3 -m pytest -q tests/models/test_priority_model.py`

`test_observability_tenant_binding.py` exige `BACKEND_SERVICE_TOKEN` no ambiente ou em `ai-service/.env` (o CI define via `.github/workflows/ci.yml`). Sem token, esses testes são ignorados (`skip`).

`tests/conftest.py` centralizes `sys.path` bootstrap, so individual tests should
not add `sys.path` manually.
