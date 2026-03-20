#!/bin/bash
set -euo pipefail

# Invoca o subagent Especialista em Segurança e Compliance
# Uso: ./invoke-seguranca.sh "descrição da tarefa"

TASK="${1:-}"
if [[ -z "$TASK" ]]; then
  echo "Uso: $0 \"descrição da tarefa\""
  echo "Exemplo: $0 \"revisar segurança do módulo patients\""
  exit 1
fi

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"

echo "=== Subagent: Especialista em Segurança e Compliance ==="
echo "Tarefa: $TASK"
echo ""
echo "Contexto carregado:"
echo "  - System prompt: .claude/subagents/seguranca-compliance.md"
echo "  - Guards: backend/src/auth/guards/"
echo "  - AuditLog: backend/src/audit-log/"
echo "  - Encryption: backend/src/common/utils/encryption.util.ts"
echo ""
echo "Para usar com Claude Agent SDK:"
echo "  claude --system-prompt .claude/subagents/seguranca-compliance.md \"$TASK\""
