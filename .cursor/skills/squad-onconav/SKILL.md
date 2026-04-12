---
name: squad-onconav
description: Índice dos squads ONCONAV com ciclo análise-plano-Tasks-subtasks-to-dos, avaliação, orquestração e acionamento integral. Use para /squad-*, time por área ou alinhamento com .claude/squads.md.
---

# Squads ONCONAV — índice

## Ciclo de entrega: análise → plano → Tasks → subtasks → to-dos → execução

Separar sempre o trabalho em **camadas**. O agente principal (e, por extensão, cada subagente na sua Task) segue esta lógica:

| Camada | O quê | Onde vive |
|--------|--------|-----------|
| **1. Análise** | Sintetizar o pedido, restrições, riscos (LGPD, multi-tenant), **quais squads** entram e o que fica **fora de escopo**. | Resposta do agente principal **antes** de delegar. |
| **2. Plano de ação** | Lista **ordenada de fases**: entre squads (ver secção abaixo) e, dentro de cada squad, ordem em `squad-*/SKILL.md`. Objetivo e **saída esperada** por fase. | Tabela ou lista numerada no chat. |
| **3. Tasks** | Cada **Task** (ferramenta Cursor) = **exatamente um** `subagent_type`. Uma Task = um “pacote” de trabalho para um agente. | Uma linha por delegação: `Task k: <subagent_type> — objetivo`. |
| **4. Subtasks** | **Dentro do prompt** de cada Task, lista numerada de passos **concretos** (ficheiros `@`, comandos, decisões). Não são Tasks novas — decompõem a Task. | Corpo do `prompt` da Task. |
| **5. To-dos** | Checklist **rastreável** por Task ou por fase: itens pequenos e verificáveis. Usar a **ferramenta de to-dos** do Cursor (`todo_write`) quando existir; senão checklist em markdown com `[ ]` / `[x]`. | Atualizar ao concluir subtasks ou ao fechar cada Task. |
| **6. Execução detalhada** | Para cada Task/subtask: **quem** (subagent_type), **o quê**, **ordem**, paths, **critério de pronto** mensurável (ex.: “testes X passam”, “DTO alinhado ao OpenAPI”). | Prompt da Task + fecho com verificação explícita. |

### Template obrigatório (agente principal)

Copiar e preencher **antes** da primeira delegação (adaptar ao número de Tasks):

```markdown
### Análise
- Pedido:
- Escopo / não escopo:
- Squads e ordem:

### Plano de ação
| # | Squad / fase | Agentes (subagent_type) | Saída esperada |
|---|----------------|-------------------------|----------------|

### Tasks e subtasks
1. **Task** `subagent_type` — objetivo de uma linha
   - Subtasks: (1) … (2) … (3) …
   - To-dos: [ ] … [ ] …
2. **Task** …
```

### Regras

- **Tasks** ≠ subtasks: Task = delegação ao subagente; subtasks = passos **dentro** do prompt.
- **To-dos** acompanham progresso; não substituem Tasks.
- Após cada Task concluída, **reconciliar** to-dos e, se necessário, **atualizar** o plano antes da Task seguinte.

---

## Avaliação obrigatória (agente principal)

Antes de qualquer Task, o agente principal **deve**:

1. **Ler** o pedido e listar **domínios** envolvidos (backend, frontend, IA, clínico, infra, qualidade, produto).
2. **Escolher o(s) squad(s)** adequados; abrir o `SKILL.md` de cada squad aplicável.
3. **Mapear dependências** entre squads (ex.: Produto → Plataforma → Qualidade) e **ordem entre squads** quando a tarefa for multi-squad.
4. **Dentro de cada squad acionado**: seguir a secção **«Acionamento integral»** da skill desse squad (todos os membros, uma Task por agente).

## Regra de acionamento integral (squads)

Quando uma **skill de squad** (`squad-produto`, `squad-clinico`, `squad-plataforma`, `squad-ia-dados`, `squad-infra-cloud`, `squad-qualidade`) for **utilizada** (anexada, referenciada ou escolhida pelo contexto), o agente principal **deve acionar todos** os `subagent_type` listados nessa skill como **membros do squad** — **uma Task por agente**, nunca vários agentes fundidos numa única Task.

- **Paralelo** entre membros: só quando a skill do squad indicar **«paralelo permitido»** para aquele passo; caso contrário respeitar a **ordem numerada**.
- **Sequencial** quando a skill listar passos **1 → 2 → 3** (ex.: Qualidade antes de merge).
- Agentes cujo domínio pareça marginal: enviar **mesmo assim** uma Task com o contexto global; o subagente responde com contributo no seu âmbito ou **N/A** justificado.

## Uma Task = um `subagent_type`

Cada delegação referencia **exatamente um** agente. A orquestração é o **conjunto** das Tasks disparadas para cumprir o squad (e depois outros squads se necessário).

## Ordem típica **entre squads** (entrega completa)

Quando vários squads entrarem no mesmo pedido, o agente principal segue esta **sequência de fases** (salvo dependência óbvia em sentido contrário):

1. **[squad-produto](../squad-produto/SKILL.md)** — escopo, contrato, docs de produto, edital (se aplicável).
2. **[squad-clinico](../squad-clinico/SKILL.md)** — se houver regra/protocolo/canal clínico.
3. **[squad-ia-dados](../squad-ia-dados/SKILL.md)** — se houver pipeline de IA, RAG ou score.
4. **[squad-plataforma](../squad-plataforma/SKILL.md)** — backend, frontend, DB, a11y.
5. **[squad-infra-cloud](../squad-infra-cloud/SKILL.md)** — só se a tarefa for infra/deploy.
6. **[squad-qualidade](../squad-qualidade/SKILL.md)** — antes de merge (última fase habitual).

Omite fases que **não** se aplicam. Dentro de **cada** squad, seguir a **ordem de acionamento** definida no `SKILL.md` desse squad.

## Skills de squad (ordem **dentro** do squad → ver cada ficheiro)

| Skill | Pasta | Membros | Onde está a ordem explícita |
|-------|--------|---------|------------------------------|
| Squad Produto | [squad-produto](../squad-produto/SKILL.md) | 4 agentes | Secção «Ordem de acionamento» |
| Squad Clínico | [squad-clinico](../squad-clinico/SKILL.md) | 4 agentes | Secção «Ordem de acionamento» |
| Squad Plataforma | [squad-plataforma](../squad-plataforma/SKILL.md) | 4 agentes | Secção «Ordem de acionamento» |
| Squad IA/Dados | [squad-ia-dados](../squad-ia-dados/SKILL.md) | 7 agentes | Secção «Ordem de acionamento» |
| Squad Infra/Cloud | [squad-infra-cloud](../squad-infra-cloud/SKILL.md) | 3 agentes | Secção «Ordem de acionamento» |
| Squad Qualidade | [squad-qualidade](../squad-qualidade/SKILL.md) | 4 agentes | Secção «Ordem de acionamento» |

## Skills por agente (ativação isolada)

Fora do modo squad integral: [agente-onconav](../agente-onconav/SKILL.md).

**Modo strict (Tasks obrigatórias):** quando o pedido exigir fila explícita de delegações, usar a secção **«Modo strict»** em [agente-onconav](../agente-onconav/SKILL.md) (`/agente-onconav strict`).

## Processos de desenvolvimento

Fluxos multi-squad: [processo-dev-onconav](../processo-dev-onconav/SKILL.md).

## Referência

`.claude/squads.md` na raiz do repositório.
