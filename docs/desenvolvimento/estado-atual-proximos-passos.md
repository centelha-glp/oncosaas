# Estado Atual e Próximos Passos

> **Última atualização:** 2026-04-13  
> **Nota:** Este ficheiro descreve sobretudo o estado **até início de 2025** (checklist de dashboard/chat). Para entregas **recentes** (navegação oncológica, paridade clínica, PRs de 2026), ver [`resumo-entregas-chats-abr-2026.md`](./resumo-entregas-chats-abr-2026.md) e o [`README.md`](../../README.md).

**Última revisão estrutural (metadados):** 2026-04-13 — alinhamento com documentação e rotas atuais do repositório.

---

## Atualização abril/2026 (resumo)

- **Navegação oncológica** e fluxos associados no frontend (`/oncology-navigation`, etc.) e backend.  
- **Páginas de paciente** existem (ex.: `/patients/[id]`, edição) — o item “criar página de detalhes” abaixo está **desatualizado** em relação ao código atual.  
- **Priorização / scores:** integração contínua entre backend e AI Service; detalhes em `docs/ia-modelo-priorizacao/` e serviços de domínio (não depende de um único “PriorityScoresModule” isolado como na lista legada).  

---

## ✅ Concluído

### Backend

1. ✅ **Schema Prisma** - Todos os modelos criados (Tenant, User, Patient, Message, Alert, Observation, etc.)
2. ✅ **Docker Compose** - PostgreSQL, Redis, RabbitMQ configurados
3. ✅ **Módulo de Autenticação** - JWT, Guards, Decorators
4. ✅ **Módulo de Pacientes** - CRUD completo
5. ✅ **Módulo de Mensagens** - WhatsApp messages com endpoints de assumir e enviar
6. ✅ **Módulo de Alertas** - Sistema de alertas com WebSocket
7. ✅ **Módulo de Observações** - FHIR-compliant observations
8. ✅ **WebSocket Gateways** - AlertsGateway, MessagesGateway com rooms por paciente
9. ✅ **Seed Data** - Dados iniciais para desenvolvimento
10. ✅ **Testes de API** - Scripts de teste automatizados (Node.js, PowerShell, Bash)
11. ✅ **Correções** - CreateAlertDto aceita objetos JSON no campo `context`
12. ✅ **Permissões** - Enfermeiros e oncologistas podem criar mensagens quando assumem conversa

### Frontend

1. ✅ **Cliente de API** - Axios com interceptors (JWT, tenantId)
2. ✅ **Stores Zustand** - AuthStore para gerenciamento de autenticação
3. ✅ **Hooks React Query** - usePatients, useAlerts, useMessages, useSocket
4. ✅ **Página de Login** - Autenticação funcional com redirecionamento
5. ✅ **Chat** - Conectado ao backend:
   - Lista de pacientes
   - Painel de alertas
   - Visualização de conversas
   - Contador de mensagens não assumidas
6. ✅ **Componentes Conectados** - PatientListConnected, AlertsPanel
7. ✅ **Middleware de Autenticação** - Proteção de rotas
8. ✅ **Providers** - React Query configurado
9. ✅ **Funcionalidades de Conversa**:
   - Assumir conversa (handoff manual)
   - Enviar mensagem manual
   - Atualizações em tempo real via WebSocket
   - Optimistic updates para melhor UX
10. ✅ **Correções de Layout** - Botões dentro dos cards (pacientes e alertas)
11. ✅ **Ordenação Automática** - Pacientes ordenados por prioridade (CRITICAL > HIGH > MEDIUM > LOW)
12. ✅ **Busca Funcional** - Busca por nome ou CPF com debounce de 300ms
13. ✅ **Clique no Alerta Abre Conversa** - Ao clicar no alerta, abre automaticamente a conversa do paciente
14. ✅ **Filtros Básicos** - Filtros por prioridade, alertas pendentes e tipo de câncer
15. ✅ **Badge de Alertas Críticos** - Badge vermelho pulsante no header com contador de alertas críticos, ao clicar filtra e mostra apenas alertas críticos
16. ✅ **Melhorias de UX** - Badge de alerta no card do paciente, highlight do paciente selecionado, contador de resultados quando filtros aplicados, scroll automático até paciente selecionado

---

## 🚀 Próximos Passos Prioritários

### 1. Melhorias de UX Adicionais (🟡 MÉDIA PRIORIDADE)

- [x] **Highlight do paciente** - Destacar paciente na lista quando selecionado ✅ IMPLEMENTADO
- [x] **Scroll automático** - Rolar até o paciente na lista quando selecionado ✅ IMPLEMENTADO
- [x] **Badge de alerta** - Mostrar badge no card do paciente quando tem alerta pendente ✅ IMPLEMENTADO
- [x] **Contador de resultados** - Mostrar "X pacientes encontrados" quando filtros aplicados ✅ IMPLEMENTADO
- [ ] **Salvar filtros no localStorage** - Persistir filtros entre sessões

### 2. Melhorias Críticas de UX (🔴 ALTA PRIORIDADE - Segurança do Paciente)

**Baseado em:** [Análise com Especialista Healthtech](./../analise-dashboard/analise-especialista.md)

- [x] **Ordenação automática por prioridade** (Crítico → Baixo) - ✅ Implementado no backend e frontend
- [x] **Filtros básicos** (categoria, alertas pendentes, tipo de câncer) - ✅ Implementado
- [x] **Busca funcional** (nome, CPF parcial) com debounce de 300ms - ✅ Implementado
- [x] **Alertas críticos no header** (badge vermelho piscante com contador) ✅ IMPLEMENTADO
- [x] **Melhorar loading states e empty states** ✅ IMPLEMENTADO
- [x] **Scroll automático para última mensagem** ✅ IMPLEMENTADO
- [x] **Feedback visual de conversas assumidas** (badge "Assumido por") ✅ IMPLEMENTADO

**Impacto:** Casos críticos podem passar despercebidos sem essas melhorias.

### 2. Informações Clínicas no Card (🟡 MÉDIA PRIORIDADE)

- [ ] Adicionar "Última consulta: há X dias"
- [ ] Adicionar "Próxima consulta: em X dias" (se houver)
- [ ] Badge "Em tratamento ativo"
- [ ] Tooltip explicativo do score de prioridade (por quê foi priorizado)

### 3. Gestão de Conversas (✅ PARCIALMENTE IMPLEMENTADO)

- ✅ Assumir conversa (handoff manual)
- ✅ Enviar mensagem manual
- ✅ Atualizações em tempo real via WebSocket
- ✅ Feedback visual de conversas assumidas (badge "Assumido por: [Nome]")
- [ ] Filtro "Minhas Conversas"
- [ ] Lista de "Conversas Ativas" no header

### 4. WebSocket e Tempo Real (✅ PARCIALMENTE IMPLEMENTADO)

- ✅ WebSocket para mensagens em tempo real (useMessagesSocket)
- ✅ Atualização automática de mensagens quando novas chegam
- ✅ Atualização quando mensagem é assumida
- [ ] Notificações push para alertas críticos novos
- [ ] Atualização automática da lista de pacientes quando score muda

### 5. Páginas e Funcionalidades Avançadas (🟢 BAIXA PRIORIDADE)

- [x] **Página de detalhes do paciente** — existe rota `/patients/[id]` (verificar escopo UX vs este doc legado)
- [ ] Timeline completa de interações
- [ ] Métricas e KPIs no dashboard

### 2. Integração WhatsApp (Média Prioridade)

- [ ] Configurar webhook do WhatsApp Business API
- [ ] Criar serviço de processamento de mensagens recebidas
- [ ] Integrar com AI Service para processamento de mensagens
- [ ] Implementar detecção de sintomas críticos
- [ ] Criar sistema de alertas automáticos

### 3. Módulo de Priorização (Média Prioridade)

> **2026:** Parte disto já existe de forma distribuída (`ai-service`, serviços de navegação/prioridade no Nest). Tratar como lista de evolução, não como backlog literal.

- [ ] Consolidar documentação e contrato único de score (produto + API)
- [ ] Garantir paridade entre features do dashboard e modelo em todos os ambientes
- [ ] Endpoints e recálculo alinhados ao AI Service (ver `PriorityRecalculationService` / domínio de navegação)
- [ ] Histórico de scores onde for requisito de produto

### 4. Melhorias no Backend (Baixa Prioridade)

- [ ] Implementar paginação em listagens
- [ ] Adicionar filtros avançados nos endpoints
- [ ] Implementar rate limiting
- [ ] Adicionar logging estruturado
- [ ] Criar testes unitários e E2E

### 5. Integração EHR (Baixa Prioridade)

- [ ] Implementar sincronização FHIR
- [ ] Criar serviço de sincronização bidirecional
- [ ] Implementar webhook para receber atualizações do EHR
- [ ] Criar interface de configuração de integração

---

## 📊 Estatísticas do Projeto

### Backend

- **Módulos Criados**: 6 (Auth, Patients, Messages, Alerts, Observations, Gateways)
- **Endpoints Testados**: 10/10 ✅
- **Taxa de Sucesso**: 100%
- **Porta**: 3002

### Frontend

- **Páginas:** além de Home/Login/Dashboard, existem rotas como pacientes (`/patients`, `/patients/[id]`), navegação oncológica, chat, etc. — o número “3 páginas” acima é **legado 2025**.
- **Componentes / hooks:** evoluíram desde esta contagem; ver código em `frontend/src/`.
- **Porta**: 3000

### Banco de Dados

- **Modelos**: 11
- **Enums**: 14
- **Seed Data**: Tenant, 4 usuários, 3 pacientes, mensagens, alertas

---

## 🔧 Correções Aplicadas Recentemente

1. **CreateAlertDto**: Campo `context` agora aceita objetos JSON (`@IsObject()`)
2. **TypeScript**: Path alias `@/*` configurado no `tsconfig.json`
3. **Auth Store**: Inicialização do estado do localStorage implementada
4. **Dashboard**: Conectado ao backend com dados reais

---

## 📝 Notas Importantes

- **Credenciais de Teste**: `admin@hospitalteste.com` / `senha123`
- **Backend URL**: `http://localhost:3002`
- **Frontend URL**: `http://localhost:3000`
- **WebSocket URL**: `ws://localhost:3002`

---

## 🎯 Objetivo Atual

**Fase:** plataforma em evolução contínua (além do MVP descrito acima).

- Backend e AI Service integrados ao produto em desenvolvimento ativo ✅  
- Frontend com múltiplos fluxos clínicos e operacionais ✅  
- Próximo foco: ver roadmap em `docs/planejamento/` e entregas em [`resumo-entregas-chats-abr-2026.md`](./resumo-entregas-chats-abr-2026.md)
