# AI Service (OncoNav)

Serviço Python FastAPI para priorização de pacientes (modelo ML) e agente conversacional (LLM) integrado ao WhatsApp.

## Variáveis de ambiente

O processo que executa o ai-service deve ter acesso a:

| Variável | Obrigatória para agente | Descrição |
|----------|-------------------------|-----------|
| `OPENAI_API_KEY` | Uma das duas | Chave da API OpenAI (usada pelo agente quando configurado). |
| `ANTHROPIC_API_KEY` | Uma das duas | Chave da API Anthropic (usada pelo agente quando configurada). |
| `BACKEND_URL` | Não | URL do backend (default: `http://localhost:3002`). |
| `BACKEND_SERVICE_TOKEN` | Sim (produção) | Token para autenticação backend → ai-service. |
| `AI_SERVICE_REQUIRE_SERVICE_TOKEN` | Não | Se definido como verdadeiro, o serviço exige token configurado mesmo em dev (alinhado a produção). |

O backend **não** envia chaves de LLM no `agent_config`; o ai-service usa apenas `os.getenv("OPENAI_API_KEY")` e `os.getenv("ANTHROPIC_API_KEY")`. Garanta que no ambiente onde o ai-service roda (ex.: terminal, systemd, Docker) pelo menos uma dessas chaves esteja definida para respostas geradas por IA.
Para desenvolvimento local neste serviço, o arquivo carregado é somente `ai-service/.env` (não há fallback para `.env` no diretório pai).

## Mensagem de fallback do agente

Se o usuário receber a mensagem:

> "Sua mensagem foi registrada. No momento, nosso sistema de IA está sendo configurado..."

isso indica um dos casos abaixo:

1. **Nenhuma chave LLM no ambiente do ai-service** – `OPENAI_API_KEY` e `ANTHROPIC_API_KEY` não estão definidas (ou estão vazias) no processo que roda o ai-service. Configure pelo menos uma delas.
2. **Falha no loop do agente** – As chaves existem, mas a chamada ao LLM falhou (ex.: provedor indisponível, exceção no `run_agentic_loop`). Verifique logs do ai-service e conectividade com as APIs.

A priorização (`POST /prioritize`) é independente: pode retornar 200 com score heurístico mesmo sem LLM; o texto da resposta do chat vem sempre do `/agent/process`.

## Organização de Rotas

As rotas FastAPI estão em `src/routes/` (não mais em `src/api/routes.py`), e o app
importa o router central de `src.routes`.

## Modelos LLM (agente conversacional)

- **Padrão atual:** `claude-haiku-4-5` para orquestrador e subagentes (`src/config/llm_defaults.py`).
- `use_adaptive_thinking: True` no orquestrador **só tem efeito** com modelos que suportam thinking adaptativo (ex. Opus/Sonnet 4.6); com Haiku permanece inativo — reservado para upgrade futuro de modelo.
- O classificador de intent (`intent_classifier.py`) está **deprecated** no hot path: `AgentOrchestrator.process()` não o invoca.

## Testes

Execute todos os testes com:

- `python3 -m pytest -q`

Estrutura atual da suíte:

- `tests/agent/` — agente, regras clínicas, provedor LLM
- `tests/models/` — modelo de prioridade
- `tests/services/` — integração com backend client
- `tests/system/` — smoke/import checks
- `tests/fixtures/` — payloads de apoio
- `tests/eval/` — harness de regressão dos assistentes clínicos (estruturação v3, exam-extract)

## Evals clínicos (estruturação e exames)

Regressão reproduzível **sem LLM live** no CI: valida parse Pydantic, campos obrigatórios e comparação com golden JSON.

| Item | Caminho |
|------|---------|
| Fixtures sintéticas | `eval/fixtures/clinical_eval/` |
| Harness | `eval/harness.py` |
| Relatório JSON (gitignored) | `eval/out/` |
| Testes pytest | `tests/eval/test_clinical_eval_harness.py` |

### Comandos

```bash
cd ai-service

# Suíte completa (inclui eval)
python -m pytest tests/ -q

# Só eval determinístico
python -m pytest tests/eval/ -q

# Harness + relatório no terminal e em eval/out/report.json
python -m eval
python -m eval --report eval/out/meu-relatorio.json
```

### Adicionar um caso golden

1. Crie `eval/fixtures/clinical_eval/structure_v3/<nome>/` ou `exam_extract/<nome>/`.
2. Coloque `llm_output.json` (JSON que o modelo devolveria) e `golden.json` com bloco `expect`.
3. Veja exemplos e campos em `eval/fixtures/clinical_eval/README.md`.
4. Rode `python -m eval` até `failed == 0`.

**LGPD:** não commitar laudos ou evoluções reais — apenas texto sintético ou redigido.

### Eval com LLM real (opcional, fora do CI default)

Requer `OPENAI_API_KEY` e/ou `ANTHROPIC_API_KEY` no `ai-service/.env`:

```bash
RUN_LLM_EVAL=1 python -m pytest tests/eval/test_clinical_eval_harness.py::test_structure_live_llm_smoke -q
```

O job `ai-service` no GitHub Actions executa `python -m eval` após o pytest (sem `RUN_LLM_EVAL`).

### Métricas no relatório

- `parse_ok_rate` — fração de casos em que o JSON estruturado foi parseado
- Por caso: contagens de exames, medicamentos, erros de diff vs `golden.json`
- Falhas listam campo esperado vs obtido

### Structured output (estruturação v3 e exames)

| Rota | Mecanismo | Provedor |
|------|-----------|----------|
| `POST /api/v1/clinical-evolution/structure` | Tool `structure_signed_evolution_output` via `generate_with_tools` | Anthropic (preferido) ou OpenAI fallback |
| `POST /api/v1/clinical-evolution/suggest-orders` | Pipeline 4× tools (`exam_context_output`, `rx_context_output`, `exam_generate_output`, `rx_generate_output`) via `generate_with_tools`; truncamento inteligente partilhado com estruturação | Idem |
| `POST /api/v1/exam-extract` | JSON schema / tool dedicado em `generate_exam_extract_structured` | OpenAI multimodal + Anthropic quando aplicável |
| `POST /api/v1/agent/nurse-assist` | Tool `nurse_assist_output` | Idem |

Sem chaves LLM: estruturação responde **503**; exam-extract usa mock apenas com flag explícita de desenvolvimento.

**Prompt caching (exames):** blocos estáticos do system prompt de `exam_extract` ficam no início; conteúdo multimodal (PDF/imagem) no fim do user message — favorece cache hit em requisições repetidas do mesmo tenant com o mesmo system prompt.

### Limitações

- Não cobre o agente WhatsApp/orchestrator (fora do escopo desta fase).
- Eval live depende de quota/latência do provedor; use só em máquina local ou pipeline manual.
- O harness valida parse/contrato HTTP; não substitui revisão clínica humana em produção.
