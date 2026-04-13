---
name: plano-atomizado-proximo-passo
description: Monta um plano de execução atomizado e detalhado (tasks, subtasks, to-dos, critério de pronto) para o próximo passo sugerido no chat. Use quando o utilizador pedir plano atomizado do próximo passo, desdobrar o próximo passo sugerido, ou «o que fazer a seguir» com granularidade de tarefas.
---

# Plano atomizado — próximo passo sugerido no chat

## Quando aplicar

- O utilizador pede **plano atomizado**, **desdobrar o próximo passo**, **próximo passo em tasks**, ou equivalente.
- O foco é **um único passo** — o que o assistente acabou de sugerir como «próximo» **ou** um passo que o utilizador indique explicitamente (prevalece o do utilizador).

## Passo 0 — Ancorar o «próximo passo»

1. **Identificar** a sugestão mais recente de «próximo passo» na conversa (típico: última mensagem do assistente com recomendações, bullets «Próximos passos», ou conclusão com ação sugerida).
2. Se houver **várias** sugestões e o utilizador **não** escolheu: pedir **uma** pergunta curta — qual das opções desdobrar — antes do plano.
3. Se o utilizador **nomear** um passo diferente do último sugerido: usar **esse** como escopo do plano.

## Passo 1 — Produzir o plano atomizado

Responder em **português (Brasil)** com a estrutura abaixo. Ser **específico** ao repositório quando houver paths, módulos ou serviços mencionados no chat.

### 1. Objetivo do passo

- Uma frase: o que fica **pronto** quando este passo termina.

### 2. Contexto mínimo

- **Entrada:** de onde partir (estado atual, ficheiros ou decisões já tomadas no chat).
- **Restrições:** LGPD/multi-tenant, não alterar escopo além deste passo, outras que já existam na conversa.

### 3. Plano atomizado (obrigatório)

Para **cada Task** (unidade de trabalho delegável ou bloco sequencial se for um só agente):

| Task | Objetivo | Responsável sugerido (ONCONAV) | Subtasks (numeradas) | To-dos (checkbox) |
|------|-----------|----------------------------------|----------------------|-------------------|

- **Subtasks:** passos ordenados, cada um verificável.
- **To-dos:** itens rastreáveis no estilo `- [ ] …` (markdown).
- **Responsável:** usar o mapa de `subagent_type` em [agente-onconav](../agente-onconav/SKILL.md) quando o passo tocar backend, frontend, ai-service, etc.; se for trabalho do agente atual sem delegação, indicar **«agente principal»**.

### 4. Riscos e dependências

- O que pode bloquear; ordem se houver dependência entre subtasks.

### 5. Critério de pronto

- Lista curta e **mensurável** (ex.: testes X passam, endpoint Y responde Z, diff limitado a pastas …).

### 6. O que **não** fazer neste passo

- Evitar scope creep; explicitar 1–3 exclusões se ajudar.

## Alinhamento ONCONAV

- Ciclo canónico **análise → Tasks → subtasks → to-dos**: [squad-onconav](../squad-onconav/SKILL.md) e [agente-onconav](../agente-onconav/SKILL.md).
- Para **prompt copiável** com o mesmo nível de detalhe: [generate-cursor-prompts](../generate-cursor-prompts/SKILL.md).

## Anti-padrões

- Não substituir o plano por um parágrafo vago («implementar a feature») sem subtasks.
- Não misturar **vários** «próximos passos» num único plano — este skill é **um passo de cada vez**, salvo pedido explícito em contrário.
