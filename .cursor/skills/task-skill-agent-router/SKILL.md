---
name: task-skill-agent-router
description: Analisa o pedido, classifica domínios e riscos no ONCONAV, define o conjunto mínimo de skills e aciona-as (Read das SKILL.md + Tasks subagent_type). Use quando o utilizador pedir router, escolher agentes, orquestrar squads, use sempre que existir Tasks.
disable-model-invocation: false
---

# Router de tarefa → skills e agentes (ONCONAV)

## Objetivo

1. **Classificar** o pedido e fixar o conjunto **mínimo** de skills (`agente-*`, `squad-*`, `processo-*`) e de **`subagent_type`** (Tasks).
2. **Acionar** esse conjunto: não basta listar — o agente principal **deve** executar o acionamento (ver secção «Acionamento obrigatório» abaixo), salvo **exceções** explícitas nesta skill.

## Antes de classificar e acionar

1. **Tipo de pedido**
   - **Só explicação / sem código** → não listar Tasks; responder direto (ou citar docs).
   - **Escopo explícito** do utilizador (ex.: «só backend») → respeitar; não expandir squads sem necessidade.
2. **Domínios** — marcar o que a tarefa toca: `backend`, `frontend`, `ai-service`, `ML laboratório`, `priorização produto`, `RAG`, `clínico`, `FHIR`, `WhatsApp`, `infra`, `qualidade`, `produto/docs/Centelha`, `arquitetura cross-layer`.
3. **Risco** — `auth/JWT/tenant`, `LGPD/PII`, `endpoint novo`, `merge` → incluir fase de qualidade ou `seguranca-compliance` quando aplicável.
4. **Dependências** — ex.: contrato/API antes de UI; schema/migration antes de serviço que persiste dados.

## Regras de ouro (alinhadas ao repositório)

- **Uma Task = um `subagent_type`** — nunca fundir domínios na mesma Task.
- **Skill de squad** (`squad-*`) **utilizada** → [squad-onconav](../squad-onconav/SKILL.md): **acionar todos** os membros desse squad (uma Task por agente), salvo instrução explícita em contrário.
- **Skill só `agente-*`** → normalmente **uma** Task para esse agente; não convocar o squad inteiro.
- **Mapa canónico** `subagent_type` ↔ skill ↔ squad: [agente-onconav](../agente-onconav/SKILL.md) (tabela «Mapa agente → skill canónica → squad»).
- **Ordem entre squads** (entrega grande): Produto → Clínico (se houver) → IA/Dados (se houver) → Plataforma → Infra (se houver) → Qualidade (antes de merge) — detalhe em [squad-onconav](../squad-onconav/SKILL.md).

## Acionamento obrigatório (após o plano mínimo)

Quando esta skill aplica-se e **não** estás numa **exceção**, o agente principal **não pode** ficar apenas pelo bloco «recomendado» sem executar os passos abaixo.

1. **Ler** cada ficheiro `.cursor/skills/agente-<nome>/SKILL.md` (e, se o plano citar `squad-*` ou `processo-*`, a skill correspondente em `.cursor/skills/<nome>/SKILL.md`) **antes** de delegar, e seguir o que cada uma exige.
2. **Disparar Tasks**: para cada `subagent_type` do plano de delegação que seja necessário **para executar o pedido atual**, usar **uma Task por `subagent_type`** (nunca vários agentes na mesma Task), com prompt **auto-contido** (contexto, paths, critério de pronto).  
   - Se o plano indicar **paralelo** (`s/n`), preferir **várias Tasks na mesma mensagem** quando independentes.  
   - Se for **sequencial**, esperar o resultado (ou a notificação de conclusão) antes da Task seguinte quando houver dependência real.
3. **Skills só de processo** (`processo-*`): acionar = **ler** a skill e **executar** a sequência que ela define (incluindo Tasks dos agentes que a processo mandar disparar).
4. **Squad integral**: se o plano usar uma skill `squad-*`, acionar **todos** os membros — uma Task por `subagent_type` de cada membro — na ordem da própria skill do squad, salvo instrução explícita do utilizador em contrário.

### Exceções (sem Tasks obrigatórias)

- **Só explicação** / **sem alterar o repositório** / pedido **«só explica / não mudes código»**: responder direto; não é obrigatório Task nem listar fila.
- **Utilizador exige agente principal só** (ex.: «não uses subagentes»): cumprir; podes ainda **ler** a skill `agente-*` aplicável para seguir o protocolo, sem Task.
- **Escopo trivial já limitado** (ex.: typo num ficheiro) com **um** domínio: opcional uma única Task para o `agente-*` desse domínio **ou** execução pelo principal **desde que** a skill canónica desse domínio tenha sido **lida** neste turno.

## Heurísticas rápidas (glossário → escolha)

| Sinais no pedido | Preferir |
|------------------|----------|
| `backend/`, Prisma, Nest, rota, guard, DTO | `agente-backend-nestjs`; + `agente-database-engineer` se schema/migration/índice |
| `frontend/`, Next, React, UI | `agente-frontend-nextjs`; + `agente-ux-accessibility` se fluxo crítico ou a11y |
| FastAPI, orchestrator, pipeline mensagem | `agente-ai-service` |
| Treino, EDA, LightGBM, métricas modelo | `agente-data-scientist` |
| priorityScore, contrato `/prioritize`, joblib em produto | `agente-engenheiro-ia-predicao` |
| Conversa **e** score na mesma entrega | `agente-ai-ml-engineer` |
| RAG, FAISS, corpus, embeddings | `agente-rag-engineer` |
| Orchestrator multi-step, tool use | `agente-llm-agent-architect` |
| Prompts, context_builder, custo tokens | `agente-llm-context-engineer` |
| Protocolo/triagem/regra clínica **no código** | `agente-clinical-domain` |
| Parecer/terminologia **texto** (sem implementar regra) | `agente-especialista-medico` |
| FHIR, bundle, HIS | `agente-fhir-integration` |
| WhatsApp, channel-gateway | `agente-whatsapp-integration` |
| Docker, CI, compose | `agente-devops` |
| AWS ECS/RDS/etc. | `agente-aws` |
| Terraform | `agente-terraform` |
| Backlog, milestones | `agente-product-owner` |
| ADR, arquitetura multi-camada | `agente-architect` |
| OpenAPI, guias técnicos | `agente-documentation` |
| Centelha ES fase 2 | `agente-centelha-es-fase2` + skill [edital-centelha-es-fase2](../edital-centelha-es-fase2/SKILL.md) quando for texto de formulário |
| Performance mensurável | `agente-performance` |
| PR/commits | `agente-github-organizer` |
| Testes antes de commit | `agente-test-generator` ou skill [gerar-testes](../gerar-testes/SKILL.md) |
| LGPD/tenant/audit em mudança sensível | `agente-seguranca-compliance` |

## Skills de processo (meta-orquestração)

Usar quando o pedido for **fluxo de entrega**, não só «quem codifica»:

- Feature E2E: [processo-feature-e2e](../processo-feature-e2e/SKILL.md)
- Evolução pipeline IA: [processo-evolucao-ia-pipeline](../processo-evolucao-ia-pipeline/SKILL.md)
- Gate commit / merge: [processo-gate-commit](../processo-gate-commit/SKILL.md) e [processo-dev-onconav](../processo-dev-onconav/SKILL.md)
- Bugfix: [processo-correcao-bug](../processo-correcao-bug/SKILL.md)
- Deploy/infra: [processo-infra-deploy](../processo-infra-deploy/SKILL.md)
- Mudança clínica+IA: [processo-mudanca-clinica-ia](../processo-mudanca-clinica-ia/SKILL.md)

## Formato de saída (obrigatório)

Responder com este bloco (adaptar linhas; omitir secções vazias):

```markdown
### Análise (router)
- Pedido resumido:
- Domínios:
- Riscos:
- Dependências:

### Skills recomendadas (caminhos)
- `.cursor/skills/.../SKILL.md` (porquê)

### Plano de delegação (subagent_type)
1. `subagent_type` — objetivo — paralelo? (s/n)
2. ...

### Squads integral vs mínimo
- Se squad-X: listar todos os membros (ou citar skill squad-X).
- Se mínimo: justificar agentes omitidos.

### Acionamento (execução)
- Skills lidas (paths `SKILL.md`):
- Tasks disparadas: `subagent_type` + objetivo breve (ou «nenhuma» se exceção aplicável).

### Próximo passo
- Modo normal vs `/agente-onconav strict` (se fila de Tasks explícita).
- Se ainda faltam Tasks do plano: disparar na mensagem seguinte antes de dar como concluído.
```

## Anti-padrões

- **Só recomendar** skills e `subagent_type` **sem** `Read` das SKILL.md nem **Task** — viola esta skill (exceto exceções).
- Recomendar **squad completo** quando o pedido é **local** (ex.: typo num componente) — preferir um `agente-*`.
- Ignorar **multi-tenant / PII** em rotas ou Prisma — incluir `seguranca-compliance` na fase adequada.
- Confundir **`data-scientist`** (laboratório) com **`engenheiro-ia-predicao`** (contrato produto).

## Referência rápida

- Índice squads e ciclo de entrega: [squad-onconav](../squad-onconav/SKILL.md)
- Lista de agentes e skills funcionais: [agente-onconav](../agente-onconav/SKILL.md)
