# Badge de Alertas Críticos no Header - Implementação

## Resumo

Implementação de um badge visual no header da página de chat que exibe o número de alertas críticos pendentes, com animação pulsante e funcionalidade de clique para filtrar e visualizar apenas alertas críticos.

## Data de Implementação

2026-04-13

## Funcionalidades Implementadas

### 1. Badge de Alertas Críticos no Header

- **Localização**: Header da página `/chat`
- **Visualização**: Badge vermelho com ícone de sino (`Bell`) e contador de alertas críticos
- **Animação**: Pulsante (`animate-pulse`) e ícone com bounce (`animate-bounce`)
- **Comportamento**: Ao clicar, muda para a aba "Alertas" e aplica filtro para mostrar apenas alertas críticos

### 2. Hook `useCriticalAlertsCount`

- **Arquivo**: `frontend/src/hooks/useAlerts.ts`
- **Funcionalidade**: Busca o número de alertas com `severity: 'CRITICAL'` e `status: { not: 'RESOLVED' }`
- **Atualização**: `staleTime` de 30 segundos e `refetchInterval` de 30 segundos para atualização frequente

### 3. Endpoint Backend `/api/v1/alerts/critical/count`

- **Arquivo**: `backend/src/alerts/alerts.controller.ts`
- **Método**: `GET`
- **Autenticação**: Requer autenticação JWT e roles `ADMIN`, `ONCOLOGIST`, `NURSE`, ou `COORDINATOR`
- **Resposta**: `{ count: number }`

### 4. Método `getCriticalAlertsCount` no Service

- **Arquivo**: `backend/src/alerts/alerts.service.ts`
- **Funcionalidade**: Conta alertas críticos não resolvidos usando Prisma `count`

### 5. Filtro de Severidade no `AlertsPanel`

- **Arquivo**: `frontend/src/components/dashboard/alerts-panel.tsx`
- **Nova Prop**: `severityFilter?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | null`
- **Funcionalidade**: Filtra alertas por severidade antes de exibir
- **Estado Vazio**: Mostra mensagem específica quando não há alertas da severidade filtrada

### 6. Estado de Filtro de Severidade na Página de Chat

- **Arquivo**: `frontend/src/app/chat/page.tsx`
- **Estado**: `alertsSeverityFilter` para controlar o filtro de severidade
- **Comportamento**:
  - Ao clicar no badge crítico: define `alertsSeverityFilter` como `'CRITICAL'` e muda para aba "Alertas"
  - Ao mudar para aba "Pacientes": limpa o filtro (`setAlertsSeverityFilter(null)`)
  - Na aba "Alertas": mostra badge "Críticos" no botão da aba quando o filtro está ativo

## Arquivos Modificados

### Frontend

1. **`frontend/src/hooks/useAlerts.ts`**
   - Adicionado hook `useCriticalAlertsCount`

2. **`frontend/src/lib/api/alerts.ts`**
   - Adicionado método `getCriticalCount()` no `alertsApi`

3. **`frontend/src/components/dashboard/alerts-panel.tsx`**
   - Adicionada prop `severityFilter`
   - Implementada lógica de filtro por severidade
   - Mensagem de estado vazio quando filtro não retorna resultados

4. **`frontend/src/app/chat/page.tsx`**
   - Adicionado estado `alertsSeverityFilter`
   - Adicionado badge de alertas críticos no header
   - Integrado `useCriticalAlertsCount` hook
   - Conectado clique do badge ao filtro de severidade
   - Adicionado badge "Críticos" no botão da aba "Alertas" quando filtro ativo
   - Limpeza de filtro ao mudar para aba "Pacientes"

### Backend

1. **`backend/src/alerts/alerts.service.ts`**
   - Adicionado método `getCriticalAlertsCount(tenantId: string): Promise<number>`

2. **`backend/src/alerts/alerts.controller.ts`**
   - Adicionado endpoint `@Get('critical/count')` para retornar contagem de alertas críticos

## Fluxo de Funcionamento

1. **Carregamento da Página**:
   - `useCriticalAlertsCount` busca o número de alertas críticos
   - Se `count > 0`, o badge é exibido no header

2. **Clique no Badge**:
   - Muda `activeTab` para `'alerts'`
   - Define `alertsSeverityFilter` como `'CRITICAL'`
   - `AlertsPanel` recebe `severityFilter='CRITICAL'` e filtra os alertas

3. **Visualização Filtrada**:
   - `AlertsPanel` filtra alertas por `severity === 'CRITICAL'`
   - Exibe apenas alertas críticos pendentes
   - Badge "Críticos" aparece no botão da aba "Alertas"

4. **Limpeza do Filtro**:
   - Ao mudar para aba "Pacientes", o filtro é limpo
   - Ao clicar novamente na aba "Alertas", todos os alertas são exibidos (se não houver filtro ativo)

## Exemplo de Uso

```typescript
// No header da página de chat
{criticalAlertsCount && criticalAlertsCount.count > 0 && (
  <button
    onClick={() => {
      setActiveTab('alerts');
      setAlertsSeverityFilter('CRITICAL');
    }}
    className="flex items-center gap-2 px-3 py-2 bg-red-600 border-2 border-red-700 rounded-lg shadow-lg animate-pulse hover:bg-red-700 transition-colors cursor-pointer"
  >
    <Bell className="h-5 w-5 text-white animate-bounce" />
    <span className="text-sm font-bold text-white">
      {criticalAlertsCount.count} ALERTA{criticalAlertsCount.count > 1 ? 'S' : ''} CRÍTICO{criticalAlertsCount.count > 1 ? 'S' : ''}
    </span>
  </button>
)}
```

## Melhorias Futuras

1. **Filtros Adicionais no Painel de Alertas**:
   - Botões para filtrar por severidade (CRITICAL, HIGH, MEDIUM, LOW) diretamente no painel
   - Indicador visual de filtro ativo

2. **Notificações em Tempo Real**:
   - WebSocket para atualizar o contador de alertas críticos em tempo real
   - Notificação do navegador quando novo alerta crítico é criado

3. **Som de Alerta**:
   - Tocar som quando novo alerta crítico é detectado (opcional, configurável)

4. **Histórico de Alertas Críticos**:
   - Visualizar alertas críticos resolvidos recentemente
   - Estatísticas de alertas críticos por período

## Testes

### Teste Manual

1. Criar um alerta com `severity: 'CRITICAL'` e `status: 'PENDING'`
2. Verificar se o badge aparece no header com o número correto
3. Clicar no badge e verificar se:
   - A aba muda para "Alertas"
   - Apenas alertas críticos são exibidos
   - O badge "Críticos" aparece no botão da aba
4. Mudar para aba "Pacientes" e verificar se o filtro é limpo
5. Resolver o alerta crítico e verificar se o contador diminui

### Teste Automatizado (Futuro)

- Teste unitário para `getCriticalAlertsCount` no service
- Teste de integração para o endpoint `/api/v1/alerts/critical/count`
- Teste E2E para o fluxo completo de clique no badge e filtro

## Referências

- [Documentação de Alertas](./estado-atual-proximos-passos.md#alertas)
- [Componente AlertsPanel](../arquitetura/frontend-conversa.md#alerts-panel)
- [API de Alertas](../arquitetura/api-endpoints.md#alerts)
