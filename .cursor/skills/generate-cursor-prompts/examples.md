# Exemplos de prompts para o Cursor

Os exemplos abaixo seguem o template completo (inclui **Pastas e arquivos para anexar (@)**, **Investigacao Antes de Executar** e **Plano de implementacao (atomizado)** com `/<agente>` por Task). Em prompts curtos do dia a dia, o bloco de investigacao continua obrigatorio; o bloco de `@` pode ser reduzido a uma pasta se o escopo for estreito.

## Exemplo 1: Refatorar serviço

**Pedido:** Quebrar AuthService em serviços menores.

**Prompt gerado:**

```markdown
# Contexto

Backend NestJS multi-tenant com JWT. O AuthService concentra login, refresh e validação em um único arquivo (~400 linhas).

# Pastas e arquivos para anexar (@) — recomendado

- `@backend/src/auth/`
- `@backend/src/auth/auth.service.ts` (ou o arquivo real do AuthService após confirmar no repo)

# Investigacao Antes de Executar (obrigatorio)

Antes de escrever ou alterar codigo, o agente do Cursor deve:

1. Ler AuthService, AuthController, AuthModule e testes relacionados; identificar fronteiras naturais entre responsabilidades.
2. Confirmar metodos expostos pelo controller e contratos usados por outros modulos; nada pode mudar na API publica HTTP.
3. Se alguma dependencia ou nome de provider estiver ambigua, verificar no repo ou perguntar.
4. So entao extrair serviços e ajustar o modulo.

# Tarefa

Refatorar AuthService em serviços menores (ex.: tokens, sessão), mantendo o AuthController e as rotas inalterados.

# Requisitos

- Nao alterar DTOs nem paths das rotas
- Manter testes existentes passando; ajustar apenas se necessario para novos providers
- Usar Logger do NestJS, nunca console.log
- Queries e dados de dominio continuam filtrados por tenantId onde aplicavel

# Plano de implementacao (atomizado)

## Task 1 /backend-nestjs — Extrair responsabilidades do AuthService

**Objetivo:** Dividir AuthService em servicos coesos sem alterar contratos HTTP nem DTOs.

### Subtask 1.1 — Inventario e fronteiras
- [ ] Ler AuthService, AuthController, AuthModule e testes; listar metodos e dependencias
- [ ] Definir fronteiras (ex.: tokens, refresh, validacao) e nomes de classes alvo

### Subtask 1.2 — Extracao e modulo
- [ ] Criar novos servicos e mover implementacao; manter AuthService como facade fina ou remover conforme padrao do projeto
- [ ] Atualizar AuthModule (providers/exports); garantir injecao nos consumidores existentes

### Subtask 1.3 — Validacao
- [ ] Rodar testes existentes; ajustar apenas o necessario para novos providers
- [ ] Resumo em portugues das classes e responsabilidades

# Formato esperado

- Lista dos novos arquivos/classes e responsabilidade de cada um
- AuthModule atualizado
- Resumo breve em portugues

# Nao fazer

- Alterar assinaturas publicas usadas pelo controller
- Refatorar modulos nao relacionados a auth
```

---

## Exemplo 2: Feature com frontend e backend

**Pedido:** Filtro por intervalo de datas na listagem de pacientes.

**Prompt gerado:**

```markdown
# Contexto

Listagem de pacientes no app Next.js com React Query; API GET de pacientes no NestJS. Confirmar paths reais no repo (paginas, DTOs, service).

# Pastas e arquivos para anexar (@) — recomendado

- `@backend/src/` (modulo de pacientes / patients — confirmar nome da pasta)
- `@frontend/src/` (pagina ou rota de listagem de pacientes — confirmar)

# Investigacao Antes de Executar (obrigatorio)

Antes de escrever ou alterar codigo, o agente do Cursor deve:

1. Localizar endpoint de listagem, DTO de query e hook/componente da lista no frontend.
2. Confirmar campos de data disponiveis no modelo Prisma e na resposta da API.
3. Alinhar nomes de query params entre frontend e backend antes de implementar.
4. So entao implementar filtro + URL search params + backend.

# Tarefa

Adicionar filtro por intervalo de datas (inicio/fim) na listagem de pacientes, end to end.

# Requisitos

- Backend: estender DTO e service com filtros; sempre escopar por tenantId confiável
- Frontend: date range (ex. shadcn/ui), integrar ao hook de dados; sincronizar com searchParams
- Paginacao existente deve continuar funcionando
- Usar date-fns ou padrao ja usado no projeto

# Plano de implementacao (atomizado)

## Task 1 /backend-nestjs — Filtro de datas na API

**Objetivo:** Listagem de pacientes aceitar intervalo opcional; dados sempre escopados por tenantId confiavel.

### Subtask 1.1 — Contrato e validacao
- [ ] Localizar endpoint, DTO de query e service; estender com `inicio`/`fim` (nomes alinhados ao projeto)
- [ ] Validar intervalo e tipos; rejeitar intervalo invalido com erro 400 claro

### Subtask 1.2 — Prisma e testes
- [ ] Aplicar filtro no `where` com tenantId; nao quebrar paginacao/ordenacao
- [ ] Ajustar ou adicionar testes de service/controller se o projeto tiver cobertura

## Task 2 /frontend-nextjs — Date range na listagem

**Objetivo:** UI de intervalo sincronizada com URL e hook de dados.

### Subtask 2.1 — Estado e URL
- [ ] Encontrar pagina/hook da listagem; adicionar controles de data (padrao UI do projeto)
- [ ] Sincronizar com `searchParams` e invalidar/refetch conforme React Query do projeto

### Subtask 2.2 — Validacao manual
- [ ] Verificar combinacao com paginacao e limpar filtros

# Formato esperado

- Alteracoes por arquivo
- Passos de teste manual rapidos

# Nao fazer

- Hardcodar tenant ou ignorar guards existentes
- Quebrar paginacao ou ordenacao atual sem necessidade
```

---

## Exemplo 3: Bug

**Pedido:** Mensagens WhatsApp não enviam após reconexão.

**Prompt gerado:**

```markdown
# Contexto

Fluxo WhatsApp no backend (conexoes, fila, envio). Sintoma: apos reconectar o canal, mensagens nao saem.

# Pastas e arquivos para anexar (@) — recomendado

- `@backend/src/whatsapp-connections/`
- `@backend/src/channel-gateway/`
- `@backend/src/messages/` (se existir; confirmar no repo)

# Investigacao Antes de Executar (obrigatorio)

Antes de escrever ou alterar codigo, o agente do Cursor deve:

1. Mapear o caminho: reconexao -> estado do canal -> worker/fila -> envio.
2. Reproduzir ou inferir pelo codigo onde o estado fica inconsistente; checar logs e handlers de webhook.
3. Nao alterar contratos publicos sem necessidade; propor patch minimo.
4. So entao corrigir e validar.

# Tarefa

Encontrar e corrigir a causa do envio parar apos reconexao do canal WhatsApp.

# Requisitos

- Logger estruturado (sem console.log)
- Nao quebrar fluxo de mensagens recebidas (incoming)
- Manter multi-tenant e isolamento por conexao

# Plano de implementacao (atomizado)

## Task 1 /whatsapp-integration — Corrigir envio apos reconexao

**Objetivo:** Restaurar envio de mensagens outgoing apos reconexao do canal, com patch minimo.

### Subtask 1.1 — Diagnostico
- [ ] Mapear reconexao -> estado do canal -> fila/worker -> envio; identificar inconsistencia
- [ ] Registrar hipotese em 2-5 linhas (causa provavel + arquivo)

### Subtask 1.2 — Correcao e validacao
- [ ] Implementar correcao focada; manter incoming intacto
- [ ] Validar manualmente: reconectar e enviar mensagem de teste; checar multi-tenant

# Formato esperado

- Diagnostico em 2-5 linhas
- Patch focado
- Como validar manualmente

# Nao fazer

- Rewrite grande do modulo sem evidencia
- Remover logs uteis sem substituicao
```

---

## Exemplo 4: Documentação

**Pedido:** Documentar fluxo de navegação oncológica colorretal.

**Prompt gerado:**

```markdown
# Contexto

Modulo oncology-navigation e documentacao em docs/. O usuario quer um doc de fluxo colorretal alinhado ao codigo.

# Pastas e arquivos para anexar (@) — recomendado

- `@docs/` (ou subpasta alvo acordada)
- `@backend/src/` ou pacote `oncology-navigation` / `clinical-protocols` — confirmar path real no repo

# Investigacao Antes de Executar (obrigatorio)

Antes de escrever ou alterar codigo, o agente do Cursor deve:

1. Ler servicos/enum relacionados a etapas e transicoes no repo.
2. Listar apenas o que estiver implementado; nao inventar etapas ou prazos.
3. So entao redigir o markdown no caminho acordado.

# Tarefa

Criar documentacao em Markdown do fluxo de navegação para câncer colorretal conforme implementacao atual.

# Requisitos

- Estrutura clara (visao geral, etapas, transicoes, integracoes)
- Opcional: diagrama Mermaid se ajudar e for fiel ao codigo
- Portugues acessivel para devs e produto

# Plano de implementacao (atomizado)

## Task 1 /documentation — Doc de fluxo colorretal

**Objetivo:** Um Markdown fiel ao codigo, em `docs/` (caminho a confirmar).

### Subtask 1.1 — Leitura do codigo
- [ ] Localizar modulos/enum de etapas e transicoes colorretais no repo
- [ ] Listar apenas comportamento implementado (sem inventar etapas)

### Subtask 1.2 — Redacao
- [ ] Escrever estrutura (visao geral, etapas, transicoes); Mermaid opcional se fiel
- [ ] Incluir referencias a arquivos de codigo ao citar comportamento

# Formato esperado

- Um arquivo novo ou atualizacao em docs/ (caminho a confirmar no repo)
- Referencias a arquivos de codigo quando citar comportamento

# Nao fazer

- Afirmacoes clinicas ou prazos nao presentes no codigo
- Docs extras nao pedidas
```
