---
name: generate-cursor-prompts
description: Gera prompts estruturados e executáveis para o agente do Cursor (Composer/Chat). Inclui plano atomizado (tasks, subtasks, to-dos), responsável /agente por task e @pastas/@arquivos. Use quando o usuário pedir prompt para o Cursor, instruções para o Agent ou tarefa copiável com escopo claro.
---

# Gerar Prompts para o Cursor

## Objetivo

Produzir prompts autocontidos, claros e orientados à ação para colar no **Cursor** (Chat ou Composer com Agent). O executor é o agente do Cursor no repositório: deve receber investigação obrigatória antes de codar, requisitos verificáveis, **plano de implementação atomizado** (tasks → subtasks → to-dos das subtasks), **responsável por task** no formato `/<agente>`, e anti-padrões explícitos.

## Template obrigatório

Todo prompt gerado deve seguir esta estrutura (no arquivo da skill o template usa cercas de **quatro crases** para poder incluir exemplos com tres crases dentro):

````markdown
# Contexto

[1-2 frases: cenário, módulo/pasta e onde a tarefa se encaixa.]

# Pastas e arquivos para anexar (@) — recomendado

[Listar linhas `@caminho/` ou `@arquivo` que o executor deve anexar no Chat/Composer. Priorizar pastas de escopo (ex.: `@backend/src/auth/`) em vez de um único arquivo quando a tarefa for ampla. Se o usuário não souber o alvo, sugerir pastas plausíveis no ONCONAV e pedir confirmação no repo na investigação.]

# Investigacao Antes de Executar (obrigatorio)

Antes de escrever ou alterar codigo, o agente do Cursor deve:

1. Ler arquivos e padroes relevantes no repo (ferramentas de busca/leitura), alinhar com convencoes do projeto.
2. Confirmar onde aplicar a mudanca (arquivos/modulos/rotas) e responsabilidades por camada.
3. Listar suposicoes apenas se faltar informacao; quando possivel, validar com o repo ou perguntar ao usuario.
4. So entao propor e executar o plano (edits minimos e focados na tarefa).

# Tarefa

[Descricao concisa com verbos de acao: criar, implementar, corrigir, refatorar, adicionar, remover.]

# Requisitos

- [Obrigatorio 1]
- [Obrigatorio 2]
- [Restricoes tecnicas ou de produto]

# Plano de implementacao (atomizado)

Cada **Task** deve indicar o subagente ONCONAV responsavel no formato **`/<agente>`** (ex.: `/backend-nestjs`, `/frontend-nextjs`). Usar o **id** da coluna `subagent_type` na tabela «Mapa agente → skill» em `.cursor/skills/agente-onconav/SKILL.md` no repositorio.

Estrutura obrigatoria por Task:

1. Titulo: `## Task N /<agente> — titulo curto` (N = ordem de execucao sugerida).
2. Uma linha **Objetivo** (o que entrega esta Task).
3. **Subtasks** numeradas (`### Subtask N.M — nome`); em cada subtask, lista de **to-dos** em checkboxes `- [ ]` rastreaveis (criterio de pronto por item).
4. Dependencias entre tasks (ex.: «apos Task 1») quando nao for obvio.

Para escopo **minimo** (um unico dominio), permitir **1 Task** com `/agente` unico e poucas subtasks; nao omitir o bloco inteiro.

Exemplo de formato (ilustrativo):

```markdown
## Task 1 /backend-nestjs — Estender API de listagem

**Objetivo:** Suportar query params de intervalo de datas com filtro por tenantId.

### Subtask 1.1 — DTO e validacao
- [ ] Estender DTO de query com inicio/fim opcionais
- [ ] Validar intervalo (inicio <= fim) e tipos

### Subtask 1.2 — Service e Prisma
- [ ] Aplicar filtro no `where` escopado por tenant
- [ ] Manter paginacao existente

## Task 2 /frontend-nextjs — UI do filtro

**Objetivo:** Date range na listagem alinhado aos query params.

### Subtask 2.1 — Estado e URL
- [ ] Sincronizar range com searchParams
- [ ] Integrar ao hook de dados existente
```

# Formato esperado

[O que entregar: arquivos tocados, testes, convencoes; se usar UI, acessibilidade/padroes do frontend quando aplicavel.]

# Nao fazer

- [Anti-padroes, escopo proibido, drive-by refactor]
````

## Referencia a pastas e arquivos (@) — obrigatorio na geracao

Todo prompt gerado deve incluir a secao **Pastas e arquivos para anexar (@)** (mesmo que com uma unica pasta) e a secao **Plano de implementacao (atomizado)** com pelo menos uma **Task** `/<agente>` e subtasks com to-dos, salvo pedido explicito do usuario para prompt minimalista sem anexos ou sem plano.

- **Formato**: uma linha por anexo, usando `@` na raiz do workspace (ex.: `@backend/src/messages/`, `@frontend/src/components/`). O Cursor injeta esses caminhos como contexto.
- **Escopo**: para features ou auditorias, preferir **pastas** (`@pasta/`) que cubram o modulo; para bug pontual, `@arquivo` especifico + pasta pai se util.
- **Quando o alvo for incerto**: listar pastas candidatas e, na investigacao, mandar o executor confirmar paths reais no repo antes de editar.
- **Mapa tipico ONCONAV** (ajustar se o repo divergir): `@backend/` (NestJS, Prisma em `backend/prisma/`), `@frontend/` (Next.js), `@ai-service/` (FastAPI), `@docs/` ou `docs/`, regras em `@.cursor/rules/`.

## Referencia a agentes (`/<agente>`) — obrigatorio no plano

- **Sintaxe**: `/<agente>` com **id** igual a `subagent_type` (ex.: `/seguranca-compliance`, `/ai-service`). Um **principal** por Task; se uma subtask for claramente de outro dominio, dividir em outra Task ou outra subtask com nota «delegar a /outro-agente».
- **Fonte de verdade**: tabela em [agente-onconav](../agente-onconav/SKILL.md). Nao inventar ids; se houver duvida entre dois agentes, preferir o mais especifico e documentar na investigacao.
- **Squads**: se o pedido corresponder a uma skill `squad-*`, o plano deve listar **uma Task por membro** exigido pela skill, cada uma com seu `/<agente>`, na ordem da skill (ver [squad-onconav](../squad-onconav/SKILL.md)).
- **Modo strict / Cursor Task tool**: quando o usuario pedir execucao por subagentes reais, o texto do prompt pode repetir o plano como «Plano strict» com as mesmas linhas `Task k: /<agente> — objetivo` (alinhado a [agente-onconav](../agente-onconav/SKILL.md) modo strict).

## Especifico do Cursor (incluir no prompt quando fizer sentido)

- **Anexos**: Repetir ou reforcar os `@` mais criticos tambem em **Contexto** ou **Tarefa** se ajudar o executor a nao perder o foco.
- **Regras do workspace**: Se a tarefa for sensivel (auth, tenant, LGPD, stack ONCONAV), incluir `@.cursor/rules/` ou arquivos de regra citados (ex.: `security.mdc`) na lista de anexos.
- **Um objetivo por prompt**: Entregas muito grandes podem virar **prompts sequenciais** (cada um com seu plano atomizado e tasks coerentes com o recorte).
- **Ambiente**: Se precisar de comando (testes, migrate), pedir execucao via terminal do Cursor em vez de supor caminhos absolutos do SO do usuario.

## Workflow de geracao

1. **Clarificar** o que o usuario quer que o Cursor faca no repo.
2. **Definir anexos @**: pastas e/ou arquivos relevantes (mapa ONCONAV + o que o usuario citar); sem inventar paths — quando duvidoso, sugerir candidatos + confirmacao na investigacao.
3. **Mapear agentes**: para cada fatia de trabalho, escolher `/<agente>` valido; se for squad, incluir todos os membros obrigatorios na ordem correta.
4. **Delegar investigacao** ao executor (bloco obrigatorio antes de codar).
5. **Requisitos** primeiro os obrigatorios; restricoes depois.
6. **Atomizar o plano**: tasks ordenadas, subtasks por task, to-dos em checkboxes por subtask; nenhuma task sem `/<agente>`.
7. **Formato esperado** do entregavel (codigo, lista de arquivos, testes).
8. **Nao fazer** para limitar escopo e slop.
9. **Montar** o prompt final com **Pastas e arquivos para anexar (@)** e **Plano de implementacao (atomizado)** preenchidos, pronto para copiar.

## Principios

- **Especifico > generico**: nomes de modulo, rota, componente ou sintoma do bug.
- **Contexto minimo**: Nao inventar detalhes do repo; o prompt manda o agente investigar.
- **Anexos @ sempre que fizer sentido**: pastas primeiro; reduz tokens mal gastos e alinha o executor ao escopo.
- **Plano atomizado**: cada to-do deve ser acionavel e verificavel; evitar subtasks vagas («melhorar codigo»).
- **Um agente por Task** (excecao: nota de delegacao ou squad explicito).
- **Formato explicito**: criar vs editar vs ambos; sem markdown de documentacao extra salvo se for o objetivo.

## Tarefas comuns

| Tipo | Contexto util | Plano / agentes tipicos |
|------|----------------|-------------------------|
| Feature | Modulo, API, UI | Tasks por camada: `/backend-nestjs`, `/frontend-nextjs`; Prisma: `/database-engineer` |
| Bug | Sintoma, fluxo | 1 Task `/agente` do modulo afetado; subtasks para repro, fix, teste |
| Refator | Escopo, objetivo | `/backend-nestjs` ou agente do modulo; manter API/testes |
| Docs | Pasta docs/ | `/documentation`; alinhar com codigo: `/clinical-domain` etc. se clinico |
| Seguranca / PR | Auditoria, gate | `/seguranca-compliance`, `/test-generator`, `/github-organizer` em sequencia se pedido |

## Output para o usuario

Entregar em bloco markdown com titulo **Prompt para o Cursor** e instrucao de uso:

```markdown
## Prompt para o Cursor

Copie o bloco abaixo e cole no Chat ou no Composer (Agent) do Cursor:

---
[Prompt gerado com o template]
---
```

Opcional: uma linha lembrando de **anexar no Composer** as pastas `@...` listadas na secao do prompt (ou arrastar pastas do explorer para o contexto) e de **seguir o plano** task a task, usando `/<agente>` para delegar ao subagente correto (Task tool ou conversa com o agente indicado).

## Exemplos

Ver [examples.md](examples.md).
