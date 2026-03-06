#!/usr/bin/env bash
# Testa o endpoint /agent/process SEM enviar chaves no body (como o backend).
# As chaves devem estar no .env; o multi-agente deve rodar via has_any_llm_key().
# Uso: na raiz do projeto: bash ai-service/scripts/test_multi_agent_http.sh
# Ou de dentro de ai-service: bash scripts/test_multi_agent_http.sh

set -e
BASE_URL="${AI_SERVICE_URL:-http://localhost:8001}"

echo "POST $BASE_URL/api/v1/agent/process (multi-agent test, no API keys in body)"
echo ""

# Usa arquivo JSON para evitar problemas de encoding/escape no Git Bash (Windows)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PAYLOAD_FILE="$SCRIPT_DIR/test_agent_payload.json"
if [ ! -f "$PAYLOAD_FILE" ]; then
  echo "Erro: $PAYLOAD_FILE nao encontrado."
  exit 1
fi

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/v1/agent/process" \
  -H "Content-Type: application/json" \
  -d "@$PAYLOAD_FILE")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "HTTP $HTTP_CODE"
echo ""

if command -v python3 >/dev/null 2>&1; then
  echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
elif command -v python >/dev/null 2>&1; then
  echo "$BODY" | python -m json.tool 2>/dev/null || echo "$BODY"
else
  echo "$BODY"
fi

echo ""
echo "Se multi-agente rodou: response tem texto e 'actions' pode ter itens (RECORD_SYMPTOM, CREATE_*_ALERT, etc.)."
echo "Nos logs do AI Service procure: 'Subagent ... completed' e 'Multi-agent tool calls'."
