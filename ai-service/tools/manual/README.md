# Manual Tools

This folder contains **manual or exploratory tools** for local debugging and
interactive validation. These are not part of the stable CI contract.

## Contents

- `chat_patient_agent.py`
  - Interactive local chat with the orchestrator using synthetic context.
- `test_intent_llm.py`
  - Manual probe for intent-classifier fallback behavior with LLM.
- `test_multi_agent_http.sh`
  - Ad-hoc HTTP smoke helper for multi-agent flows.

## Notes

- Scripts here may require local API keys and local services.
- Prefer automated pytest coverage for regressions; use these tools for
  exploratory checks and demos.
