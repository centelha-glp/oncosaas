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

O backend **não** envia chaves de LLM no `agent_config`; o ai-service usa apenas `os.getenv("OPENAI_API_KEY")` e `os.getenv("ANTHROPIC_API_KEY")`. Garanta que no ambiente onde o ai-service roda (ex.: terminal, systemd, Docker) pelo menos uma dessas chaves esteja definida para respostas geradas por IA.

## Mensagem de fallback do agente

Se o usuário receber a mensagem:

> "Sua mensagem foi registrada. No momento, nosso sistema de IA está sendo configurado..."

isso indica um dos casos abaixo:

1. **Nenhuma chave LLM no ambiente do ai-service** – `OPENAI_API_KEY` e `ANTHROPIC_API_KEY` não estão definidas (ou estão vazias) no processo que roda o ai-service. Configure pelo menos uma delas.
2. **Falha no loop do agente** – As chaves existem, mas a chamada ao LLM falhou (ex.: provedor indisponível, exceção no `run_agentic_loop`). Verifique logs do ai-service e conectividade com as APIs.

A priorização (`POST /prioritize`) é independente: pode retornar 200 com score heurístico mesmo sem LLM; o texto da resposta do chat vem sempre do `/agent/process`.
