#!/bin/bash
# Auto-carrega o CLAUDE.md do subdiretório relevante (backend/frontend/ai-service)
# com deduplicação por sessão — injeta apenas 1x por subdiretório por sessão.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | python -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('file_path',''))" 2>/dev/null || echo "")
SESSION_ID=$(echo "$INPUT" | python -c "import sys,json; d=json.load(sys.stdin); print(d.get('session_id','default'))" 2>/dev/null || echo "default")

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
python -c "
import json, sys
content = '''## $SUBDIR/CLAUDE.md (auto-carregado)

''' + sys.stdin.read()
print(json.dumps({'hookSpecificOutput': {'hookEventName': 'PreToolUse', 'additionalContext': content}}))
" < "$CLAUDE_MD_PATH"