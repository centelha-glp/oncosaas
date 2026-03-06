# Revisão das Métricas do Dashboard OncoNav

## Resumo Executivo

O dashboard do OncoNav possui métricas em **3 níveis**: KPIs principais, métricas clínicas críticas e distribuições. Este documento identifica inconsistências, possíveis bugs e sugestões de melhoria.

---

## 1. Métricas Atuais

### 1.1 KPIs Principais (`/dashboard/metrics`)

| Métrica | Descrição | Fonte |
|---------|-----------|-------|
| `totalActivePatients` | Pacientes com status ACTIVE, IN_TREATMENT ou FOLLOW_UP | Patient |
| `criticalPatientsCount` | Pacientes com priorityScore >= 75 e status ativo | Patient |
| `totalPendingAlerts` | Soma de alertas não RESOLVED por severidade | Alert |
| `criticalAlertsCount`, `highAlertsCount`, etc. | Alertas por severidade | Alert |
| `unassumedMessagesCount` | Mensagens INBOUND sem `assumedBy` | Message |
| `resolvedTodayCount` | Alertas RESOLVED com `resolvedAt` >= hoje 00:00 | Alert |
| `averageResponseTimeMinutes` | Média (resolvedAt - createdAt) de alertas resolvidos | Alert |
| `overdueStepsCount` | Etapas com status OVERDUE e não concluídas | NavigationStep |

### 1.2 Métricas Clínicas Críticas

| Métrica | Descrição | Meta | Cálculo |
|---------|-----------|------|---------|
| `averageTimeToTreatmentDays` | Diagnóstico → Início tratamento | <30 dias | PatientJourney (diagnosisDate, treatmentStartDate) |
| `averageTimeToDiagnosisDays` | 1ª etapa DIAGNOSIS → diagnóstico confirmado | <60 dias | NavigationStep + PatientJourney |
| `stagingCompletePercentage` | % com estadiamento antes de tratamento | Alto | stagingDate <= treatmentStartDate |
| `pendingBiomarkersCount` | Pacientes com etapas de biomarcadores pendentes | Baixo | NavigationStep (stepKey em lista de 14 keys) |
| `treatmentAdherencePercentage` | % que completaram >=80% dos ciclos planejados | >=80% | currentCycle >= 80% de totalCycles |

### 1.3 Distribuições

- **priorityDistribution**: CRITICAL, HIGH, MEDIUM, LOW (Patient.priorityCategory)
- **cancerTypeDistribution**: Top 10 tipos de câncer
- **journeyStageDistribution**: SCREENING, NAVIGATION, DIAGNOSIS, TREATMENT, FOLLOW_UP
- **statusDistribution**: Todos os status (ACTIVE, INACTIVE, etc.)

---

## 2. Inconsistências e Possíveis Bugs

### 2.1 ~~🔴~~ ✅ `statusDistribution` — Base de cálculo incorreta **(CORRIGIDO)**

**Arquivo:** `backend/src/dashboard/dashboard.service.ts` (linhas 205-220)

**Problema original:** `statusDistribution` inclui **todos** os pacientes, mas o percentual usava `totalActivePatients` como denominador, fazendo a soma ultrapassar 100%.

**Correção aplicada:** Usa o total geral de pacientes como denominador:
```typescript
const totalPatients = statusDistribution.reduce((sum, i) => sum + i._count, 0);
percentage: totalPatients > 0 ? Math.round((item._count / totalPatients) * 100 * 10) / 10 : 0
```

---

### 2.2 🟡 `patientStatistics` em getStatistics — Status histórico

**Arquivo:** `dashboard.service.ts` (linhas 389-408)

O filtro de "pacientes ativos na data" usa o **status atual** do paciente:
```typescript
const activeOnDate = patients.filter(
  (p) =>
    new Date(p.createdAt) <= date &&
    ['ACTIVE', 'IN_TREATMENT', 'FOLLOW_UP'].includes(p.status)  // status ATUAL
);
```

**Problema:** Pacientes que foram INACTIVE em uma data mas depois viraram ACTIVE aparecem como ativos em todas as datas passadas. Para métricas históricas precisas, seria necessário um modelo de histórico de status (que não existe atualmente).

**Impacto:** Baixo — aceitável para visão operacional atual.

---

### 2.3 ~~🟡~~ ✅ `treatmentAdherencePercentage` **(CORRIGIDO)** — Definição de “aderente”

**Problema original:** Pacientes no ciclo 1 de 12 eram considerados não aderentes indevidamente.

**Correção aplicada (opção B):** Apenas pacientes com `currentCycle >= totalCycles * 0.8` entram no denominador. Pacientes em ciclo 1/12 deixam de ser contados. `patientsOnTrack` = quem completou tratamento (`currentCycle >= totalCycles`).

---

### 2.4 🟡 `unassumedMessagesCount` — Escopo

**Código atual:** Conta **todas** as mensagens INBOUND sem `assumedBy` no tenant.

**Consideração:** Mensagens muito antigas (ex: 1 ano) podem inflar o número. Avaliar:
- Filtrar por data (ex: últimas 24h ou 7 dias)?
- Agrupar por conversa e contar conversas com mensagens não assumidas?

---

### 2.5 ~~🟢~~ ✅ `biopsy_to_pathology` em getCriticalTimelines — Case sensitivity **(CORRIGIDO)**

**Arquivo:** `dashboard.service.ts` — queries de Critical Timelines

**Problema original:** O filtro `cancerType` comparava de forma case-sensitive, podendo retornar `NO_DATA` com "Colorectal" vs "colorectal".

**Correção aplicada:** Comparação case-insensitive em 5 pontos (`{ equals: cancerType, mode: 'insensitive' }`): `time_to_diagnosis`, `time_to_treatment`, `biopsy_to_pathology`, `diagnosis_to_surgery`, `surgery_to_adjuvant_chemotherapy`.

---

## 3. Sugestões de Novas Métricas

Com base nas guidelines de navegação oncológica:

| Métrica | Descrição | Prioridade |
|---------|-----------|------------|
| **Tempo médio biópsia → laudo** | Já existe em Critical Timelines; poderia ser KPI no dashboard principal | Média |
| **Taxa de resposta ao agente** | % de mensagens respondidas pela equipe (já existe em NurseMetrics) | Média |
| **Pacientes em risco de atraso** | Etapas com dueDate nos próximos 7 dias e status PENDING/IN_PROGRESS | Alta |
| **SLA de primeiro contato** | Tempo desde primeira mensagem até primeira resposta da equipe | Média |

---

## 4. Performance

O `getMetrics` executa **mais de 15 queries** ao banco. Para tenants com muitos pacientes, considerar:

1. **Cache** (Redis): TTL de 1-2 minutos para métricas agregadas
2. **Batch queries**: Algumas contagens poderiam ser consolidadas
3. **Background job**: Pré-calcular métricas pesadas (ex: getCriticalTimelines)

---

## 5. Checklist de Revisão

- [x] Corrigir `statusDistribution` (percentual com base no total correto)
- [x] Revisar definição de `treatmentAdherencePercentage` (opção B aplicada)
- [ ] Avaliar filtro temporal em `unassumedMessagesCount`
- [x] Normalizar `cancerType` em queries de Critical Timelines
- [ ] Documentar metas (limites verde/laranja/vermelho) em constantes
- [ ] Considerar cache para `getMetrics` em produção

---

## 6. Arquivos Envolvidos

| Arquivo | Função |
|---------|--------|
| `backend/src/dashboard/dashboard.service.ts` | Lógica de cálculo |
| `backend/src/dashboard/dashboard.service.spec.ts` | Testes unitários |
| `backend/scripts/verify-dashboard-metrics.ts` | Script de verificação (após seed) |
| `backend/src/dashboard/dto/dashboard-metrics.dto.ts` | Contrato da API |
| `frontend/src/lib/api/dashboard.ts` | Interface TypeScript |
| `frontend/src/components/dashboard/oncologist/kpi-cards.tsx` | Exibição dos KPIs |
| `frontend/src/components/dashboard/oncologist/metrics-charts.tsx` | Gráficos |

---

## 7. Verificação Automatizada

Executar após `npm run prisma:seed`:

```bash
cd backend && npm run verify-dashboard
```

O script valida: soma de `statusDistribution` entre 99,5 e 100,5; percentuais ≤ 100; ausência de valores negativos; médias nulas ou ≥ 0.

---

*Documento gerado em revisão das métricas do dashboard — março 2025*
