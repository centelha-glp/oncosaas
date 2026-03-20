#!/bin/bash
set -euo pipefail

# Invoca o subagent Desenvolvedor Frontend Next.js
# Uso: ./invoke-frontend.sh "descrição da tarefa"

TASK="${1:-}"
if [[ -z "$TASK" ]]; then
  echo "Uso: $0 \"descrição da tarefa\""
  echo "Exemplo: $0 \"criar página de relatórios em /reports\""
  exit 1
fi

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"

echo "=== Subagent: Desenvolvedor Frontend Next.js ==="
echo "Tarefa: $TASK"
echo ""
echo "Contexto carregado:"
echo "  - System prompt: .claude/subagents/frontend-nextjs.md"
echo "  - API client: frontend/src/lib/api/client.ts"
echo "  - Hooks: frontend/src/hooks/"
echo "  - Components: frontend/src/components/"
echo ""
echo "Para usar com Claude Agent SDK:"
echo "  claude --system-prompt .claude/subagents/frontend-nextjs.md \"$TASK\""
