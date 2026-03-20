#!/bin/bash
set -euo pipefail

# Invoca o subagent AI/ML Engineer
# Uso: ./invoke-ai.sh "descrição da tarefa"

TASK="${1:-}"
if [[ -z "$TASK" ]]; then
  echo "Uso: $0 \"descrição da tarefa\""
  echo "Exemplo: $0 \"adicionar detecção de sintomas de câncer de pulmão\""
  exit 1
fi

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"

echo "=== Subagent: AI/ML Engineer ==="
echo "Tarefa: $TASK"
echo ""
echo "Contexto carregado:"
echo "  - System prompt: .claude/subagents/ai-ml-engineer.md"
echo "  - Orchestrator: ai-service/src/agent/orchestrator.py"
echo "  - LLM Provider: ai-service/src/agent/llm_provider.py"
echo "  - Prompts: ai-service/src/agent/prompts/"
echo "  - Plano: docs/desenvolvimento/plano-agentes-ia.md"
echo ""
echo "Para usar com Claude Agent SDK:"
echo "  claude --system-prompt .claude/subagents/ai-ml-engineer.md \"$TASK\""
