#!/bin/bash
# Auto-carrega o CLAUDE.md do subdiretório relevante (backend/frontend/ai-service)
# com deduplicação por sessão — injeta apenas 1x por subdiretório por sessão.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // ""')
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // "default"')

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"

# Determina o subdiretório relevante
SUBDIR=""
if echo "$FILE_PATH" | grep -qE "(/|\\\\)backend(/|\\\\)"; then
  SUBDIR="backend"
elif echo "$FILE_PATH" | grep -qE "(/|\\\\)frontend(/|\\\\)"; then
  SUBDIR="frontend"
elif echo "$FILE_PATH" | grep -qE "(/|\\\\)ai-service(/|\\\\)"; then
  SUBDIR="ai-service"
fi

# Sem subdiretório relevante — sai silenciosamente
if [ -z "$SUBDIR" ]; then
  exit 0
fi

# Deduplicação: verifica se já foi carregado nesta sessão
MARKER="/tmp/onconav_claude_loaded_${SESSION_ID}_${SUBDIR}"

if [ -f "$MARKER" ]; then
  exit 0
fi

# Marca como carregado
touch "$MARKER"

# Lê o CLAUDE.md do subdiretório
CLAUDE_MD_PATH="$PROJECT_DIR/$SUBDIR/CLAUDE.md"
if [ ! -f "$CLAUDE_MD_PATH" ]; then
  exit 0
fi

CONTENT=$(cat "$CLAUDE_MD_PATH")

# Injeta como additionalContext no modelo
jq -n --arg content "## $SUBDIR/CLAUDE.md (auto-carregado)

$CONTENT" \
  '{"hookSpecificOutput": {"hookEventName": "PreToolUse", "additionalContext": $content}}'
