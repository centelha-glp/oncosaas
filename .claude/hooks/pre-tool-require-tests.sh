#!/bin/bash
set -euo pipefail

# PreToolUse Hook: Exigir testes antes de git commit
#
# Intercepta chamadas Bash que contêm "git commit".
# Se houver código de produção no stage sem arquivos de teste correspondentes,
# bloqueia o commit e exige que o agente test-generator seja executado primeiro.

INPUT=$(cat)

TOOL_NAME=$(echo "$INPUT" | python -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_name',''))" 2>/dev/null || echo "")

if [[ "$TOOL_NAME" != "Bash" ]]; then
  exit 0
fi

COMMAND=$(echo "$INPUT" | python -c "
import sys, json
d = json.load(sys.stdin)
inp = d.get('tool_input', {})
print(inp.get('command', ''))
" 2>/dev/null || echo "")

# Verificar se é um git commit (não amend, não rebase)
if ! echo "$COMMAND" | grep -qE "git commit"; then
  exit 0
fi

# Ignorar operações não-commit que contêm a string por acidente
if echo "$COMMAND" | grep -qE "git commit --allow-empty|COMMIT_EDITMSG"; then
  exit 0
fi

# Obter arquivos no stage
STAGED=$(git -C "$CLAUDE_PROJECT_DIR" diff --cached --name-only 2>/dev/null || echo "")

if [[ -z "$STAGED" ]]; then
  exit 0
fi

# Verificar se há código de produção no stage
PROD_BACKEND=$(echo "$STAGED" | grep -E "^backend/src/.*\.ts$" | grep -vE "\.(spec)\.ts$" || true)
PROD_FRONTEND=$(echo "$STAGED" | grep -E "^frontend/src/.*\.(ts|tsx)$" | grep -vE "\.(test|spec)\.(ts|tsx)$" | grep -v "__tests__" || true)
PROD_AI=$(echo "$STAGED" | grep -E "^ai-service/src/.*\.py$" | grep -v "^#" || true)

HAS_PROD=""
[[ -n "$PROD_BACKEND" ]] && HAS_PROD="$PROD_BACKEND"
[[ -n "$PROD_FRONTEND" ]] && HAS_PROD="${HAS_PROD}${PROD_FRONTEND}"
[[ -n "$PROD_AI" ]] && HAS_PROD="${HAS_PROD}${PROD_AI}"

if [[ -z "$HAS_PROD" ]]; then
  # Apenas docs, config, migrations, assets — sem código de produção
  exit 0
fi

# Verificar se há arquivos de teste no stage
TEST_FILES=$(echo "$STAGED" | grep -E "\.(spec|test)\.(ts|tsx)$|/__tests__/|/tests/test_" || true)

if [[ -n "$TEST_FILES" ]]; then
  # Há testes no stage junto com o código — permitir commit
  exit 0
fi

# Código de produção sem testes no stage — bloquear
echo "🚫 COMMIT BLOQUEADO: código de produção sem testes correspondentes no stage."
echo ""
echo "Arquivos de produção detectados:"
echo "$HAS_PROD" | sed 's/^/  - /'
echo ""
echo "Execute o agente test-generator antes de commitar:"
echo "  /gerar-testes"
echo ""
echo "O agente irá:"
echo "  1. Analisar os arquivos modificados"
echo "  2. Gerar/atualizar os testes unitários e E2E"
echo "  3. Executar os testes para confirmar que passam"
echo ""
echo "Após o test-generator concluir, retome o commit."

exit 2
