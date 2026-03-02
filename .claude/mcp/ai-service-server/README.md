# MCP Server: AI Service (FastAPI)

## Descrição
MCP Server para interagir com o AI Service do ONCONAV, permitindo testar o agente conversacional, análise de sintomas e questionários.

## Configuração

### Base URL
```
http://localhost:8001
```

### Swagger Docs
```
http://localhost:8001/docs
```

### Configuração MCP (usando fetch server)
```json
{
  "mcpServers": {
    "onconav-ai": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-fetch"],
      "description": "ONCONAV AI Service access"
    }
  }
}
```

## Endpoints

### Health Check
```bash
GET /api/v1/health
```

### Priorização de Paciente
```bash
POST /api/v1/prioritize
{
  "cancer_type": "colorectal",
  "stage": "III",
  "performance_status": 1,
  "age": 65,
  "symptoms": ["dor abdominal", "fadiga"]
}
# Retorna: { score: 0-100, category, reason }
```

### Processar Mensagem do Agente (principal)
```bash
POST /api/v1/agent/process
{
  "message": "Estou sentindo muita dor na barriga",
  "patient_id": "<uuid>",
  "tenant_id": "<uuid>",
  "clinical_context": { ... },
  "protocol": { ... },
  "conversation_history": [...],
  "agent_state": { ... },
  "agent_config": { ... }
}
# Retorna: { response, actions, symptom_analysis, new_state, decisions }
```

### Analisar Sintomas
```bash
POST /api/v1/agent/analyze-symptoms
{
  "message": "Estou com febre alta e sangramento",
  "cancer_type": "colorectal"
}
# Retorna: { symptoms: [...], escalation_needed, severity }
```

### Pontuar Questionário
```bash
POST /api/v1/agent/score-questionnaire
{
  "questionnaire_type": "ESAS",
  "responses": { "pain": 7, "fatigue": 5, ... }
}
# Retorna: { scores, interpretation, alerts }
```

### Avaliar Protocolo
```bash
POST /api/v1/agent/evaluate-protocol
{
  "cancer_type": "colorectal",
  "journey_stage": "TREATMENT",
  "agent_state": { ... }
}
# Retorna: { actions, questionnaire_trigger }
```

## Notas
- O AI Service funciona sem API keys (respostas mock/fallback)
- Para respostas reais do LLM, configurar OPENAI_API_KEY ou ANTHROPIC_API_KEY no .env
- O modelo de priorização funciona com regras se não treinado
