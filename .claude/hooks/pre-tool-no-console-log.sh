#!/bin/bash
set -euo pipefail

# PreToolUse Hook: Proibir console.log
# Backend: usar NestJS Logger. Frontend: sem console.log em produção.

INPUT=$(cat)

TOOL_NAME=$(echo "$INPUT" | python -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_name',''))" 2>/dev/null || echo "")

if [[ "$TOOL_NAME" != "Edit" && "$TOOL_NAME" != "Write" ]]; then
  exit 0
fi

FILE_PATH=$(echo "$INPUT" | python -c "
import sys, json
d = json.load(sys.stdin)
inp = d.get('tool_input', {})
print(inp.get('file_path', ''))
" 2>/dev/null || echo "")

# Só verificar arquivos TypeScript/TSX do backend e frontend
if [[ "$FILE_PATH" != *"backend/src/"* && "$FILE_PATH" != *"frontend/src/"* ]]; then
  exit 0
fi

if [[ "$FILE_PATH" != *".ts" && "$FILE_PATH" != *".tsx" ]]; then
  exit 0
fi

# Ignorar arquivos de teste
if [[ "$FILE_PATH" == *".spec.ts" || "$FILE_PATH" == *".test.ts" || "$FILE_PATH" == *"__tests__"* ]]; then
  exit 0
fi

NEW_CONTENT=$(echo "$INPUT" | python -c "
import sys, json
d = json.load(sys.stdin)
inp = d.get('tool_input', {})
content = inp.get('new_string', '') or inp.get('content', '')
print(content)
" 2>/dev/null || echo "")

if [[ -z "$NEW_CONTENT" ]]; then
  exit 0
fi

# Verificar se o conteúdo novo adiciona console.log/warn/error
HAS_CONSOLE=$(echo "$NEW_CONTENT" | grep -cP "console\.(log|warn|error|debug|info)\(" 2>/dev/null) || true

if [[ "$HAS_CONSOLE" -gt 0 ]]; then
  IS_BACKEND=false
  if [[ "$FILE_PATH" == *"backend/src/"* ]]; then
    IS_BACKEND=true
  fi

  echo "⚠️  ALERTA: console.log detectado em código de produção."
  echo ""
  if [[ "$IS_BACKEND" == true ]]; then
    echo "No backend, use o NestJS Logger:"
    echo "  private readonly logger = new Logger(SeuService.name);"
    echo "  this.logger.log('mensagem');"
    echo "  this.logger.error('erro');"
    echo "  this.logger.warn('aviso');"
  else
    echo "No frontend, remova console.log de código de produção."
    echo "Para debugging temporário, use condicionais:"
    echo "  if (process.env.NODE_ENV === 'development') console.log(...);"
  fi
  echo ""
  echo "Arquivo: $FILE_PATH"
  exit 2
fi

exit 0
