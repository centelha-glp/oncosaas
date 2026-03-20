# Prompt para Claude Code – Simplificar dashboard da enfermagem

Copie o bloco abaixo e cole no Claude Code para executar a tarefa:

---

# Contexto

O OncoNav possui um **dashboard da enfermagem** (Navegação Oncológica) usado no dia a dia pela equipe de enfermagem. Ele consome duas APIs: **nurse-metrics** (`GET /dashboard/nurse-metrics`) e **navigation-metrics** (`GET /dashboard/navigation-metrics`). As métricas são exibidas em dois painéis: **NurseMetricsPanel** (métricas operacionais do enfermeiro) e **NavigationMetricsPanel** (métricas de navegação oncológica). O objetivo é **simplificar mantendo apenas os indicadores essenciais** para o trabalho diário, reduzindo ruído visual e carga de dados.

# Tarefa

Analisar o dashboard da enfermagem e os indicadores atuais e **simplificar mantendo só os indicadores essenciais**: remover do backend (DTOs e métodos de serviço), do frontend (tipos, painéis e gráficos) e da documentação tudo que não fizer parte do conjunto essencial definido abaixo.

**Escopo:** apenas o dashboard da enfermagem (componentes em `frontend/src/components/dashboard/nurse/`, APIs `nurse-metrics` e `navigation-metrics`). Não alterar o dashboard gerencial/oncologista.

---

## 1) Nurse Metrics (API nurse-metrics) – Indicadores a MANTER

- **alertsResolvedToday** – Alertas resolvidos hoje pelo enfermeiro.
- **averageResponseTimeMinutes** – Tempo médio de resposta do enfermeiro (minutos).
- **patientsAttendedToday** – Pacientes únicos atendidos hoje (intervenções).

**Indicadores a REMOVER (nurse-metrics):**

- **agentResponseRate** – Taxa de resposta ao agente (card + cálculo no backend).
- **topReportedSymptoms** – Sintomas mais reportados (card + cálculo no backend).

Ajustar: `NurseMetricsDto`, `getNurseMetrics` em `dashboard.service.ts`, interface `NurseMetrics` em `frontend/src/lib/api/nurse-metrics.ts`, e `NurseMetricsPanel` (remover os dois cards: Taxa de Resposta ao Agente e Sintomas Mais Reportados).

---

## 2) Navigation Metrics (API navigation-metrics) – Indicadores a MANTER

- **overdueStepsCount** – Total de etapas atrasadas.
- **criticalOverdueStepsCount** – Etapas atrasadas críticas (>14 dias).
- **stepsDueSoonCount** – Etapas com prazo nos próximos 7 dias.
- **overallCompletionRate** – Taxa geral de conclusão de etapas (%).
- **patientsByStage** – Distribuição de pacientes por fase (SCREENING, DIAGNOSIS, TREATMENT, FOLLOW_UP).

**Indicadores a REMOVER (navigation-metrics):**

- **stageMetrics** – Métricas detalhadas por fase (completionRate, averageTimeDays, totalSteps, etc.).
- **bottlenecks** – Lista de bottlenecks identificados.
- **averageTimePerStage** – Tempo médio por fase.

Ajustar: `NavigationMetricsDto`, `getNavigationMetrics` em `dashboard.service.ts`, interfaces em `frontend/src/lib/api/navigation-metrics.ts`, e **NavigationMetricsPanel**: manter os 4 cards principais (Etapas Atrasadas, Etapas Próximas do Prazo, Taxa de Conclusão, Total de Pacientes) e o bloco “Pacientes por Fase da Jornada” (grid por estágio). **Remover:** gráfico “Taxa de Conclusão por Fase”, gráfico “Tempo Médio por Fase”, card “Métricas Detalhadas por Fase” e toda a seção “Bottlenecks Identificados”.

---

# Requisitos

- Manter isolamento por tenant em todas as queries (`tenantId` no `where`).
- Manter o papel NURSE nos endpoints `nurse-metrics` e `navigation-metrics` (guards/roles inalterados).
- Garantir que as respostas das APIs não incluam propriedades removidas (DTOs e retorno dos serviços alinhados).
- Atualizar os tipos TypeScript no frontend (`NurseMetrics`, `NavigationMetrics`, `StageMetrics`, `Bottleneck` conforme o que permanecer) para refletir os contratos simplificados.
- Não remover o **CriticalAlertsPanel**, a **lista de pacientes com etapas críticas**, as abas (Pacientes/Alertas, Detalhes/Notas/Histórico) nem o **ShiftChecklist** do `NurseSpecificDashboard`; apenas simplificar os dois painéis de métricas (NurseMetricsPanel e NavigationMetricsPanel).
- Se existir documentação em `docs/` que descreva as métricas da enfermagem, atualizá-la com a lista essencial e o que foi descontinuado.

# Formato Esperado

- **Backend:** `backend/src/dashboard/dto/nurse-metrics.dto.ts` apenas com `alertsResolvedToday`, `averageResponseTimeMinutes`, `patientsAttendedToday`.
- **Backend:** `backend/src/dashboard/dashboard.service.ts` – em `getNurseMetrics`, remover cálculos de `agentResponseRate` e `topReportedSymptoms`; em `getNavigationMetrics`, remover cálculo e retorno de `stageMetrics`, `bottlenecks` e `averageTimePerStage`.
- **Backend:** `backend/src/dashboard/dto/navigation-metrics.dto.ts` – remover `stageMetrics`, `bottlenecks`, `averageTimePerStage`; manter o restante. Remover ou ajustar imports de `StageMetrics` e `Bottleneck` se não forem mais usados no DTO.
- **Frontend:** `frontend/src/lib/api/nurse-metrics.ts` – interface `NurseMetrics` só com os três campos mantidos.
- **Frontend:** `frontend/src/lib/api/navigation-metrics.ts` – interface `NavigationMetrics` sem `stageMetrics`, `bottlenecks`, `averageTimePerStage`; remover ou manter `StageMetrics`/`Bottleneck` apenas se ainda usados em outro lugar.
- **Frontend:** `frontend/src/components/dashboard/nurse/nurse-metrics-panel.tsx` – exibir apenas 3 cards (Alertas Resolvidos Hoje, Tempo Médio de Resposta, Pacientes Atendidos Hoje).
- **Frontend:** `frontend/src/components/dashboard/nurse/navigation-metrics-panel.tsx` – exibir os 4 cards + grid “Pacientes por Fase da Jornada”; remover gráficos de barras (Taxa de Conclusão por Fase, Tempo Médio por Fase), card “Métricas Detalhadas por Fase” e seção “Bottlenecks Identificados”.

# Não Fazer

- Não alterar rotas, autenticação ou guards dos endpoints de dashboard.
- Não modificar o dashboard gerencial (oncologista) nem componentes em `dashboard/oncologist/`.
- Não remover o CriticalAlertsPanel, a lista de pacientes (PatientsCriticalStepsList), o AlertsPanel nem as abas de detalhes/notas/histórico do dashboard da enfermagem.
- Não introduzir novos indicadores ou novas telas; apenas reduzir o conjunto atual ao essencial definido acima.

---
