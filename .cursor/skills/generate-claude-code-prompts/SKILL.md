---
name: generate-claude-code-prompts
description: Gera prompts estruturados para Claude Code com investigação obrigatória antes de codar, plano atomizado (tasks → subtasks → to-dos), responsável /agente por task, paths @ e anti-padrões. Use quando o usuário pedir prompt para Claude Code, instruções para execução no repo ou tarefa copiável com escopo claro.
---

# Gerar Prompts para Claude Code

## Objetivo

Produzir prompts estruturados e executáveis que serão usados no **Claude Code** para realizar tarefas solicitadas. O prompt deve ser autocontido, claro e orientado à ação, com **plano de implementação atomizado** (tasks → subtasks → to-dos por subtask), **`/<agente>` por task** quando o trabalho for no ecossistema ONCONAV, e seção de **paths recomendados** (`@`). **Não** referenciar arquivos em `.cursor/` nos prompts gerados: usar a documentação em **`.claude/`** (agentes, squads, rules).

## Template obrigatório

Todo prompt gerado deve seguir esta estrutura (no arquivo da skill o template usa cercas de **quatro crases** para poder incluir exemplos com tres crases dentro):

````markdown
# Contexto

[1-2 frases descrevendo o cenário/projeto e onde a tarefa se encaixa.]

# Pastas e arquivos para anexar (@) — recomendado

[Listar linhas `@caminho/` ou `@arquivo` que o Claude Code deve priorizar na leitura. No Claude Code, usar como lista explícita de escopo se não houver injeção automática de @. Priorizar pastas de módulo em vez de um único arquivo quando a tarefa for ampla. Se o alvo for incerto, sugerir pastas plausíveis no ONCONAV e pedir confirmação na investigação.]

# Investigacao Antes de Executar (obrigatorio)

Antes de escrever qualquer codigo, o Claude Code deve:

1. Levantar o que precisa para executar com precisao (ler arquivos relevantes no repo, identificar padroes/convencoes e pontos de integracao).
2. Confirmar onde a mudanca deve ser aplicada (arquivos/modulos/rotas/servicos) e quais responsabilidades cada camada tem.
3. Listar suposicoes apenas se algo estiver faltando (e, se possivel, checar via ferramentas; caso nao seja possivel, perguntar).
4. Somente depois disso, propor e executar o plano de implementacao (seguindo as Tasks na ordem, marcando to-dos concluidos).

# Tarefa

[Descricao concisa e especifica do que deve ser feito. Verbos de acao: criar, implementar, corrigir, refatorar, adicionar, remover.]

# Requisitos

- [Requisito 1 - obrigatorio]
- [Requisito 2 - obrigatorio]
- [Restricoes ou preferencias tecnicas]

# Plano de implementacao (atomizado)

Cada **Task** deve indicar o agente ONCONAV responsavel no formato **`/<agente>`** (ex.: `/backend-nestjs`, `/frontend-nextjs`). Usar o **id** do agente (nome entre crases nas tabelas) conforme `.claude/agent-architecture.md` e `.claude/squads.md` no repositorio — nao inventar ids.

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

[O que o resultado deve conter: arquivos, estrutura, convencoes, testes; se usar UI, acessibilidade quando aplicavel.]

# Nao fazer

- [Anti-padrao ou erro a evitar]
````

## Referencia a pastas e arquivos (@) — obrigatorio na geracao

Todo prompt gerado deve incluir a secao **Pastas e arquivos para anexar (@)** (mesmo que com uma unica pasta) e a secao **Plano de implementacao (atomizado)** com pelo menos uma **Task** `/<agente>` e subtasks com to-dos, salvo pedido explicito do usuario para **prompt minimalista** sem anexos ou sem plano.

- **Formato**: uma linha por referencia, usando `@` na raiz do workspace (ex.: `@backend/src/messages/`, `@frontend/src/components/`).
- **Escopo**: para features ou auditorias, preferir **pastas** que cubram o modulo; para bug pontual, `@arquivo` especifico + pasta pai se util.
- **Quando o alvo for incerto**: listar pastas candidatas e, na investigacao, mandar o executor confirmar paths reais no repo antes de editar.
- **Mapa tipico ONCONAV** (ajustar se o repo divergir): `@backend/` (NestJS, Prisma em `backend/prisma/`), `@frontend/` (Next.js), `@ai-service/` (FastAPI), `@docs/` ou `docs/`, regras e agentes em `@.claude/rules/`, `@.claude/agent-architecture.md` e `@.claude/squads.md` quando precisar de convencoes ou mapa de `/<agente>`.

## Referencia a agentes (`/<agente>`) — obrigatorio no plano

- **Sintaxe**: `/<agente>` com **id** igual ao nome do agente em `.claude/agent-architecture.md` / `.claude/squads.md` (ex.: `/seguranca-compliance`, `/ai-service`). Um **principal** por Task; se uma subtask for claramente de outro dominio, dividir em outra Task ou nota «delegar a /outro-agente».
- **Fonte de verdade**: `.claude/agent-architecture.md` (visao geral, agentes e rules). Nao inventar ids; se houver duvida entre dois agentes, preferir o mais especifico e documentar na investigacao.
- **Squads**: se o pedido corresponder a um squad (ver `.claude/squads.md` e `.claude/teams/`), o plano deve listar **uma Task por membro** exigido pelo squad, cada uma com seu `/<agente>`, na ordem descrita nesses ficheiros.
- **Fora do ONCONAV**: se o repo nao usar o mapa de agentes, substituir `/<agente>` por **papéis** claros por Task (ex.: «Task 1 — Backend — …») mantendo a mesma estrutura de subtasks e to-dos.

## Especifico do Claude Code

- **Paths**: Repetir ou reforcar os `@` mais criticos em **Contexto** ou **Tarefa** se ajudar o executor a nao perder o foco.
- **Regras do workspace**: Para tarefas sensiveis (auth, tenant, LGPD), incluir `@.claude/rules/` ou ficheiros citados em `.claude/agent-architecture.md` (ex.: `security.md`) na lista de paths dos prompts gerados.
- **Um objetivo por prompt**: Entregas muito grandes podem virar **prompts sequenciais** (cada um com plano atomizado e tasks coerentes com o recorte).
- **Comandos**: Se precisar de testes ou migrate, pedir execucao via terminal no ambiente do projeto em vez de supor caminhos absolutos do SO do usuario.

## Workflow de Geracao

1. **Clarificar a tarefa**: Entender exatamente o que o usuario quer executar no Claude Code.
2. **Definir anexos @**: pastas e/ou arquivos relevantes (mapa ONCONAV + o que o usuario citar); sem inventar paths — quando duvidoso, sugerir candidatos + confirmacao na investigacao.
3. **Mapear agentes**: para cada fatia de trabalho, escolher `/<agente>` valido; se for squad, incluir todos os membros obrigatorios na ordem correta.
4. **Delegar investigacao ao executor**: O prompt deve instruir o Claude Code a ler o repo e confirmar stack/padroes/convencoes antes de executar.
5. **Listar requisitos**: Obrigatorios primeiro, opcionais depois.
6. **Atomizar o plano**: tasks ordenadas, subtasks por task, to-dos em checkboxes por subtask; nenhuma task sem `/<agente>` (exceto modo «papeis» fora ONCONAV).
7. **Definir formato**: Estrutura esperada do output (codigo, arquivos, documentacao).
8. **Excluir anti-padroes**: O que evitar para nao gerar resultados indesejados.
9. **Montar o prompt**: Preencher o template e entregar pronto para copiar.

## Principios de Prompts Eficazes

- **Especifico > Generico**: "Adicionar validacao Zod ao formulario X em Y" em vez de "melhorar validacao".
- **Uma tarefa por prompt**: Focar em um objetivo claro; dividir tarefas complexas em varios prompts.
- **Contexto minimo necessario**: Incluir so o que o usuario forneceu; quando precisar de repo/padroes, delegar para o Claude Code investigar com ferramentas.
- **Verbos de acao**: Usar criar, implementar, adicionar, corrigir, refatorar, remover.
- **Formato explicito**: Especificar se deve editar arquivo existente, criar novo, ou ambos.
- **Plano atomizado**: cada to-do acionavel e verificavel; evitar subtasks vagas («melhorar codigo»).
- **Delegar investigacao ao executor**: Fase de checagem obrigatoria antes de codar (evitar execucao baseada em suposicoes).

## Tarefas Comuns e Suas Estruturas

| Tipo de Tarefa | Contexto Essencial | Plano / agentes tipicos |
|----------------|-------------------|-------------------------|
| Implementar feature | Modulo/pasta, stack | Tasks por camada: `/backend-nestjs`, `/frontend-nextjs`; Prisma: `/database-engineer` |
| Corrigir bug | Arquivo, sintoma, esperado | 1 Task `/agente` do modulo; subtasks repro, fix, teste |
| Refatorar codigo | Escopo, objetivo | `/backend-nestjs` ou agente do modulo; manter API/testes |
| Criar endpoint | Rota, payload, auth | DTOs, validacao, tenant em subtasks |
| Adicionar componente | Localizacao, props | `/frontend-nextjs`; acessibilidade em to-dos |
| Documentacao | Pasta docs/ | `/documentation`; alinhar codigo se clinico |
| Seguranca / gate | Auditoria | `/seguranca-compliance`, `/test-generator` em sequencia se pedido |

## Output para o Usuario

Entregar o prompt em bloco de codigo markdown, com titulo **Prompt para Claude Code** e instrucao de uso:

```markdown
## Prompt para Claude Code

Copie o bloco abaixo e cole no Claude Code para executar a tarefa:

---
[Cole aqui o prompt gerado seguindo o template]
---
```

Opcional: lembrar de **priorizar a leitura** dos paths `@...` listados e de **seguir o plano** task a task, usando `/<agente>` como guia de responsabilidade no ONCONAV.

## Exemplos

Para exemplos praticos por dominio (backend, frontend, refatoracao) no novo formato com tasks/subtasks/to-dos, ver [examples.md](examples.md).
