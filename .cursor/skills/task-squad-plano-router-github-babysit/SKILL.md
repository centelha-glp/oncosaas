---
name: task-squad-plano-router-github-babysit
description: Orquestra entrega ONCONAV em cadeia fixa — ciclo squad-onconav, plano atomizado de um passo, router de skills/agentes, disparo obrigatório de Tasks (subagent_type, modo strict suportado), organização GitHub e babysit de PR até merge-ready. Use quando o utilizador pedir esta sequência, fluxo completo de entrega com PR, modo strict, ou invocar explicitamente esta skill.
disable-model-invocation: false
---

# Sequência: squad → plano atomizado → router → **Tasks** → GitHub → babysit

## Quando aplicar

- Pedido explícito da **cadeia** `/plano-atomizado-proximo-passo` → `/task-skill-agent-router` → `/squad-onconav` → **Tasks reais** → `/github-organizer` → `/babysit`.
- Entrega que deve terminar em **PR organizada** e **CI/comentários tratados** até estado merge-ready.
- **Modo strict** desta cadeia (ver secção seguinte) ou invocação `/agente-onconav strict` em conjunto com esta skill.

## Modo strict (cadeia task-squad-plano-router-github-babysit)

Quando **qualquer** gatilho abaixo estiver ativo, aplicam-se **em cima** das regras gerais deste ficheiro as regras de [agente-onconav — Modo strict](../agente-onconav/SKILL.md) (análise + plano + Tasks reais + subtasks/to-dos; proibido substituir subagentes por texto).

### Gatilhos (qualquer um)

- Texto do utilizador: **«modo strict»**, **«strict»**, **«/agente-onconav strict»**, **«cria as tasks»**, **«aciona os squads com tasks»**, **«cadeia strict»**, **«entrega strict com PR»**.
- Esta skill **anexada** ou mencionada com instrução explícita de strict.

### Regras específicas desta cadeia em strict

1. **Plano strict (resumo)** — Antes de disparar Tasks, incluir bloco **«Plano strict»** com uma linha por delegação: `Task k: <subagent_type> — objetivo`, cobrindo o **router** (passo 2) e **squad-onconav** (passo 3) conforme o plano; sem saltar membros em ronda integral de `squad-*`.
2. **Ordem** — Respeitar a **Ordem obrigatória** da tabela abaixo: primeiro atomizar um passo → router com bloco obrigatório → disparar Tasks do plano → (após critério de pronto) `github-organizer` se houver commit/PR → babysit se houver PR.
3. **Cada prompt de Task** — Incluir obrigatoriamente: **modo strict**, **passo k/N** da cadeia, pedido original, paths `@`, **subtasks** numeradas, **to-dos**, **critério de pronto** (igual ao [agente-onconav](../agente-onconav/SKILL.md) — «Prompt mínimo para cada Task»).
4. **GitHub em strict** — Se existirem alterações para integrar, **uma Task** `github-organizer` após testes/risco alinhados ao pedido; não pular para babysit sem PR quando o objetivo é merge-ready.
5. **Proibido no strict** — Plano em texto sem **Task** correspondente; uma Task com dois `subagent_type`; omitir subtasks/to-dos no prompt; ignorar membro do squad em acionamento integral.

### Strict e exceções

- Os **gatilhos de strict** **não** cancelam a exceção «utilizador pede só agente principal sem subagentes» — nesse caso declarar no início **«strict desativado por pedido do utilizador»** e não disparar Tasks.

## Acionamento obrigatório — disparar Tasks (não só descrever)

Quando esta skill aplica-se, o agente principal **não pode** ficar só com tabelas de «Tasks» em markdown ou recomendações de `subagent_type` sem executar delegações, salvo **exceção** abaixo.

1. **Ler** os `SKILL.md` citados no plano (router, squad, cada `agente-*` envolvido) **antes** de delegar.
2. **Disparar Tasks** usando a ferramenta **Task** do Cursor: **uma Task por `subagent_type`**, nunca vários agentes na mesma Task.
3. **Prompt de cada Task** auto-contido: pedido do utilizador, passo da cadeia, paths `@`, subtasks numeradas, critério de pronto, modo strict desta skill quando aplicável.
4. **Paralelo:** várias Tasks na **mesma mensagem** quando o plano do router indicar independência; **sequencial** quando houver dependência (ex.: contrato antes de UI).
5. **Preencher** no bloco **«Acionamento (execução)»** do [task-skill-agent-router](../task-skill-agent-router/SKILL.md) as Tasks efetivamente disparadas (ou «nenhuma» só se exceção).

### Exceções (sem disparar Task)

- Utilizador pede **explicitamente** execução só pelo agente principal **sem** subagentes.
- Pedido **só explicação** / sem alterar o repositório.

Em **modo strict**, o reforço já está implícito nos gatilhos da secção anterior; ver também [agente-onconav](../agente-onconav/SKILL.md).

## Ordem obrigatória (não inverter)

| # | Skill / foco | O quê fazer |
|---|----------------|-------------|
| 1 | Plano atomizado (`plano-atomizado-proximo-passo`) | Ler `~/.cursor/skills/plano-atomizado-proximo-passo/SKILL.md` e aplicar ao **único** próximo passo em curso (objetivo, contexto, tabela Tasks/subtasks/to-dos, riscos, critério de pronto, exclusões). |
| 2 | [task-skill-agent-router](../task-skill-agent-router/SKILL.md) | Produzir o bloco **«Formato de saída (obrigatório)»**: análise router, skills recomendadas, plano de delegação `subagent_type`, squads integral vs mínimo; em seguida **disparar** as Tasks desse plano (secção «Acionamento obrigatório» acima). |
| 3 | [squad-onconav](../squad-onconav/SKILL.md) | Preencher **análise**, **plano de ação**; se o plano implicar squads, **acionamento integral** = **uma Task por membro** quando skill `squad-*` for usada (não substituir por texto). |
| 4 | [agente-github-organizer](../agente-github-organizer/SKILL.md) | Após código e testes alinhados ao pedido: **Task** `github-organizer` se a entrega exigir commits/PR organizados; caso contrário seguir a skill pelo principal após critério de pronto local. |
| 5 | Babysit | Ler `~/.cursor/skills-cursor/babysit/SKILL.md`; executar o loop da skill (comentários, conflitos seguros, CI até verde). Preferir o **agente principal** com hooks/`gh`/logs; usar **Task** só quando fizer sentido delegar investigação pesada de CI (ex.: `explore` readonly) — não é obrigatório uma Task por protocolo. |

**Nota:** O passo 4 costuma ser **uma Task** `github-organizer` quando há alterações para commitar/PR; se não houver mudanças de repo, não forçar Task só por protocolo.

## Regras de junção

- **Um passo de cada vez** no plano atomizado: não misturar vários «próximos passos» num único plano, salvo pedido explícito em contrário.
- **Uma Task = um `subagent_type`** em todas as fases que envolverem delegação (alinhado a [squad-onconav](../squad-onconav/SKILL.md) e ao router).
- **Qualidade antes do GitHub:** quando o pedido for sensível (auth, tenant, LGPD, endpoint novo), fechar testes e revisão de segurança **antes** de github-organizer, conforme [processo-gate-commit](../processo-gate-commit/SKILL.md) se aplicável (Tasks `test-generator`, `seguranca-compliance` quando o plano exigir).
- Se `plano-atomizado-proximo-passo` ou `babysit` **não** existirem nos paths acima, seguir o mesmo conteúdo funcional conhecido dessas skills (atomizar um passo; babysit = PR merge-ready, comentários, CI).

## Anti-padrões

- Em **modo strict**: omitir o bloco **«Plano strict»**, omitir **modo strict** no prompt das Tasks, ou concluir a cadeia sem Task quando o plano exige delegação.
- Produzir o bloco do router **sem** disparar as Tasks do plano na mesma execução quando o trabalho depende de subagentes (viola esta skill).
- Saltar o **router** após planear — o bloco obrigatório do router deve aparecer na resposta antes de novas delegações, salvo o utilizador já tiver fechado escopo só com execução local.
- Abrir **babysit** sem **PR** ou sem alterações para integrar — babysit é fase pós-PR (ou PR existente).
- Fundir vários `subagent_type` numa única Task.

## Referência rápida no repositório

- Índice de agentes e modo strict: [agente-onconav](../agente-onconav/SKILL.md)
- Router e formato de saída: [task-skill-agent-router](../task-skill-agent-router/SKILL.md)
- Processos: [processo-dev-onconav](../processo-dev-onconav/SKILL.md)
