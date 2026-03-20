# Revisão das Métricas do Dashboard OncoNav

## Resumo Executivo

O dashboard do OncoNav foi simplificado para manter apenas os indicadores essenciais para uso diário da equipe. Este documento descreve as métricas mantidas, o que foi removido e os motivos da simplificação.

---

## 1. Métricas Essenciais (pós-simplificação)

### 1.1 KPIs Operacionais (`/dashboard/metrics`)

| Métrica | Descrição | Fonte |
|---------|-----------|-------|
| `totalActivePatients` | Pacientes com status ACTIVE, IN_TREATMENT ou FOLLOW_UP | Patient |
| `criticalPatientsCount` | Pacientes com priorityScore >= 75 e status ativo | Patient |
| `totalPendingAlerts` | Soma de alertas não RESOLVED por severidade | Alert |
| `criticalAlertsCount`, `highAlertsCount` | Alertas por severidade (breakdown principal) | Alert |
| `mediumAlertsCount`, `lowAlertsCount` | Alertas de menor prioridade (breakdown complementar) | Alert |
| `unassumedMessagesCount` | Mensagens INBOUND sem `assumedBy` | Message |
| `averageResponseTimeMinutes` | Média (resolvedAt - createdAt) de alertas resolvidos | Alert |
| `overdueStepsCount` | Etapas com status OVERDUE e não concluídas | NavigationStep |
| `pendingBiomarkersCount` | Pacientes com etapas de biomarcadores pendentes | NavigationStep |
| `treatmentAdherencePercentage` | % que completaram >=80% dos ciclos planejados | PatientJourney |

### 1.2 Métricas Clínicas de Tempo

| Métrica | Descrição | Meta | Cálculo |
|---------|-----------|------|---------|
| `averageTimeToTreatmentDays` | Diagnóstico -> Início tratamento | <30 dias | PatientJourney (diagnosisDate, treatmentStartDate) |
| `averageTimeToDiagnosisDays` | 1a etapa DIAGNOSIS -> diagnóstico confirmado | <60 dias | NavigationStep + PatientJourney |

### 1.3 Distribuição

| Distribuição | Descrição |
|-------------|-----------|
| `priorityDistribution` | CRITICAL, HIGH, MEDIUM, LOW (Patient.priorityCategory) |

---

## 2. Métricas Descontinuadas

As seguintes métricas foram removidas do endpoint `/dashboard/metrics` por não serem essenciais para operação diária:

| Métrica removida | Motivo |
|-----------------|--------|
| `resolvedTodayCount` | Informação pontual de baixo valor operacional; tendência de alertas disponível via `/dashboard/statistics` |
| `stagingCompletePercentage` | Métrica clínica acessória; estadiamento pode ser acompanhado via navegação oncológica |
| `cancerTypeDistribution` | Distribuição estática que muda lentamente; não necessária para triagem diária |
| `criticalTimelines` (endpoint) | Prazos críticos por tipo de câncer — seção e endpoint `/dashboard/critical-timelines` removidos; DTO e componente excluídos |
| `journeyStageDistribution` | Distribuição por jornada disponível em outros relatórios; não essencial no dashboard principal |
| `statusDistribution` | Redundante com `totalActivePatients` para operação diária |

### Impacto nos componentes

- **KPI Cards**: Removidos os cards "Casos Resolvidos Hoje" e "Estadiamento Completo"
- **Gráficos**: Removidos gráficos "Top 5 Tipos de Cancer" e "Distribuicao por Jornada"
- **Prazos Críticos por Tipo de Câncer**: Seção `CriticalTimelinesSection` removida do dashboard; endpoint `GET /dashboard/critical-timelines` e DTO `critical-timelines.dto.ts` excluídos
- **Executive View**: Simplificada para usar apenas dados ainda disponíveis (taxa de pacientes críticos, variação de alertas, benchmarks de time-to-treatment/diagnosis)
- **ROI Section**: Ajustada para não depender de `resolvedTodayCount`

---

## 3. Observações Pendentes

- [ ] Avaliar filtro temporal em `unassumedMessagesCount` (mensagens antigas podem inflar o número)
- [ ] Documentar metas (limites verde/laranja/vermelho) em constantes
- [ ] Considerar cache (Redis, TTL 1-2min) para `getMetrics` em produção

---

## 4. Arquivos Envolvidos

| Arquivo | Função |
|---------|--------|
| `backend/src/dashboard/dashboard.service.ts` | Lógica de cálculo |
| `backend/src/dashboard/dashboard.service.spec.ts` | Testes unitários |
| `backend/scripts/verify-dashboard-metrics.ts` | Script de verificação (após seed) |
| `backend/src/dashboard/dto/dashboard-metrics.dto.ts` | Contrato da API |
| `frontend/src/lib/api/dashboard.ts` | Interface TypeScript |
| `frontend/src/components/dashboard/oncologist/kpi-cards.tsx` | Exibição dos KPIs |
| `frontend/src/components/dashboard/oncologist/metrics-charts.tsx` | Gráficos |
| `frontend/src/components/dashboard/oncologist/executive-view.tsx` | Visão executiva |
| `frontend/src/components/dashboard/oncologist/roi-section.tsx` | Seção de ROI |

---

## 5. Verificação Automatizada

Executar após `npm run prisma:seed`:

```bash
cd backend && npm run verify-dashboard
```

O script valida: ausência de valores negativos ou NaN; médias nulas ou >= 0; percentuais válidos.

---

*Documento atualizado em março 2026 — simplificação do dashboard*
