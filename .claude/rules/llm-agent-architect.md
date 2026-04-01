# llm-agent-architect — Rules & Patterns

Rules extraídas do código real em `ai-service/src/agent/`. Qualquer alteração na arquitetura do sistema multi-agente deve obedecer estas convenções.

---

## 1. Visão Geral da Arquitetura Multi-Agente

O sistema segue uma hierarquia de dois níveis:

```
AgentOrchestrator (Claude Opus 4.6 — adaptive thinking)
    │
    ├── SymptomAgent         (Claude Sonnet 4.6)
    ├── NavigationAgent      (Claude Sonnet 4.6)
    ├── QuestionnaireAgent   (Claude Sonnet 4.6)
    └── EmotionalSupportAgent (Claude Sonnet 4.6)
```

O orchestrator **roteia** — recebe a mensagem, chama subagentes via tool use (`consultar_agente_*`), coleta suas análises e sintetiza a resposta final ao paciente.

Os subagentes **especializam** — executam um agentic loop próprio limitado a 6 iterações, coletam tool calls mas **não os executam**. Tool calls são devolvidos ao orchestrator como `actions` na resposta da API.

### Invariante de segurança crítica

A ordem do pipeline é imutável. As layers determinísticas (clinical_rules, Layer 1) sempre precedem ML e LLM:

```
Questionnaire fast-path
Intent fast-paths (EMERGENCY / GREETING / APPOINTMENT_QUERY)
    ↓ [main path]
Symptom Analysis (Layer 0)
Clinical Rules Engine (Layer 1) ← PRE-ML, PRE-LLM, SEMPRE
MASCC/CISNE Scores (Layer 2, dentro do Layer 1)
Protocol Engine
ML Priority Model (Layer 3)
RAG Context Build
Multi-agent LLM Pipeline (Opus orchestrator → subagentes Sonnet)
Action Compilation
```

**Nunca mova `clinical_rules_engine.evaluate()` para depois do pipeline LLM.**

---

## 2. Orchestrator — Padrão de Implementação

### Assinatura de `process()`

```python
async def process(self, request: Dict[str, Any]) -> Dict[str, Any]:
    """
    Entrada: {message, patient_id, tenant_id, clinical_context,
              protocol, conversation_history, agent_state, agent_config}
    Saída:   {response, actions, symptom_analysis, new_state, decisions}
    """
```

### Dois configs separados

O orchestrator usa configurações distintas para si e para os subagentes:

```python
# Config do orchestrator — Opus com adaptive thinking
orch_config = {
    **agent_config,
    "llm_model": "claude-opus-4-6",
    "max_tokens": 16000,
    "use_thinking": True,
    "thinking_budget": 8000,
}

# Config dos subagentes — Sonnet mais leve
subagent_config = {
    **agent_config,
    "llm_model": agent_config.get("subagent_model", "claude-sonnet-4-6"),
    "max_tokens": 1024,
}
```

Nunca passar `orch_config` diretamente para subagentes — eles têm seus próprios limites de tokens.

### Pipeline do orchestrator com subagentes

O orchestrator usa `ORCHESTRATOR_ROUTING_TOOLS` (4 ferramentas de roteamento) e `routing_tool_executor` como callback para chamar subagentes:

```python
result = await llm_provider.run_agentic_loop(
    system_prompt=orchestrator_system,
    initial_messages=messages,
    tools=ORCHESTRATOR_ROUTING_TOOLS,
    config=orch_config,
    tool_executor=routing_tool_executor,  # chama subagentes quando invocado
    max_iterations=8,
)
```

O `routing_tool_executor` recebe o nome da ferramenta (`consultar_agente_sintomas`, etc.), instancia o subagente correspondente, executa com `run()` e acumula os tool_calls retornados.

### Compilação de actions

Actions finais são o merge de dois fluxos:
1. Actions de regras clínicas (Layer 1): `clinical_result.get_actions()`
2. Actions de tool calls dos subagentes: coletadas pelo `routing_tool_executor`

A disposição final é o máximo de severidade entre Layer 1 e Layer 3. `ER_IMMEDIATE` de Layer 1 nunca é rebaixado.

---

## 3. BaseSubAgent — Contrato Obrigatório

Todo subagente estende `BaseSubAgent` em `src/agent/subagents/base_subagent.py`.

### Estrutura mínima

```python
from ..subagents.base_subagent import BaseSubAgent, SubAgentResult

class MeuNovoAgent(BaseSubAgent):
    name = "meu_novo_agente"

    @property
    def system_prompt(self) -> str:
        return "Você é especialista em..."

    @property
    def tools(self) -> List[Dict[str, Any]]:
        return [
            {
                "name": "minha_action",
                "description": "...",
                "input_schema": {"type": "object", "properties": {...}},
            }
        ]
```

### `SubAgentResult` — estrutura de retorno

```python
@dataclass
class SubAgentResult:
    agent_name: str
    response: str
    tool_calls: List[Dict[str, Any]] = field(default_factory=list)
    error: Optional[str] = None
    iterations: int = 0
```

### Por que `tool_executor=None`

`BaseSubAgent.run()` passa `tool_executor=None` para `run_agentic_loop()` — isso faz com que tool calls sejam **enfileirados** e não executados. O subagente retorna os tool calls ao orchestrator via `SubAgentResult.tool_calls`. Nunca passar um `tool_executor` real a subagentes.

### Contexto RAG injetado automaticamente

```python
# Em BaseSubAgent.run():
system = f"{self.system_prompt}\n\n## CONTEXTO CLÍNICO\n\n{context}"
```

O `context` já contém o contexto RAG formatado — é passado pelo orchestrator após `context_builder.build_with_rag()`. Subagentes não chamam o RAG diretamente.

### Constante de iterações

`MAX_SUBAGENT_ITERATIONS = 6` — limite global para todos os subagentes. Nunca aumentar acima de 6 sem avaliar impacto em latência e tokens.

---

## 4. Subagentes Existentes e seus Domínios

| Subagente | Arquivo | Ferramentas (actions) | Quando o orchestrator o invoca |
|---|---|---|---|
| `SymptomAgent` | `symptom_agent.py` | `registrar_sintoma`, `solicitar_avaliacao_medica`, `acionar_enfermagem` | Qualquer sintoma físico relatado |
| `NavigationAgent` | `navigation_agent.py` | `avancar_etapa_navegacao`, `recomendar_consulta`, `agendar_seguimento` | Dúvidas sobre próximas etapas, exames realizados |
| `QuestionnaireAgent` | `questionnaire_agent.py` | `iniciar_questionario_esas`, `iniciar_questionario_pro_ctcae` | Sintomas vagos/difusos, avaliação periódica |
| `EmotionalSupportAgent` | `emotional_support_agent.py` | `registrar_estado_emocional`, `encaminhar_psicologia` | Ansiedade, medo, suporte emocional |

A ferramenta de roteamento usada pelo orchestrator para cada subagente:
- `consultar_agente_sintomas` → `SymptomAgent`
- `consultar_agente_navegacao` → `NavigationAgent`
- `consultar_agente_questionario` → `QuestionnaireAgent`
- `consultar_agente_suporte_emocional` → `EmotionalSupportAgent`

---

## 5. LLMProvider — Padrão de Uso

### Resolução de chave (3 níveis de prioridade)

```
1. Chave explícita no agent_config (config do tenant) — maior prioridade
2. ai-service/.env (lido via dotenv_values — evita stale OS env vars)
3. Variáveis de ambiente do processo (OS env)
```

`has_any_llm_key()` e `has_anthropic_key()` releem o `.env` a cada chamada. **Não chamar em loops** — chamar uma vez por request e cachear o resultado.

### Preferência de provedor

- **Anthropic** é o provedor preferido e o único que suporta `run_agentic_loop()` com tool use
- **OpenAI** é fallback para `generate()` — não suporta o pipeline multi-agente com adaptive thinking
- Com OpenAI apenas, o orchestrator deve usar `generate()` em vez de `run_agentic_loop()`

### Métodos disponíveis

| Método | Uso |
|---|---|
| `run_agentic_loop()` | Pipeline multi-agente com tool use (requer Anthropic) |
| `generate()` | Geração simples sem tool use (Anthropic ou OpenAI) |
| `has_any_llm_key(config)` | Verificar se qualquer LLM está disponível |
| `has_anthropic_key(config)` | Verificar se Anthropic está disponível (para agentic loop) |
| `_fallback_response()` | Resposta segura em português quando sem chaves |

---

## 6. AgentTracer — Observabilidade do Pipeline

`AgentTracer` em `src/agent/tracer.py` mantém um ring buffer de até 500 traces em memória (não persistido entre restarts).

### Ciclo de vida de trace e span

```python
# Iniciar trace — uma vez por request
trace = tracer.start_trace(patient_id, tenant_id)

# Criar span para cada step
span = tracer.start_span(trace, "nome_legivel_do_step")
# ... executa o step ...
span.finish(campo1=valor1, campo2=valor2)

# Finalizar trace — sempre no finally ou após conclusão
tracer.finish_trace(trace)                   # sucesso
tracer.finish_trace(trace, error=str(exc))   # falha
```

### Campos do `AgentTrace`

| Campo | Tipo | Quando setar |
|---|---|---|
| `pipeline_path` | str | Imediatamente ao entrar em um fast-path: `"questionnaire"`, `"emergency"`, `"greeting"`, `"appointment_query"`, `"main"` |
| `intent` | str | Após `intent_classifier.classify_async()` |
| `intent_confidence` | float | Junto com `intent` |
| `symptoms_detected` | int | Após `symptom_analyzer.analyze()` |
| `overall_severity` | str | Após symptom analysis |
| `clinical_disposition` | str | Após `clinical_rules_engine.evaluate()` |
| `clinical_rules_fired` | List[str] | IDs das regras disparadas (ex: `["R01_FEBRILE_NEUTROPENIA"]`) |
| `actions_generated` | List[str] | Tipos de actions compiladas |
| `subagents_called` | List[str] | Nomes dos subagentes invocados |

### Privacidade dos traces

`patient_id` e `tenant_id` ficam no objeto trace — são PHI. O endpoint `GET /api/v1/observability/traces` **nunca deve ser exposto sem autenticação**.

---

## 7. Fast-Paths — Quando e Como Usar

Fast-paths pulam o pipeline principal e retornam resposta imediata. São seguros apenas para cenários onde nenhuma regra clínica precisa ser avaliada OU onde a urgência é tão alta que a resposta deve ser imediata.

| Fast-path | Intent | Condição adicional | Pula pipeline? |
|---|---|---|---|
| Questionnaire | (estado ativo) | `agent_state["active_questionnaire"]` presente | Sim — vai para `_process_questionnaire_answer()` |
| Emergency | `INTENT_EMERGENCY` | `metadata["escalate_immediately"] == True` | Parcialmente — ainda roda symptom analysis |
| Greeting | `INTENT_GREETING` | `intent_result["skip_full_pipeline"] == True` | Sim |
| Appointment Query | `INTENT_APPOINTMENT_QUERY` | `intent_result["skip_full_pipeline"] == True` | Sim |

### Como adicionar novo fast-path

1. Declare a constante em `intent_classifier.py`: `INTENT_MEU_NOVO = "meu_novo"`
2. Adicione a verificação no `_process_with_trace()` logo após o bloco `INTENT_APPOINTMENT_QUERY`:

```python
if intent == INTENT_MEU_NOVO and intent_result.get("skip_full_pipeline"):
    trace.pipeline_path = "meu_novo"
    return self._build_meu_novo_response(clinical_context, agent_state)
```

3. Implemente `_build_meu_novo_response()` como método privado do `AgentOrchestrator`
4. **Regra**: fast-paths que pulam o pipeline principal **nunca devem ser usados para intents com possível conteúdo clínico urgente**. Em dúvida, deixar no pipeline principal

---

## 8. Adicionando Novo Subagente

Siga os 7 passos nesta ordem:

1. Crie `ai-service/src/agent/subagents/<nome>_agent.py` estendendo `BaseSubAgent`
2. Defina `name`, `system_prompt` e `tools` (actions que o subagente pode recomendar)
3. Exporte o subagente em `ai-service/src/agent/subagents/__init__.py`
4. Adicione a ferramenta de roteamento correspondente em `ORCHESTRATOR_ROUTING_TOOLS` em `prompts/orchestrator_prompt.py`
5. No `orchestrator.py`, instancie o subagente no `routing_tool_executor` para o novo tool name
6. Atualize o system prompt do orchestrator para descrever quando invocar o novo subagente
7. Escreva testes em `tests/agent/` validando que o subagente retorna `SubAgentResult` correto e que `tool_executor=None` (tool calls não executadas)

---

## 9. Gerenciamento de Estado do Agente

O `agent_state` é um dict persistido entre turns da conversa pelo backend NestJS.

### Campos observados no código

| Campo | Tipo | Uso |
|---|---|---|
| `active_questionnaire` | dict ou None | Questionário ESAS/PRO-CTCAE em andamento — ativa o fast-path |
| `questionnaire_step` | int | Step atual dentro do questionário |
| `questionnaire_responses` | list | Respostas coletadas |
| `last_disposition` | str | Última disposição clínica registrada |
| `conversation_turn` | int | Contador de turns para lógica de follow-up |

### Regras de estado

- O orchestrator retorna `new_state` — nunca mutá-lo in-place, sempre retornar nova cópia
- `active_questionnaire` é o único campo que altera o fluxo do pipeline (fast-path)
- Campos de estado não devem conter PHI além do necessário — `patient_id` e `tenant_id` ficam no trace, não no state

### Histórico de conversa

O `conversation_history` é uma lista de `{role: "user"|"assistant", content: str}`. O orchestrator e subagentes recebem este histórico para contexto. Nunca passar histórico completo ilimitado — o backend deve truncar para as últimas N mensagens antes de enviar.

---

## 10. Fallback e Modo Degradado

### Sem API keys

Quando `llm_provider.has_any_llm_key(agent_config) == False`:
- Pipeline LLM não é chamado
- `llm_provider._fallback_response()` é retornado como resposta
- Layers 1 (clinical_rules) e 3 (ML) continuam funcionando normalmente
- A resposta de fallback está em português, é clinicamente neutra e nunca contém conselho clínico específico

### Erro em subagente

`BaseSubAgent.run()` captura todas as exceções e retorna `SubAgentResult` com `error=str(e)` e listas vazias. O orchestrator trata subagentes com erro silenciosamente e continua com os outros.

### LLM retorna resposta vazia

Usar `llm_provider._fallback_response()` — nunca retornar string vazia como resposta ao paciente.

---

## 11. Logging por Nível

| Situação | Nível | Exemplo |
|---|---|---|
| `ER_IMMEDIATE` disparado | `WARNING` | `logger.warning(f"ER_IMMEDIATE: {rule_id}")` |
| `ER_DAYS` disparado | `INFO` | `logger.info(f"ER_DAYS: {rule_id}")` |
| Intent classificado | `INFO` | `logger.info(f"Intent classified: {intent} (confidence={...})")` |
| Subagente com erro | `ERROR` | `logger.error(f"[{self.name}] Subagent error: {e}")` |
| Step não-bloqueante com falha | `WARNING` | `logger.warning(f"...: {e}")` — continua |
| Sem disposição crítica | `DEBUG` | |

Nunca usar `print()`. Nunca logar valores de API key — usar forma mascarada `key[:4]...key[-4:]`.

---

## 12. O Que NUNCA Fazer

- **Nunca mover `clinical_rules_engine.evaluate()`** para depois do pipeline LLM — é invariante de segurança
- **Nunca rebaixar `ER_IMMEDIATE`** gerado por Layer 1 em qualquer layer posterior
- **Nunca adicionar `tool_executor` a subagentes** — tool calls devem permanecer enfileirados, não executados
- **Nunca chamar `backend_client`** de dentro do caminho crítico do triage (`_process_with_trace`)
- **Nunca passar `orch_config` para subagentes** — subagentes têm `max_tokens: 1024`, não 16000
- **Nunca assumir que a chave Anthropic está disponível** sem checar `has_anthropic_key()` antes do `run_agentic_loop()`
- **Nunca chamar `has_any_llm_key()` em loops** — cachear o resultado por request
- **Nunca retornar string vazia** como resposta ao paciente em qualquer path — usar `_fallback_response()`
- **Nunca criar subagente sem registrá-lo** em `ORCHESTRATOR_ROUTING_TOOLS` e no `routing_tool_executor`
- **Nunca usar `print()`** — sempre `logging.getLogger(__name__)`
- **Nunca adicionar lógica probabilística** (scores LLM, output ML) dentro de `clinical_rules.py`
- **Nunca expor `GET /api/v1/observability/traces`** sem autenticação em produção — contém PHI
- **Nunca persistir traces em banco de dados** — ring buffer in-memory apenas (MAX_TRACES = 500)
- **Nunca aumentar `MAX_SUBAGENT_ITERATIONS`** acima de 6 sem medir impacto em latência
- **Nunca criar fast-path** para intents com possível conteúdo clínico urgente — deixar no pipeline principal
