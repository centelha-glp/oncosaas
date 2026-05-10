---
name: task-squad-plano-router-github-babysit
description: Orquestra entrega ONCONAV em cadeia fixa — ciclo squad-onconav, plano atomizado de um passo, router de skills/agentes, organização GitHub e babysit de PR até merge-ready. Use quando o utilizador pedir esta sequência, fluxo completo de entrega com PR, ou invocar explicitamente esta skill.
disable-model-invocation: false
---

# Sequência: squad → plano atomizado → router → GitHub → babysit

## Quando aplicar

- Pedido explícito da **cadeia** `/squad-onconav` → `/plano-atomizado-proximo-passo` → `/task-skill-agent-router` → `/github-organizer` → `/babysit`.
- Entrega que deve terminar em **PR organizada** e **CI/comentários tratados** até estado merge-ready.

## Ordem obrigatória (não inverter)

| # | Skill / foco | O quê fazer |
|---|----------------|-------------|
| 1 | [squad-onconav](../squad-onconav/SKILL.md) | Preencher **análise**, **plano de ação**, **Tasks/subtasks/to-dos**; respeitar acionamento integral de squads quando uma skill `squad-*` for usada. |
| 2 | Plano atomizado (`plano-atomizado-proximo-passo`) | Ler `~/.cursor/skills/plano-atomizado-proximo-passo/SKILL.md` se existir. Aplicar ao **único** próximo passo em curso (objetivo, contexto, tabela Tasks/subtasks/to-dos, riscos, critério de pronto, exclusões). |
| 3 | [task-skill-agent-router](../task-skill-agent-router/SKILL.md) | Produzir o bloco **«Formato de saída (obrigatório)»**: análise router, skills recomendadas, plano de delegação `subagent_type`, squads integral vs mínimo, próximo passo. |
| 4 | [agente-github-organizer](../agente-github-organizer/SKILL.md) | Após código e testes alinhados ao pedido: commits atómicos, PR estruturada, conforme processo do projeto. |
| 5 | Babysit | Ler `~/.cursor/skills-cursor/babysit/SKILL.md` se existir. Tratar comentários de review, conflitos quando seguro, CI até verde e PR pronta para merge. |

## Regras de junção

- **Um passo de cada vez** no passo 2: não misturar vários «próximos passos» num único plano atomizado, salvo pedido explícito em contrário.
- **Uma Task = um `subagent_type`** em todas as fases que envolverem delegação (alinhado a squad-onconav e ao router).
- **Qualidade antes do passo 4:** quando o pedido for sensível (auth, tenant, LGPD, endpoint novo), fechar testes e revisão de segurança **antes** de github-organizer, conforme [processo-gate-commit](../processo-gate-commit/SKILL.md) se aplicável.
- Se `plano-atomizado-proximo-passo` ou `babysit` **não** existirem nos paths acima, seguir o mesmo conteúdo funcional conhecido dessas skills (atomizar um passo; babysit = PR merge-ready, comentários, CI).

## Anti-padrões

- Saltar o **router** após planear — o bloco obrigatório do router deve aparecer na resposta antes de executar delegações novas, salvo o utilizador já tiver fechado escopo só com execução local.
- Abrir **babysit** sem **PR** ou sem alterações para integrar — babysit é fase pós-PR (ou PR existente).
- Fundir vários `subagent_type` numa única Task.

## Referência rápida no repositório

- Índice de agentes: [agente-onconav](../agente-onconav/SKILL.md)
- Processos: [processo-dev-onconav](../processo-dev-onconav/SKILL.md)
