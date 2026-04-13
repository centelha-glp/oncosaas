# Exemplos de Prompts para Claude Code

Os exemplos abaixo seguem o template da skill: **Contexto**, **@ paths**, **Investigacao**, **Tarefa**, **Requisitos**, **Plano de implementacao (atomizado)** com Tasks, Subtasks e to-dos, **Formato esperado**, **Nao fazer**.

---

## Exemplo 1: Refatoração de Código

**Tarefa solicitada:** Refatorar serviço de autenticação

**Prompt gerado:**

````markdown
# Contexto

Sistema NestJS multi-tenant com autenticação JWT. O AuthService tem ~400 linhas e mistura lógica de login, refresh token e validação.

# Pastas e arquivos para anexar (@) — recomendado

@backend/src/auth/
@.claude/rules/backend.md

# Investigacao Antes de Executar (obrigatorio)

Antes de escrever qualquer codigo, o Claude Code deve:

1. Levantar o que precisa para executar com precisao (ler arquivos relevantes no repo, identificar padroes/convencoes e pontos de integracao).
2. Confirmar onde a mudanca deve ser aplicada (arquivos/modulos/rotas/servicos) e quais responsabilidades cada camada tem.
3. Listar suposicoes apenas se algo estiver faltando (e, se possivel, checar via ferramentas; caso nao seja possivel, perguntar).
4. Somente depois disso, propor e executar o plano de implementacao (seguindo as Tasks na ordem, marcando to-dos concluidos).

# Tarefa

Refatorar AuthService extraindo responsabilidades em serviços menores, mantendo contrato público (métodos expostos pelo AuthController) inalterado.

# Requisitos

- Não alterar DTOs ou rotas da API
- Manter testes existentes passando
- Seguir padrões de `.claude/rules/backend.md` (modularidade, tenantId em queries)
- Usar Logger do NestJS, nunca console.log

# Plano de implementacao (atomizado)

## Task 1 /backend-nestjs — Extrair servicos e orquestrar AuthService

**Objetivo:** Dividir responsabilidades sem alterar o contrato publico exposto pelo AuthController.

### Subtask 1.1 — Leitura e fronteiras
- [ ] Mapear metodos do AuthService e dependencias (providers, imports)
- [ ] Definir quais responsabilidades viram TokenService, SessionService ou equivalente

### Subtask 1.2 — Implementacao e modulo
- [ ] Criar servicos extraidos e mover logica com imports corretos
- [ ] Atualizar AuthModule (providers) e AuthService como orquestrador
- [ ] Garantir que AuthController continue chamando apenas as mesmas operacoes publicas

### Subtask 1.3 — Validacao
- [ ] Rodar testes existentes do modulo auth
- [ ] Verificar isolamento multi-tenant em queries que permanecem no auth

# Formato esperado

- 2-4 serviços extraídos (ex: TokenService, SessionService)
- AuthModule atualizado com providers
- AuthService como orquestrador chamando os novos serviços
- Breve resumo das mudanças em português

# Nao fazer

- Alterar assinatura dos métodos públicos do AuthController
- Quebrar isolamento multi-tenant
````

---

## Exemplo 2: Nova Feature (backend + frontend)

**Tarefa solicitada:** Adicionar filtro por data na lista de pacientes

**Prompt gerado:**

````markdown
# Contexto

Frontend Next.js 14 com React Query. Página de listagem de pacientes em /dashboard/patients usa usePatients(tenantId). Backend tem endpoint GET /patients com query params.

# Pastas e arquivos para anexar (@) — recomendado

@backend/src/patients/
@frontend/src/app/dashboard/patients/
@frontend/src/hooks/

# Investigacao Antes de Executar (obrigatorio)

Antes de escrever qualquer codigo, o Claude Code deve:

1. Levantar o que precisa para executar com precisao (ler arquivos relevantes no repo, identificar padroes/convencoes e pontos de integracao).
2. Confirmar onde a mudanca deve ser aplicada (arquivos/modulos/rotas/servicos) e quais responsabilidades cada camada tem.
3. Listar suposicoes apenas se algo estiver faltando (e, se possivel, checar via ferramentas; caso nao seja possivel, perguntar).
4. Somente depois disso, propor e executar o plano de implementacao (seguindo as Tasks na ordem, marcando to-dos concluidos).

# Tarefa

Adicionar filtro por intervalo de datas (dataCadastroInicio, dataCadastroFim) na listagem de pacientes.

# Requisitos

- Backend: estender QueryPatientsDto e PatientsService.findAll() com filtros de data
- Frontend: componente de date range picker (shadcn/ui), integrar ao usePatients
- Persistir filtros na URL (searchParams) para compartilhamento/bookmark
- Sempre incluir tenantId nas queries (multi-tenancy)
- Usar date-fns para manipulação de datas
- Paginação existente deve continuar funcionando

# Plano de implementacao (atomizado)

## Task 1 /backend-nestjs — API e servico com filtro de datas

**Objetivo:** Expor e aplicar filtros de intervalo de dataCadastro com escopo por tenant.

### Subtask 1.1 — DTO e validacao
- [ ] Estender QueryPatientsDto com dataCadastroInicio e dataCadastroFim opcionais
- [ ] Validar intervalo (inicio <= fim) e tipos (ISO ou Date coerente com o projeto)

### Subtask 1.2 — Service e Prisma
- [ ] Aplicar filtro no `where` escopado por tenantId
- [ ] Manter paginacao existente e ordenacao atual

## Task 2 /frontend-nextjs — UI e sincronizacao com URL

**Objetivo:** Date range na listagem alinhado aos query params e ao hook de dados.

### Subtask 2.1 — Estado e URL
- [ ] Sincronizar range com searchParams
- [ ] Integrar ao usePatients (ou hook equivalente) sem quebrar tenantId

### Subtask 2.2 — Componente
- [ ] Adicionar date range picker (shadcn/ui) com date-fns
- [ ] Estados de loading/erro alinhados ao restante da pagina

# Formato esperado

- Código completo das alterações
- Migração Prisma se necessário (não neste caso - filtro em runtime)
- Checklist de teste manual

# Nao fazer

- Quebrar paginação existente
- Hardcodar datas nos filtros
````

---

## Exemplo 3: Correção de Bug

**Tarefa solicitada:** WhatsApp não envia mensagens após reconexão

**Prompt gerado:**

````markdown
# Contexto

Integração WhatsApp Business API via backend NestJS. WhatsAppConnectionsService gerencia conexões e envia mensagens. Após desconexão e reconexão do canal, mensagens ficam em fila mas não são enviadas.

# Pastas e arquivos para anexar (@) — recomendado

@backend/src/whatsapp-connections/
@backend/src/channel-gateway/
@backend/src/messages/

# Investigacao Antes de Executar (obrigatorio)

Antes de escrever qualquer codigo, o Claude Code deve:

1. Levantar o que precisa para executar com precisao (ler arquivos relevantes no repo, identificar padroes/convencoes e pontos de integracao).
2. Confirmar onde a mudanca deve ser aplicada (arquivos/modulos/rotas/servicos) e quais responsabilidades cada camada tem.
3. Listar suposicoes apenas se algo estiver faltando (e, se possivel, checar via ferramentas; caso nao seja possivel, perguntar).
4. Somente depois disso, propor e executar o plano de implementacao (seguindo as Tasks na ordem, marcando to-dos concluidos).

# Tarefa

Identificar e corrigir o bug que impede envio de mensagens após reconexão do canal WhatsApp.

# Requisitos

- Hipóteses a investigar: estado do canal (connected) não atualizado após reconnect; fila de mensagens não sendo reprocessada; webhook de status não tratado
- Manter compatibilidade com embedded signup e onboarding
- Logs detalhados para debug (Logger, sem console.log)
- Não alterar contrato do channel-gateway para incoming messages

# Plano de implementacao (atomizado)

## Task 1 /whatsapp-integration — Diagnostico e correcao do fluxo pos-reconexao

**Objetivo:** Restaurar envio apos reconexao sem alterar o contrato publico do channel-gateway para mensagens recebidas.

### Subtask 1.1 — Repro e rastreamento
- [ ] Reproduzir o fluxo desconectar/reconectar e capturar estado do canal e da fila
- [ ] Localizar onde o estado `connected` (ou equivalente) deveria ser atualizado

### Subtask 1.2 — Patch
- [ ] Corrigir atualizacao de estado e/ou reprocessamento da fila apos reconnect
- [ ] Tratar webhook de status se for a causa raiz

### Subtask 1.3 — Verificacao
- [ ] Teste manual ou script de verificacao documentado
- [ ] Logs com Logger para facilitar suporte sem vazar dados sensiveis

# Formato esperado

- Diagnóstico do problema (onde está o bug)
- Patch com correção
- Sugestão de teste manual ou script de verificação

# Nao fazer

- Alterar interface pública do channel-gateway
- Remover logs existentes sem substituir por Logger
````

---

## Exemplo 4: Documentação / Análise

**Tarefa solicitada:** Documentar fluxo de navegação oncológica colorretal

**Prompt gerado:**

````markdown
# Contexto

Módulo oncology-navigation no backend. NavigationSteps (SCREENING, DIAGNOSIS, TREATMENT, FOLLOW_UP) com prazos e status. Documentação em docs/desenvolvimento/.

# Pastas e arquivos para anexar (@) — recomendado

@backend/src/oncology-navigation/
@docs/desenvolvimento/

# Investigacao Antes de Executar (obrigatorio)

Antes de escrever qualquer codigo, o Claude Code deve:

1. Levantar o que precisa para executar com precisao (ler arquivos relevantes no repo, identificar padroes/convencoes e pontos de integracao).
2. Confirmar onde a mudanca deve ser aplicada (arquivos/modulos/rotas/servicos) e quais responsabilidades cada camada tem.
3. Listar suposicoes apenas se algo estiver faltando (e, se possivel, checar via ferramentas; caso nao seja possivel, perguntar).
4. Somente depois disso, propor e executar o plano de implementacao (seguindo as Tasks na ordem, marcando to-dos concluidos).

# Tarefa

Gerar documentação em Markdown do fluxo completo de navegação para câncer colorretal: etapas por fase, prazos recomendados, integração com alerts e dashboard.

# Requisitos

- Mapear todas as etapas no código (oncology-navigation.service.ts)
- Documentar critérios de transição entre fases
- Incluir diagrama Mermaid do fluxo (opcional)
- Referenciar `.claude/rules/clinical-domain.md` e o código do módulo para termos

# Plano de implementacao (atomizado)

## Task 1 /documentation — Doc do fluxo colorretal

**Objetivo:** Entregar um Markdown alinhado ao codigo e util para devs e produto.

### Subtask 1.1 — Mapeamento no codigo
- [ ] Listar etapas e transicoes a partir de oncology-navigation (e arquivos relacionados)
- [ ] Extrair prazos e gatilhos documentados no codigo ou constantes

### Subtask 1.2 — Redacao e artefato
- [ ] Escrever docs/desenvolvimento/navegacao-colorretal-fluxo.md com a estrutura acordada
- [ ] Opcional: diagrama Mermaid coerente com o codigo

## Task 2 /clinical-domain — Conferencia de termos (se necessario)

**Objetivo:** Garantir que termos clinicos e fases batem com as regras do projeto.

### Subtask 2.1 — Revisao cruzada
- [ ] Conferir termos com `.claude/rules/clinical-domain.md` e protocolos referenciados no repo
- [ ] Ajustar redacao sem inventar etapas inexistentes no codigo

# Formato esperado

- Arquivo docs/desenvolvimento/navegacao-colorretal-fluxo.md
- Estrutura: Visão geral | Etapas por fase | Prazos | Integrações | Exemplos
- Linguagem clara para devs e product

# Nao fazer

- Inventar etapas ou prazos não presentes no código
- Usar jargão médico sem explicar
````

---

## Exemplo 5: Migração / Atualização

**Tarefa solicitada:** Atualizar Prisma de 4 para 5

**Prompt gerado:**

````markdown
# Contexto

Backend NestJS com Prisma 4.x. Schema em backend/prisma/schema.prisma. ~30 models, multi-tenant com tenantId na maioria das tabelas.

# Pastas e arquivos para anexar (@) — recomendado

@backend/prisma/
@backend/package.json
@.claude/rules/

# Investigacao Antes de Executar (obrigatorio)

Antes de escrever qualquer codigo, o Claude Code deve:

1. Levantar o que precisa para executar com precisao (ler arquivos relevantes no repo, identificar padroes/convencoes e pontos de integracao).
2. Confirmar onde a mudanca deve ser aplicada (arquivos/modulos/rotas/servicos) e quais responsabilidades cada camada tem.
3. Listar suposicoes apenas se algo estiver faltando (e, se possivel, checar via ferramentas; caso nao seja possivel, perguntar).
4. Somente depois disso, propor e executar o plano de implementacao (seguindo as Tasks na ordem, marcando to-dos concluidos).

# Tarefa

Atualizar Prisma de 4 para 5 seguindo guia oficial, sem quebrar funcionalidade.

# Requisitos

- Checklist: atualizar package.json; rodar prisma generate; revisar breaking changes; ajustar código deprecated; rodar migrations em dev
- Zero downtime em produção (migrations backward compatible)
- Manter seed funcionando
- Testes e2e devem passar

# Plano de implementacao (atomizado)

## Task 1 /database-engineer — Upgrade Prisma e schema

**Objetivo:** Subir versao do Prisma e do client com migracoes seguras.

### Subtask 1.1 — Dependencias e generate
- [ ] Atualizar package.json (prisma e @prisma/client) para versao 5 alinhada
- [ ] Rodar prisma generate e corrigir erros de schema se o CLI apontar

### Subtask 1.2 — Breaking changes
- [ ] Aplicar ajustes de API deprecated no codigo que usa Prisma Client
- [ ] Garantir migrations backward compatible para producao

## Task 2 /backend-nestjs — Ajustes de codigo e validacao

**Objetivo:** Garantir que o app Nest compila e testes passam com o novo client.

### Subtask 2.1 — Integracao
- [ ] Corrigir tipos/imports afetados pelo upgrade
- [ ] Rodar suite de testes relevantes e e2e conforme o projeto

### Subtask 2.2 — Seed e dados
- [ ] Validar seed em ambiente de dev apos migrate

# Formato esperado

- Diff das alterações em package.json e código
- Lista de breaking changes aplicados
- Comandos para executar a migração

# Nao fazer

- Alterar schema de forma incompatível com dados existentes
- Pular etapas do guia oficial de migração
````
