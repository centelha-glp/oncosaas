---
name: squad-ia-dados
description: Squad IA/Dados ONCONAV — avaliação, orquestração e acionamento obrigatório dos 7 agentes de IA/ML (uma Task cada). Use para pipeline conversacional, RAG, prompts, modelo de priorização ou entrega cruzada conversa+score.
---

# Squad IA/Dados

Inteligência artificial e ciência de dados.

## Regras a carregar (@)

- `.cursor/rules/onconav-core.mdc`
- `.cursor/rules/ai-service.mdc`
- `.cursor/rules/llm-agent-architect.mdc`
- `.cursor/rules/llm-context-engineer.mdc`
- `.cursor/rules/rag-engineer.mdc`
- `.cursor/rules/engenheiro-ia-predicao.mdc`
- `.cursor/rules/engenheiro-ia-agentes.mdc`

## Análise, plano de ação, Tasks, subtasks e to-dos

Seguir o [ciclo de entrega em squad-onconav](../squad-onconav/SKILL.md). **Neste squad:** **7 Tasks** na ordem de acionamento; cada Task com **subtasks** (laboratório, contrato, fluxo, prompts, RAG, código, cruzado) e **to-dos**; plano pode ser longo — manter tabela resumo no topo do plano de ação.

## Avaliação obrigatória (antes das Tasks)

1. Classificar: **pipeline FastAPI**, **treino ML**, **orchestrator**, **prompts**, **RAG**, **score produto**, **cruzado conversa+modelo**.
2. Há mudança de contrato HTTP ou Prisma? Anotar `squad-plataforma` para depois.
3. Há validação clínica? Anotar `squad-clinico` se ainda não corrido.

## Acionamento integral do squad (obrigatório)

Acionar **todos** os sete agentes — **uma Task por `subagent_type`**.

## Ordem de acionamento (obrigatória na 1.ª ronda)

Seguir **esta sequência** (modelo offline e contrato de score antes do desenho de fluxo; integração FastAPI depois dos artefactos de LLM/RAG; agente cruzado por último):

| Passo | subagent_type | Ficheiro | Porquê esta ordem |
|-------|---------------|----------|-------------------|
| **1** | `data-scientist` | `.cursor/agents/data-scientist.md` | EDA, treino, métricas — base numérica primeiro. |
| **2** | `engenheiro-ia-predicao` | `.cursor/agents/engenheiro-ia-predicao.md` | Contrato de priorização no produto alinhado ao modelo. |
| **3** | `llm-agent-architect` | `.cursor/agents/llm-agent-architect.md` | Orchestrator e fluxo multi-step. |
| **4** | `llm-context-engineer` | `.cursor/agents/llm-context-engineer.md` | Prompts e `context_builder` sobre o fluxo definido. |
| **5** | `rag-engineer` | `.cursor/agents/rag-engineer.md` | Corpus, FAISS, retrieval após contexto/prompts claros. |
| **6** | `ai-service` | `.cursor/agents/ai-service.md` | FastAPI e encaixe no repositório `ai-service/`. |
| **7** | `ai-ml-engineer` | `.cursor/agents/ai-ml-engineer.md` | Síntese conversa + modelo; ou **N/A** se não for entrega cruzada. |

**Paralelo:** nos passos **3–5**, se o pedido for só **análise** sem dependência de output, podem correr em paralelo **após** concluir **1** e **2**; para **implementação** no mesmo ficheiro, manter a ordem **3 → 4 → 5 → 6**.

**Sem treino de modelo novo:** passo **1** com N/A breve; mantém-se **2 → … → 7**.

Indicar na Task **passo N/7**.

## Orquestração

Contrato backend: `squad-plataforma`. Fecho: `squad-qualidade`.
