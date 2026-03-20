# Multi-agente OncoNav — Detalhes e Verificação

## Quando o pipeline multi-agente roda

No [orchestrator](ai-service/src/agent/orchestrator.py), o pipeline multi-agente é usado quando **há pelo menos uma chave de LLM disponível** — seja em `agent_config` (enviado pelo backend) ou no **ambiente** (variáveis `.env`):

```python
has_llm_keys = llm_provider.has_any_llm_key(agent_config)  # config ou .env
# ...
if has_llm_keys:
    response_text, all_tool_calls = await self._run_multi_agent_pipeline(...)
else:
    response_text = await llm_provider.generate(...)  # uma única chamada, sem subagentes
```

O método [llm_provider.has_any_llm_key](ai-service/src/agent/llm_provider.py) retorna `True` se existir `ANTHROPIC_API_KEY` ou `OPENAI_API_KEY` em `agent_config` **ou** no `.env` / variáveis de ambiente (mesma resolução usada nas chamadas à API).

- **Com chaves no .env**: se `ANTHROPIC_API_KEY` ou `OPENAI_API_KEY` estiver definido no `ai-service/.env`, o multi-agente **roda** mesmo quando o backend não envia chaves no payload.
- **Backend com chaves por tenant**: se no futuro o backend enviar `anthropic_api_key` / `openai_api_key` no `agent_config`, elas têm prioridade (resolução explícita no provider).

---

## Fluxo do pipeline multi-agente

1. **Orquestrador (Claude Opus)** recebe a mensagem do paciente + contexto clínico (RAG) e o prompt em [orchestrator_prompt.py](ai-service/src/agent/prompts/orchestrator_prompt.py).
2. Ele tem **4 ferramentas de roteamento** (só nomes e descrições; não executam nada sozinhas):
   - `consultar_agente_sintomas`
   - `consultar_agente_navegacao`
   - `consultar_agente_questionario`
   - `consultar_agente_suporte_emocional`
3. O LLM decide quais subagentes chamar e invoca essas tools; o `tool_executor` no [llm_provider.run_agentic_loop](ai-service/src/agent/llm_provider.py) é uma função que **mapeia nome da tool → instância do subagente** e chama `agent.run(context, conversation_history, config)`.
4. Cada subagente roda seu **próprio loop agentic** (no [base_subagent](ai-service/src/agent/subagents/base_subagent.py)) com `tool_executor=None`: as tools de **ação** (registrar_sintoma, criar_alerta, etc.) são apenas **coletadas** (não executadas contra o backend). O resultado do subagente inclui `tool_calls`.
5. O orquestrador recebe de volta um resumo (JSON com nome do agente, análise, quantidade de ações) e pode invocar mais subagentes ou encerrar. Ao encerrar, devolve o texto final ao paciente.
6. Todas as tool calls **de ação** dos subagentes são agregadas em `all_tool_calls` e depois convertidas em **actions/decisions** no backend pelo método `_parse_tool_calls_to_actions` do orchestrator.

Resumo do fluxo:

```
Orquestrador (Opus)
  → tool: consultar_agente_sintomas  → SymptomAgent.run()  → tool_calls: [registrar_sintoma, criar_alerta, ...]
  → tool: consultar_agente_navegacao → NavigationAgent.run() → tool_calls: [atualizar_etapa_navegacao, ...]
  → …
  → Resposta final ao paciente
  → _parse_tool_calls_to_actions(all_tool_calls) → actions + decisions para o backend
```

---

## Ferramentas do orquestrador (roteamento)

Definidas em [orchestrator_prompt.py](ai-service/src/agent/prompts/orchestrator_prompt.py) em `ORCHESTRATOR_ROUTING_TOOLS`. São só para o LLM “escolher” qual subagente chamar; não têm efeito direto no banco.

| Tool | Descrição (resumo) | Uso |
|------|--------------------|-----|
| `consultar_agente_sintomas` | Especialista em sintomas oncológicos (dor, febre, náusea, fadiga, sangramento, etc.). | **Sempre** que houver qualquer sintoma físico. |
| `consultar_agente_navegacao` | Navegação oncológica: etapas do tratamento, exames, agendamentos, encaminhamentos. | Próximas etapas, “já fiz o exame”, o que vem no plano. |
| `consultar_agente_questionario` | Questionários padronizados (ESAS, PRO-CTCAE). | Múltiplos sintomas vagos, avaliação periódica, efeitos colaterais variados. |
| `consultar_agente_suporte_emocional` | Suporte emocional/psicológico. | Ansiedade, medo, tristeza, desânimo, solidão, raiva, sofrimento psicológico. |

Cada uma aceita um parâmetro opcional de foco (ex.: `foco`, `emocao`, `tipo_sugerido`).

---

## Subagentes e suas ferramentas de ação

As **ferramentas de ação** são as que viram **actions** no backend. Estão definidas em [action_tools.py](ai-service/src/agent/prompts/action_tools.py) (`AGENT_ACTION_TOOLS`). Cada subagente usa um **subconjunto** dessas tools.

### 1. SymptomAgent (sintomas)

- **Arquivo**: [subagents/symptom_agent.py](ai-service/src/agent/subagents/symptom_agent.py)
- **Nome interno**: `symptom_agent`
- **Tools usadas**: `registrar_sintoma`, `criar_alerta`, `escalar_para_enfermagem`

**Prompt (resumo):**  
Analisa sintomas oncológicos, classifica severidade (CRITICAL / HIGH / MEDIUM) e aplica regras (ex.: febre ≥38°C em quimioterapia = CRITICAL, escalar). Deve usar `registrar_sintoma` para cada sintoma, `criar_alerta` para HIGH/CRITICAL e `escalar_para_enfermagem` em situações de risco imediato.

**Ferramentas (detalhe):**

| Nome | Descrição | Parâmetros principais |
|------|-----------|------------------------|
| `registrar_sintoma` | Registra sintoma reportado pelo paciente. | `nome` (string), `severidade` (LOW/MEDIUM/HIGH/CRITICAL), `descricao` (opcional) |
| `criar_alerta` | Cria alerta para enfermagem (sintomas que exigem atenção). | `severidade` (MEDIUM/HIGH/CRITICAL), `motivo` (string) |
| `escalar_para_enfermagem` | Escala para atendimento imediato da enfermagem. | `motivo` (string), `urgencia` (MEDIUM/HIGH/CRITICAL) |

---

### 2. NavigationAgent (navegação)

- **Arquivo**: [subagents/navigation_agent.py](ai-service/src/agent/subagents/navigation_agent.py)
- **Nome interno**: `navigation_agent`
- **Tools usadas**: `atualizar_etapa_navegacao`, `agendar_checkin`, `recomendar_consulta`

**Prompt (resumo):**  
Orienta sobre etapas do tratamento, prazos (não confundir com “agendamento confirmado”), atualiza etapas só quando o paciente **confirma** que realizou, e agenda check-ins ou recomenda consultas conforme regras (1–2 dias para sintoma ativo, 7 dias rotineiro, etc.).

**Ferramentas:**

| Nome | Descrição | Parâmetros principais |
|------|-----------|------------------------|
| `atualizar_etapa_navegacao` | Marca etapa como concluída ou em andamento. | `step_key` (string, chave da etapa no contexto), `concluida` (boolean) |
| `agendar_checkin` | Agenda check-in de acompanhamento. | `dias` (1–30), `motivo` (opcional) |
| `recomendar_consulta` | Recomenda consulta com especialista. | `especialidade` (string), `motivo` (string) |

---

### 3. QuestionnaireAgent (questionários)

- **Arquivo**: [subagents/questionnaire_agent.py](ai-service/src/agent/subagents/questionnaire_agent.py)
- **Nome interno**: `questionnaire_agent`
- **Tools usadas**: `iniciar_questionario`, `recalcular_prioridade`

**Prompt (resumo):**  
Decide quando iniciar ESAS (avaliação geral de sintomas) ou PRO-CTCAE (toxicidades de tratamento) e quando acionar recálculo de prioridade (ex.: após iniciar questionário ou quando há dados clínicos novos).

**Ferramentas:**

| Nome | Descrição | Parâmetros principais |
|------|-----------|------------------------|
| `iniciar_questionario` | Inicia questionário clínico padronizado. | `tipo` (ESAS | PRO_CTCAE), `motivo` (opcional) |
| `recalcular_prioridade` | Recálculo do score de prioridade (ML). | `motivo` (opcional) |

---

### 4. EmotionalSupportAgent (suporte emocional)

- **Arquivo**: [subagents/emotional_support_agent.py](ai-service/src/agent/subagents/emotional_support_agent.py)
- **Nome interno**: `emotional_support_agent`
- **Tools usadas**: `enviar_lembrete`, `recomendar_consulta`

**Prompt (resumo):**  
Acolhe sofrimento emocional, valida sentimentos e usa as tools para lembrete de acompanhamento ou recomendação de consulta (ex.: psico-oncologia, paliativo).

**Ferramentas:**

| Nome | Descrição | Parâmetros principais |
|------|-----------|------------------------|
| `enviar_lembrete` | Agenda lembrete para o paciente. | `mensagem` (string), `dias` (1–30, opcional), `tipo` (FOLLOW_UP / APPOINTMENT_REMINDER / MEDICATION_REMINDER, opcional) |
| `recomendar_consulta` | Recomenda consulta com especialista. | `especialidade`, `motivo` |

---

## Lista completa de ferramentas de ação (AGENT_ACTION_TOOLS)

Todas em [action_tools.py](ai-service/src/agent/prompts/action_tools.py). O orchestrator converte as tool calls em actions em [orchestrator._parse_tool_calls_to_actions](ai-service/src/agent/orchestrator.py).

| Tool | Subagente(s) que usam | Mapeamento no backend (tipo de action) |
|------|------------------------|----------------------------------------|
| `registrar_sintoma` | SymptomAgent | RECORD_SYMPTOM |
| `criar_alerta` | SymptomAgent | CREATE_LOW_ALERT / CREATE_HIGH_CRITICAL_ALERT |
| `escalar_para_enfermagem` | SymptomAgent | CREATE_HIGH_CRITICAL_ALERT (com payload de escalação) |
| `iniciar_questionario` | QuestionnaireAgent | START_QUESTIONNAIRE |
| `agendar_checkin` | NavigationAgent | SCHEDULE_CHECK_IN |
| `recomendar_consulta` | NavigationAgent, EmotionalSupportAgent | RECOMMEND_APPOINTMENT (exige aprovação) |
| `enviar_lembrete` | EmotionalSupportAgent | SEND_REMINDER |
| `recalcular_prioridade` | QuestionnaireAgent | RECALCULATE_PRIORITY |
| `atualizar_etapa_navegacao` | NavigationAgent | UPDATE_NAVIGATION_STEP |

---

## Como testar se o multi-agente está funcionando

### Pré-requisito

- `ANTHROPIC_API_KEY` ou `OPENAI_API_KEY` no `ai-service/.env`.

---

### Opção 1: Script de chat (recomendado)

1. No terminal, na raiz do projeto:
   ```bash
   python ai-service/scripts/chat_patient_agent.py
   ```
2. Digite uma mensagem que force uso de subagentes, por exemplo:
   - **Sintomas:** `Estou com dor e náusea há dois dias`
   - **Sintomas + navegação:** `Estou com dor e quero saber quando é minha próxima consulta`
   - **Suporte emocional:** `Estou muito ansiosa com o tratamento`
3. O script mostra a resposta do agente e, quando o multi-agente rodar, lista **Ações sugeridas** (ex.: `registrar_sintoma`, `criar_alerta`). Comandos úteis: `/state`, `/history`, `/reset`, `/exit`.

---

### Opção 2: Chamada HTTP (AI Service rodando)

Serve para testar o fluxo **sem** enviar chaves no body (igual ao backend), usando só o `.env`.

1. Suba o AI Service (ex.: `npm run ai:dev` ou `uvicorn` na porta 8001).
2. Na raiz do projeto execute o script (no Windows use Git Bash ou WSL):
   ```bash
   bash ai-service/scripts/test_multi_agent_http.sh
   ```
   Ou manualmente com `curl` (ajuste a porta se necessário):
   ```bash
   curl -s -X POST http://localhost:8001/api/v1/agent/process \
     -H "Content-Type: application/json" \
     -d '{
       "message": "Estou com dor e náusea",
       "patient_id": "test-patient-001",
       "tenant_id": "test-tenant-001",
       "clinical_context": {
         "patient": {"name": "Teste", "cancerType": "BREAST", "stage": "II", "currentStage": "treatment", "priorityCategory": "medio"},
         "recentObservations": [],
         "activeTreatments": [],
         "lastAlerts": []
       },
       "protocol": {"name": "Breast", "check_ins": {"frequency": "weekly"}},
       "conversation_history": [],
       "agent_state": {},
       "agent_config": {"llm_provider": "anthropic", "llm_model": "claude-sonnet-4-6", "agent_language": "pt-BR"}
     }'
   ```
3. Na resposta JSON, verifique:
   - `response`: texto da resposta ao paciente.
   - `actions`: se o multi-agente tiver rodado, deve haver itens (ex.: `RECORD_SYMPTOM`, `CREATE_LOW_ALERT`).

---

### O que ver nos logs do AI Service

Com o multi-agente ativo (chaves no `.env` ou no `agent_config`), no terminal onde o AI Service está rodando devem aparecer linhas como:

- `Intent classified: ... (confidence=...)`
- `Subagent symptom_agent completed: N tool calls, M iterations`
- `Multi-agent tool calls (N): ['registrar_sintoma', 'criar_alerta', ...]`
- `Orchestrator pipeline complete: N total tool calls, M orchestrator iterations`

Se aparecer só uma linha de resposta sem “Subagent …” nem “Multi-agent tool calls”, o fluxo usou o fallback de uma única chamada LLM (sem subagentes); confira se as chaves estão no `.env` e se o processo do AI Service carregou esse arquivo.

---

## Resumo

- **Orquestrador**: Claude Opus com 4 tools de roteamento; chama subagentes via `tool_executor` e agrega as tool calls de ação.
- **Subagentes**: SymptomAgent (3 tools), NavigationAgent (3 tools), QuestionnaireAgent (2 tools), EmotionalSupportAgent (2 tools). Cada um roda um loop agentic com `tool_executor=None`, apenas coletando tool calls.
- **Ações**: As tool calls são convertidas em `actions` e `decisions` no orchestrator e executadas/avaliadas no backend (DecisionGate + execução de ações auto-aprovadas).
- **Condição para rodar**: `has_llm_keys` é obtido via `llm_provider.has_any_llm_key(agent_config)`, que considera chaves em `agent_config` **ou** no ambiente (`.env`). Com as chaves no `.env`, o multi-agente roda tanto no script de chat quanto nas requisições do backend.
