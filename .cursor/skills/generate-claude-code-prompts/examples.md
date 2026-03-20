# Exemplos de Prompts para Claude Code

## Exemplo 1: Refatoração de Código

**Tarefa solicitada:** Refatorar serviço de autenticação

**Prompt gerado:**

```
# Contexto

Sistema NestJS multi-tenant com autenticação JWT. O AuthService tem ~400 linhas e mistura lógica de login, refresh token e validação.

# Tarefa

Refatorar AuthService extraindo responsabilidades em serviços menores, mantendo contrato público (métodos expostos pelo AuthController) inalterado.

# Requisitos

- Não alterar DTOs ou rotas da API
- Manter testes existentes passando
- Seguir padrões do backend-padroes.mdc (modularidade, tenantId em queries)
- Usar Logger do NestJS, nunca console.log

# Formato Esperado

- 2-4 serviços extraídos (ex: TokenService, SessionService)
- AuthModule atualizado com providers
- AuthService como orquestrador chamando os novos serviços
- Breve resumo das mudanças em português

# Não Fazer

- Alterar assinatura dos métodos públicos do AuthController
- Quebrar isolamento multi-tenant
```

---

## Exemplo 2: Nova Feature

**Tarefa solicitada:** Adicionar filtro por data na lista de pacientes

**Prompt gerado:**

```
# Contexto

Frontend Next.js 14 com React Query. Página de listagem de pacientes em /dashboard/patients usa usePatients(tenantId). Backend tem endpoint GET /patients com query params.

# Tarefa

Adicionar filtro por intervalo de datas (dataCadastroInicio, dataCadastroFim) na listagem de pacientes.

# Requisitos

- Backend: estender QueryPatientsDto e PatientsService.findAll() com filtros de data
- Frontend: componente de date range picker (shadcn/ui), integrar ao usePatients
- Persistir filtros na URL (searchParams) para compartilhamento/bookmark
- Sempre incluir tenantId nas queries (multi-tenancy)
- Usar date-fns para manipulação de datas
- Paginação existente deve continuar funcionando

# Formato Esperado

- Código completo das alterações
- Migração Prisma se necessário (não neste caso - filtro em runtime)
- Checklist de teste manual

# Não Fazer

- Quebrar paginação existente
- Hardcodar datas nos filtros
```

---

## Exemplo 3: Correção de Bug

**Tarefa solicitada:** WhatsApp não envia mensagens após reconexão

**Prompt gerado:**

```
# Contexto

Integração WhatsApp Business API via backend NestJS. WhatsAppConnectionsService gerencia conexões e envia mensagens. Após desconexão e reconexão do canal, mensagens ficam em fila mas não são enviadas.

# Tarefa

Identificar e corrigir o bug que impede envio de mensagens após reconexão do canal WhatsApp.

# Requisitos

- Hipóteses a investigar: estado do canal (connected) não atualizado após reconnect; fila de mensagens não sendo reprocessada; webhook de status não tratado
- Manter compatibilidade com embedded signup e onboarding
- Logs detalhados para debug (Logger, sem console.log)
- Não alterar contrato do channel-gateway para incoming messages

# Formato Esperado

- Diagnóstico do problema (onde está o bug)
- Patch com correção
- Sugestão de teste manual ou script de verificação

# Não Fazer

- Alterar interface pública do channel-gateway
- Remover logs existentes sem substituir por Logger
```

---

## Exemplo 4: Documentação / Análise

**Tarefa solicitada:** Documentar fluxo de navegação oncológica colorretal

**Prompt gerado:**

```
# Contexto

Módulo oncology-navigation no backend. NavigationSteps (SCREENING, DIAGNOSIS, TREATMENT, FOLLOW_UP) com prazos e status. Documentação em docs/desenvolvimento/.

# Tarefa

Gerar documentação em Markdown do fluxo completo de navegação para câncer colorretal: etapas por fase, prazos recomendados, integração com alerts e dashboard.

# Requisitos

- Mapear todas as etapas no código (oncology-navigation.service.ts)
- Documentar critérios de transição entre fases
- Incluir diagrama Mermaid do fluxo (opcional)
- Referenciar navegacao-oncologica.mdc para termos

# Formato Esperado

- Arquivo docs/desenvolvimento/navegacao-colorretal-fluxo.md
- Estrutura: Visão geral | Etapas por fase | Prazos | Integrações | Exemplos
- Linguagem clara para devs e product

# Não Fazer

- Inventar etapas ou prazos não presentes no código
- Usar jargão médico sem explicar
```

---

## Exemplo 5: Migração / Atualização

**Tarefa solicitada:** Atualizar Prisma de 4 para 5

**Prompt gerado:**

```
# Contexto

Backend NestJS com Prisma 4.x. Schema em backend/prisma/schema.prisma. ~30 models, multi-tenant com tenantId na maioria das tabelas.

# Tarefa

Atualizar Prisma de 4 para 5 seguindo guia oficial, sem quebrar funcionalidade.

# Requisitos

- Checklist: atualizar package.json; rodar prisma generate; revisar breaking changes; ajustar código deprecated; rodar migrations em dev
- Zero downtime em produção (migrations backward compatible)
- Manter seed funcionando
- Testes e2e devem passar

# Formato Esperado

- Diff das alterações em package.json e código
- Lista de breaking changes aplicados
- Comandos para executar a migração

# Não Fazer

- Alterar schema de forma incompatível com dados existentes
- Pular etapas do guia oficial de migração
```
