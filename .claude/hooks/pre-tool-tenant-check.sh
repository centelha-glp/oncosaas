#!/bin/bash
set -euo pipefail

# PreToolUse Hook: Guardião Multi-Tenant
# Verifica se novas queries Prisma em services do backend incluem tenantId no where.
# Roda ANTES de editar arquivos — bloqueia se faltar tenantId em queries Prisma.

# Lê o JSON do hook via stdin
INPUT=$(cat)

# Extrair informações do tool use
TOOL_NAME=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_name',''))" 2>/dev/null || echo "")

# Só verificar edições (Edit, Write)
if [[ "$TOOL_NAME" != "Edit" && "$TOOL_NAME" != "Write" ]]; then
  exit 0
fi

# Extrair o caminho do arquivo sendo editado
FILE_PATH=$(echo "$INPUT" | python3 -c "
import sys, json
d = json.load(sys.stdin)
inp = d.get('tool_input', {})
print(inp.get('file_path', ''))
" 2>/dev/null || echo "")

# Só verificar services e controllers do backend
if [[ "$FILE_PATH" != *"backend/src/"* ]]; then
  exit 0
fi

if [[ "$FILE_PATH" != *".service.ts" && "$FILE_PATH" != *".controller.ts" ]]; then
  exit 0
fi

# Ignorar arquivos de configuração, prisma service, e auth
if [[ "$FILE_PATH" == *"prisma.service"* || "$FILE_PATH" == *"app.module"* || "$FILE_PATH" == *"main.ts"* ]]; then
  exit 0
fi

# Extrair o conteúdo novo que está sendo escrito
NEW_CONTENT=$(echo "$INPUT" | python3 -c "
import sys, json
d = json.load(sys.stdin)
inp = d.get('tool_input', {})
# Para Edit, o conteúdo novo está em new_string; para Write, em content
content = inp.get('new_string', '') or inp.get('content', '')
print(content)
" 2>/dev/null || echo "")

if [[ -z "$NEW_CONTENT" ]]; then
  exit 0
fi

# Verificar se o conteúdo novo contém chamadas Prisma sem tenantId
# Patterns de queries Prisma que DEVEM ter tenantId
PRISMA_PATTERNS="prisma\.\w+\.(findMany|findFirst|findUnique|findFirstOrThrow|findUniqueOrThrow|update|updateMany|delete|deleteMany|count|aggregate|groupBy|upsert)"

HAS_PRISMA_CALL=$(echo "$NEW_CONTENT" | grep -cP "$PRISMA_PATTERNS" 2>/dev/null || echo "0")

if [[ "$HAS_PRISMA_CALL" -gt 0 ]]; then
  # Verificar se tenantId está presente no contexto próximo
  HAS_TENANT_ID=$(echo "$NEW_CONTENT" | grep -c "tenantId" 2>/dev/null || echo "0")

  if [[ "$HAS_TENANT_ID" -eq 0 ]]; then
    echo "⚠️  ALERTA MULTI-TENANT: O código contém chamadas Prisma sem 'tenantId'."
    echo ""
    echo "Toda query Prisma no backend DEVE incluir tenantId no where clause"
    echo "para garantir isolamento de dados entre tenants."
    echo ""
    echo "Exemplo correto:"
    echo "  await this.prisma.patient.findMany({"
    echo "    where: { tenantId, ...otherFilters }"
    echo "  });"
    echo ""
    echo "Arquivo: $FILE_PATH"
    echo ""
    echo "Referência: backend/src/auth/guards/tenant.guard.ts"
    # Exit 2 = block with message (BLOCKED)
    exit 2
  fi
fi

exit 0
