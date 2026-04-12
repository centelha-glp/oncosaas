---
name: agente-onconav
description: Mapa de subagentes ONCONAV (skills agente-*), ciclo análise-plano-Tasks-subtasks-to-dos e modo strict. Use para escalar domínio, /agente-onconav strict ou plano de execução com Tasks.
---

# Agentes ONCONAV — índice e ajuda transversal

## Ciclo análise → plano → Tasks → subtasks → to-dos (agente único ou vários)

O mesmo **ciclo canónico** dos squads aplica-se aqui (secção **«Ciclo de entrega»**): [squad-onconav](../squad-onconav/SKILL.md).

- **Um só `agente-*`:** Análise → Plano (1 Task) → no **prompt** da Task, **subtasks** numeradas → **to-dos** até critério de pronto → execução detalhada (paths, testes).
- **Vários agentes sem skill de squad explícita:** Plano lista **N Tasks** (uma por `subagent_type`); cada Task com as suas subtasks e to-dos.
- **Squads completos:** usar [squad-onconav](../squad-onconav/SKILL.md); o plano de ação inclui **todas** as Tasks dos squads escolhidos, na ordem definida.

## Princípio

- Cada subagente tem skill **canónica** em `.cursor/skills/agente-<nome>/SKILL.md` (o `<nome>` coincide com `.cursor/agents/<nome>.md`).
- **Uma** Task (ferramenta de delegação) = **um** `subagent_type`.
- **Skills de squad** (`squad-*`): prevalecem as regras de [squad-onconav](../squad-onconav/SKILL.md) — **acionar todos** os membros (uma Task por agente), ordem nas secções «Ordem de acionamento» de cada `squad-*/SKILL.md`.
- **Skills só `agente-*`**: ativar **apenas** esse agente (uma Task), salvo o utilizador pedir squad completo ou modo strict multi-squad.

---

## Modo strict (obrigatório quando invocado)

**Gatilhos:** `/agente-onconav strict`, «modo strict», «cria as tasks», «aciona os squads com tasks», ou skill anexada com instrução strict.

Neste modo o **agente principal não substitui** subagentes por texto: **deve** criar **Tasks** reais (ferramenta Task do Cursor) com `subagent_type` definido, **uma por agente**, na ordem correta.

### Regras do modo strict

1. **Análise + plano antes de executar** — Preencher o **template** do ciclo de entrega em [squad-onconav](../squad-onconav/SKILL.md): análise, tabela de plano de ação, depois **Tasks** com **subtasks** e **to-dos** por Task.
2. **Plano strict (resumo)** — Bloco **«Plano strict»** com linhas: `Task k: <subagent_type> — objetivo` para **cada** delegação (sem saltar agentes em ronda integral de squad).
3. **Ordem** — Entre squads: [squad-onconav](../squad-onconav/SKILL.md). Dentro de cada squad: **«Ordem de acionamento»** no `squad-*/SKILL.md`.
4. **Execução** — Para cada linha, disparar **Task** com `subagent_type` exato; o **prompt** deve incluir as **subtasks** e referir os **to-dos** a fechar.
5. **Proibido no strict:** uma Task com vários domínios; omitir subtasks/to-dos; ignorar membro do squad em ronda integral.
6. **Paralelo:** só se a skill do squad permitir; caso contrário sequencial.

### Strict — um só agente

- Plano: **1 linha**.
- **1 Task** com esse `subagent_type`.

### Strict — um squad completo

- Abrir o [squad-onconav](../squad-onconav/SKILL.md) e o `squad-<nome>/SKILL.md` do squad.
- Plano: **N linhas** (N = número de membros; ex.: Plataforma = 4, IA/Dados = 7).
- **N Tasks** na ordem da secção «Ordem de acionamento».

### Strict — vários squads num pedido

- Plano por **fases** (ex.: Fase A Produto → Fase B Plataforma → Fase C Qualidade).
- Cada fase lista as Tasks **em ordem**; executar fase a fase (ou paralelo interno só onde a skill permitir).

### Prompt mínimo para cada Task

Incluir sempre: pedido do utilizador, **passo k/N**, **modo strict**, paths `@` relevantes, **subtasks** numeradas, **to-dos** a cumprir, **critério de pronto** mensurável.

---

## Mapa agente → skill canónica → squad

| subagent_type | Skill | Squad |
|---------------|--------|--------|
| `architect` | [agente-architect](../agente-architect/SKILL.md) | produto |
| `product-owner` | [agente-product-owner](../agente-product-owner/SKILL.md) | produto |
| `documentation` | [agente-documentation](../agente-documentation/SKILL.md) | produto |
| `centelha-es-fase2` | [agente-centelha-es-fase2](../agente-centelha-es-fase2/SKILL.md) | produto |
| `backend-nestjs` | [agente-backend-nestjs](../agente-backend-nestjs/SKILL.md) | plataforma |
| `frontend-nextjs` | [agente-frontend-nextjs](../agente-frontend-nextjs/SKILL.md) | plataforma |
| `database-engineer` | [agente-database-engineer](../agente-database-engineer/SKILL.md) | plataforma |
| `ux-accessibility` | [agente-ux-accessibility](../agente-ux-accessibility/SKILL.md) | plataforma |
| `clinical-domain` | [agente-clinical-domain](../agente-clinical-domain/SKILL.md) | clínico |
| `fhir-integration` | [agente-fhir-integration](../agente-fhir-integration/SKILL.md) | clínico |
| `whatsapp-integration` | [agente-whatsapp-integration](../agente-whatsapp-integration/SKILL.md) | clínico |
| `especialista-medico` | [agente-especialista-medico](../agente-especialista-medico/SKILL.md) | clínico |
| `ai-service` | [agente-ai-service](../agente-ai-service/SKILL.md) | ia-dados |
| `data-scientist` | [agente-data-scientist](../agente-data-scientist/SKILL.md) | ia-dados |
| `llm-agent-architect` | [agente-llm-agent-architect](../agente-llm-agent-architect/SKILL.md) | ia-dados |
| `llm-context-engineer` | [agente-llm-context-engineer](../agente-llm-context-engineer/SKILL.md) | ia-dados |
| `rag-engineer` | [agente-rag-engineer](../agente-rag-engineer/SKILL.md) | ia-dados |
| `engenheiro-ia-predicao` | [agente-engenheiro-ia-predicao](../agente-engenheiro-ia-predicao/SKILL.md) | ia-dados |
| `ai-ml-engineer` | [agente-ai-ml-engineer](../agente-ai-ml-engineer/SKILL.md) | ia-dados |
| `devops` | [agente-devops](../agente-devops/SKILL.md) | infra |
| `aws` | [agente-aws](../agente-aws/SKILL.md) | infra |
| `terraform` | [agente-terraform](../agente-terraform/SKILL.md) | infra |
| `test-generator` | [agente-test-generator](../agente-test-generator/SKILL.md) | qualidade |
| `seguranca-compliance` | [agente-seguranca-compliance](../agente-seguranca-compliance/SKILL.md) | qualidade |
| `performance` | [agente-performance](../agente-performance/SKILL.md) | qualidade |
| `github-organizer` | [agente-github-organizer](../agente-github-organizer/SKILL.md) | qualidade |

## Orquestração

- **Squad completo e ordem entre squads**: [squad-onconav](../squad-onconav/SKILL.md)
- **Processos**: [processo-dev-onconav](../processo-dev-onconav/SKILL.md)

## Skills legadas (atalhos)

`backend`, `frontend`, `ia`, `db`, `arquitetura`, `docs`, `po`, `seguranca`, `gerar-testes`, `acessibilidade`, `rag`, `modelo`, `prompt`, `deploy`, `infra`, `perf`, `whatsapp`, `fhir`, `validar-clinico`, `edital-centelha-es-fase2`, etc.
