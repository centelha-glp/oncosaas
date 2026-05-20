"""
Política de respostas mock do ai-service (exam-extract, etc.).

Em produção/staging, mock só com flag explícita AI_ALLOW_MOCK_RESPONSES=true.
"""

from __future__ import annotations

import os


def _deployment_env() -> str:
    return os.getenv("ENVIRONMENT", os.getenv("NODE_ENV", "development")).strip().lower()


def allow_ai_mock_responses() -> bool:
    """True em dev/test ou quando AI_ALLOW_MOCK_RESPONSES estiver ativa."""
    flag = os.getenv("AI_ALLOW_MOCK_RESPONSES", "").strip().lower()
    if flag in ("1", "true", "yes", "on"):
        return True
    return _deployment_env() not in ("production", "staging")
