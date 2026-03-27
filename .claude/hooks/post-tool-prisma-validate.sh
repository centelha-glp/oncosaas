#!/bin/bash
set -euo pipefail

# PostToolUse Hook: Validação de Schema Prisma
# Após edições em schema.prisma, executa prisma validate e prisma format.

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

# Só executar para schema.prisma
if [[ "$FILE_PATH" != *"schema.prisma" ]]; then
  exit 0
fi

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
BACKEND_DIR="$PROJECT_DIR/backend"

echo "🔍 Validando schema Prisma..."

# Executar prisma validate
if ! cd "$BACKEND_DIR" && npx prisma validate 2>&1; then
  echo ""
  echo "❌ Schema Prisma inválido! Corrija os erros acima antes de continuar."
  exit 1
fi

# Executar prisma format
echo "📐 Formatando schema Prisma..."
cd "$BACKEND_DIR" && npx prisma format 2>&1 || true

echo "✅ Schema Prisma válido e formatado."
exit 0
