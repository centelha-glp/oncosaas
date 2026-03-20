# Prompt para Claude Code – Indicadores do dashboard sem dados

Objetivo: preencher os indicadores do dashboard que aparecem em N/A, 0% ou com valores anômalos (ex.: Tempo Médio de Resposta e Tempo Economizado negativos), por meio de **seed de dados realistas** e **correção de cálculo** quando o valor for derivado de dados inválidos.

---

## Prompt para Claude Code

Copie o bloco abaixo e cole no Claude Code para executar a tarefa:

---

# Contexto

O OncoNav possui dashboards (enfermagem e oncologista) que consomem métricas do backend (`backend/src/dashboard/dashboard.service.ts`). Vários indicadores aparecem sem dados (N/A, 0%, gráfico "Alertas por Severidade" vazio) ou com valores anômalos: **Tempo Médio de Resposta** e **Tempo Economizado** exibem números negativos (ex.: -11039h -5m e -33117.2h), o que indica que o tempo de resposta está sendo calculado com `resolvedAt` anterior a `createdAt` em alguns alertas, ou que a fórmula de "tempo economizado" está usando esse valor negativo. As métricas vêm de `getMetrics`, `getNurseMetrics`, `getNavigationMetrics` e `getStatistics`; os dados são Alert (status RESOLVED com resolvedAt/resolvedBy), Intervention, Message (criticalSymptomsDetected), NavigationStep (OVERDUE, completed, dueDate), PatientJourney (diagnosisDate, treatmentStartDate, currentCycle, totalCycles), e estatísticas de alertas por dia/severidade.

# Tarefa

1) **Corrigir o backend** para que o tempo médio de resposta nunca seja negativo: em `dashboard.service.ts`, ao calcular `averageResponseTimeMinutes` (tanto em `getMetrics` quanto em `getNurseMetrics`), usar `Math.max(0, diffMs)` ao somar a diferença entre `resolvedAt` e `createdAt`, de modo que mesmo com dados incorretos o resultado seja >= 0. Se não houver alertas resolvidos, manter `null` (exibido como N/A). 2) **Estender o seed** (`backend/prisma/seed.ts`) para gerar dados que preencham todos os indicadores do dashboard listados abaixo, garantindo que alertas resolvidos tenham sempre `resolvedAt` > `createdAt` e `resolvedBy` igual ao userId da enfermeira.

# Requisitos

**Backend (dashboard.service.ts):**
- Nos trechos que calculam `averageResponseTimeMinutes` (método `getMetrics` e método `getNurseMetrics`), ao calcular `diffMs = resolvedAt - createdAt`, usar `diffMs = Math.max(0, ...)` antes de converter para minutos e somar, para que o tempo de resposta nunca seja negativo.

**Seed (backend/prisma/seed.ts):**
- **Alertas resolvidos (hoje e no passado):** Criar pelo menos 3 alertas com `status: 'RESOLVED'`, `resolvedAt` e `resolvedBy` (id da enfermeira). Garantir `resolvedAt` estritamente posterior a `createdAt` (ex.: createdAt há 2h, resolvedAt há 1h em relação a "agora"). Incluir pelo menos 1 alerta com `resolvedAt` dentro do dia de hoje (para "Alertas Resolvidos Hoje" > 0).
- **Intervenções hoje:** Criar pelo menos 2 registros em **Intervention** com `userId` da enfermeira e `createdAt` no dia atual (para "Pacientes Atendidos Hoje" > 0), em pacientes distintos.
- **Sintomas reportados (últimos 30 dias):** Garantir que existam mensagens **Message** com `direction: 'INBOUND'`, `createdAt` nos últimos 30 dias e `criticalSymptomsDetected` não vazio (ex.: `['dor intensa', 'febre neutropênica']`). O seed já cria mensagens com `criticalSymptomsDetected` em algumas conversas; conferir se as datas de criação estão dentro de 30 dias ou ajustar `createdAt` das mensagens/conversas para datas recentes.
- **Etapas atrasadas e taxa de conclusão:** Criar **NavigationStep** com `status: 'OVERDUE'` e `isCompleted: false` para pelo menos 1 paciente (para "Etapas Atrasadas" > 0). Criar várias etapas com `isCompleted: true` e `completedAt` preenchido para que "Taxa de Conclusão" seja > 0%.
- **Time-to-Diagnosis:** O backend calcula a partir de pacientes que tenham `journey.diagnosisConfirmed: true`, `journey.diagnosisDate` e pelo menos uma **NavigationStep** com `journeyStage: 'DIAGNOSIS'` (usa a primeira por `createdAt`). Garantir no seed que pelo menos 1 paciente tenha PatientJourney com diagnóstico confirmado e diagnóstico data, e que esse paciente tenha pelo menos uma NavigationStep com `journeyStage: 'DIAGNOSIS'` e `createdAt` anterior a `diagnosisDate`, para que `averageTimeToDiagnosisDays` seja calculado (não N/A).
- **Taxa de Adesão:** O backend considera pacientes em PatientJourney com `treatmentStartDate`, `totalCycles` e `currentCycle`; só entram no denominador os que já atingiram 80% dos ciclos; "on track" = currentCycle >= totalCycles. Criar pelo menos 1 paciente com journey em que `currentCycle` e `totalCycles` preenchidos e `currentCycle >= totalCycles` (ex.: 8/8) para que a taxa de adesão seja > 0%.
- **Alertas por severidade (gráfico e estatísticas):** Criar alertas com `createdAt` distribuídos nos últimos 7 dias (e opcionalmente 30 dias), com severidades CRITICAL, HIGH, MEDIUM e LOW, para que o gráfico "Alertas por Severidade" e as métricas "Alertas/Dia (7d)", "Variação de Alertas" e "Redução de Alertas" tenham dados. Manter consistência: `resolvedAt` só em alertas RESOLVED e sempre > `createdAt`.
- **Biomarcadores pendentes (opcional):** Se quiser "Biomarcadores Pendentes" > 0, criar NavigationStep com `stepKey` em `['her2_test','egfr_test','pdl1_test', ...]` (conforme lista em dashboard.service.ts), `isCompleted: false`, `status: 'PENDING'` ou `'IN_PROGRESS'`.
- **Resolução em 24h / Taxa de resolução 7 dias:** Dependem de alertas RESOLVED com `resolvedAt` dentro de 24h ou nos últimos 7 dias; o seed de alertas resolvidos acima já deve ajudar. Garantir que alguns alertas tenham sido criados e resolvidos no período (resolvedAt - createdAt < 24h para "Resolução em 24h").
- **Multi-tenancy e referências:** Todas as entidades no seed devem usar o mesmo `tenantId` do tenant de teste; `resolvedBy` e `userId` em Intervention devem ser o id do usuário enfermeira já criado no seed.
- **Datas no seed:** Usar datas relativas a "hoje" (new Date()) para "Alertas Resolvidos Hoje" e "Pacientes Atendidos Hoje" (ex.: todayStart e createdAt/resolvedAt dentro do dia). Para mensagens e alertas "últimos 30 dias" / "últimos 7 dias", usar datas entre (hoje - 30) e hoje.

# Formato Esperado

- **Arquivos alterados:** `backend/src/dashboard/dashboard.service.ts` (ajuste do cálculo de tempo de resposta com Math.max(0, ...)) e `backend/prisma/seed.ts` (novos blocos de dados listados acima).
- **Comentários no seed:** Indicar brevemente qual indicador do dashboard cada bloco alimenta (ex.: "// Dashboard: Alertas Resolvidos Hoje e Tempo Médio de Resposta").
- **Sem quebrar seed existente:** Manter criação de tenant, usuários, pacientes, conversas, etc.; adicionar os novos creates após os existentes, respeitando ordem de dependências (ex.: alertas resolvidos após Alert e User existirem).
- **Execução:** `cd backend && npx prisma db seed` deve rodar sem erros.

# Não Fazer

- Não alterar o schema Prisma (`schema.prisma`) nesta tarefa.
- Não remover ou esvaziar dados já criados no seed (pacientes, conversas, alertas pendentes existentes).
- Não usar `resolvedAt` anterior a `createdAt` em nenhum Alert; não deixar `averageResponseTimeMinutes` poder ser negativo no backend.
- Não inventar novos endpoints ou DTOs; apenas popular dados que os endpoints atuais já leem.
- Não alterar a lógica de exibição do frontend (N/A, 0%, formato de horas); apenas garantir que o backend retorne valores válidos e que o seed forneça dados para isso.

---

## Correções aplicadas (seed)

- **Time-to-Diagnosis:** Etapas de biomarcadores do Roberto (egfr_test, pdl1_test) passaram a ter `createdAt` explícito (daysAgo(8), daysAgo(6)) para que a primeira etapa DIAGNOSIS no cálculo continue sendo `lung_biopsy` (createdAt daysAgo(20)), com `diagnosisDate` do journey em daysAgo(10) → média de 10 dias.
- **Tempo de resposta (enfermeira):** Foi adicionado um alerta RESOLVED extra com `createdAt` 2h atrás, `resolvedAt` 1h atrás e `resolvedBy: nurse.id`, garantindo tempo de resposta positivo e dados para "Alertas Resolvidos Hoje" quando `resolvedAt` cair no dia atual.
- **Biomarcadores pendentes:** O seed já cria NavigationSteps com stepKey `egfr_test`, `pdl1_test` (Roberto) e `msi_test` (Marcos), `isCompleted: false`, status PENDING/IN_PROGRESS; o backend conta pacientes distintos, resultando em 2.

Após rodar `cd backend && npx prisma db seed`, os indicadores Time-to-Diagnosis, Biomarcadores Pendentes e Tempo Médio de Resposta (dash enfermeira) devem exibir dados ao logar com o tenant e usuário de teste (enfermeira@hospitalteste.com para o dash da enfermeira).

---
