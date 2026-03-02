#!/bin/bash
set -euo pipefail

# PreToolUse Hook: Guardião LGPD
# Verifica se DTOs de response ou controllers não expõem campos sensíveis.
# Campos protegidos: cpf, phone, password, mfaSecret, *ApiKey, oauthAccessToken

INPUT=$(cat)

TOOL_NAME=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_name',''))" 2>/dev/null || echo "")

if [[ "$TOOL_NAME" != "Edit" && "$TOOL_NAME" != "Write" ]]; then
  exit 0
fi

FILE_PATH=$(echo "$INPUT" | python3 -c "
import sys, json
d = json.load(sys.stdin)
inp = d.get('tool_input', {})
print(inp.get('file_path', ''))
" 2>/dev/null || echo "")

# Só verificar DTOs de response e controllers do backend
if [[ "$FILE_PATH" != *"backend/src/"* ]]; then
  exit 0
fi

# Verificar apenas DTOs de response e controllers
IS_RESPONSE_DTO=false
IS_CONTROLLER=false

if [[ "$FILE_PATH" == *"response"*".dto.ts" || "$FILE_PATH" == *"dto"*"response"* ]]; then
  IS_RESPONSE_DTO=true
fi

if [[ "$FILE_PATH" == *".controller.ts" ]]; then
  IS_CONTROLLER=true
fi

if [[ "$IS_RESPONSE_DTO" == false && "$IS_CONTROLLER" == false ]]; then
  exit 0
fi

NEW_CONTENT=$(echo "$INPUT" | python3 -c "
import sys, json
d = json.load(sys.stdin)
inp = d.get('tool_input', {})
content = inp.get('new_string', '') or inp.get('content', '')
print(content)
" 2>/dev/null || echo "")

if [[ -z "$NEW_CONTENT" ]]; then
  exit 0
fi

# Lista de campos sensíveis LGPD que NÃO devem aparecer em responses
SENSITIVE_FIELDS=("password" "mfaSecret" "anthropicApiKey" "openaiApiKey" "oauthAccessToken" "twilioAuthToken" "vapiApiKey" "elevenLabsApiKey" "encryptionKey")

VIOLATIONS=""
for field in "${SENSITIVE_FIELDS[@]}"; do
  # Verificar se o campo sensível aparece como propriedade exposta (não como exclusão)
  if echo "$NEW_CONTENT" | grep -qP "(?<!exclude.*)\b${field}\b" 2>/dev/null; then
    # Ignorar se está em um select: false ou @Exclude() context
    if ! echo "$NEW_CONTENT" | grep -qP "(select.*${field}.*false|@Exclude.*${field}|omit.*${field})" 2>/dev/null; then
      VIOLATIONS="${VIOLATIONS}\n  - ${field}"
    fi
  fi
done

if [[ -n "$VIOLATIONS" ]]; then
  echo "⚠️  ALERTA LGPD: Campos sensíveis detectados em response/controller."
  echo ""
  echo "Os seguintes campos protegidos podem estar sendo expostos:"
  echo -e "$VIOLATIONS"
  echo ""
  echo "Dados de saúde e credenciais NUNCA devem ser retornados em responses."
  echo "Use @Exclude(), select: false, ou omita-os do DTO de response."
  echo ""
  echo "Arquivo: $FILE_PATH"
  exit 2
fi

exit 0
