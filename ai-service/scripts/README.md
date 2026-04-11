# Scripts

This directory contains **supported operational scripts** that are expected to
remain stable and useful in day-to-day workflows.

## Supported

- `train_model.py`
  - Train/evaluate the oncology priority model (synthetic data from `src/models/train_priority.py`).
  - Training uses a 15% stratified holdout for recall (ER_IMMEDIATE) and under-triage rate; `--eval` runs a separate fixed-seed test set.
  - Examples:
    - `python -m scripts.train_model`
    - `python -m scripts.train_model --eval`
    - `python -m scripts.train_model --real data/training_feedback.json`

- `export_training_data.py`
  - Export anonymized disposition-feedback data from backend.
  - Example:
    - `python -m scripts.export_training_data --token <admin_jwt> --out data/training_feedback.json`

## Moved Out

Manual/debug scripts were moved to `tools/manual/` to keep this folder focused
on supported ops workflows:

- `tools/manual/chat_patient_agent.py`
- `tools/manual/test_intent_llm.py`
- `tools/manual/test_multi_agent_http.sh`

Static payload fixtures were moved to `tests/fixtures/`:

- `tests/fixtures/test_agent_payload.json`
