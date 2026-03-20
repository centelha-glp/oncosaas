#!/bin/bash
set -euo pipefail

# Invoca o subagent Desenvolvedor Backend NestJS
# Uso: ./invoke-backend.sh "descrição da tarefa"

TASK="${1:-}"
if [[ -z "$TASK" ]]; then
  echo "Uso: $0 \"descrição da tarefa\""
  echo "Exemplo: $0 \"criar endpoint GET /api/v1/reports para listar relatórios\""
  exit 1
fi

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"

# Carregar contexto do subagent
SYSTEM_PROMPT=$(cat "$PROJECT_DIR/.claude/subagents/backend-nestjs.md")

# Arquivos de contexto relevantes
echo "=== Subagent: Desenvolvedor Backend NestJS ==="
echo "Tarefa: $TASK"
echo ""
echo "Contexto carregado:"
echo "  - System prompt: .claude/subagents/backend-nestjs.md"
echo "  - Schema: backend/prisma/schema.prisma"
echo "  - AppModule: backend/src/app.module.ts"
echo "  - Guards: backend/src/auth/guards/"
echo ""
echo "Para usar com Claude Agent SDK:"
echo "  claude --system-prompt .claude/subagents/backend-nestjs.md \"$TASK\""
