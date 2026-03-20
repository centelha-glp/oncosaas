# Prompt para Claude Code – Indicadores do dashboard da enfermeira

Objetivo: corrigir os indicadores **Alertas Resolvidos Hoje**, **Tempo Médio de Resposta** e **Pacientes Atendidos Hoje** no dashboard da enfermeira, que aparecem em 0 ou N/A.

---

## Prompt para Claude Code

Copie o bloco abaixo e cole no Claude Code para executar a tarefa:

---

# Contexto

O OncoNav tem um dashboard da enfermeira que consome métricas do endpoint de nurse metrics (`backend/src/dashboard/dashboard.service.ts` → `getNurseMetrics(tenantId, userId)`). Três indicadores estão sem funcionar: **Alertas Resolvidos Hoje** (0), **Tempo Médio de Resposta** (N/A) e **Pacientes Atendidos Hoje** (0). A lógica atual usa: (1) Alertas com `status: 'RESOLVED'`, `resolvedBy: userId` e `resolvedAt >= todayStart` para “Alertas Resolvidos Hoje” e para a média de tempo de resposta; (2) Intervention com `userId` e `createdAt >= todayStart` para “Pacientes Atendidos Hoje”. O `userId` é o id do usuário logado (enfermeira); `todayStart` é meia-noite do dia atual (local). O seed (`backend/prisma/seed.ts`) já cria alertas RESOLVED e intervenções “hoje” usando `nurse.id`; se os indicadores continuam 0/N/A, as causas prováveis são dados com datas fora do “hoje” do servidor, `userId` do JWT diferente do `nurse.id` do seed, ou seed não reexecutado.

# Tarefa

1. **Diagnosticar** no backend e no seed por que os três indicadores retornam 0 ou null: verificar se `getNurseMetrics` recebe o `userId` correto (mesmo id da enfermeira do seed), se existem Alert com `resolvedBy` igual a esse id e `resolvedAt` no dia atual, e se existem Intervention com `userId` igual e `createdAt` no dia atual.
2. **Ajustar o seed** para garantir que, ao rodar `npx prisma db seed`, sejam criados: (a) pelo menos 2 alertas com `status: 'RESOLVED'`, `resolvedBy` = id da enfermeira (obtido pelo upsert de `enfermeira@hospitalteste.com`), `resolvedAt` e `createdAt` no **mesmo dia civil** em que o seed roda (usar `new Date()` e ajustar horas/minutos, ou `todayStart` + offset em ms), com `resolvedAt` > `createdAt`; (b) pelo menos 2 intervenções com `userId` = id da enfermeira e `createdAt` no mesmo dia civil (ex.: `new Date()` ou algumas horas atrás no mesmo dia).
3. **Corrigir o backend** se necessário: garantir que `todayStart` seja calculado em horário local (ex.: `new Date()` e `setHours(0,0,0,0)`) e que as queries usem o mesmo critério de “hoje”; garantir que, na ausência de alertas resolvidos, `averageResponseTimeMinutes` permaneça `null` (N/A) e não negativo.

# Requisitos

- **Seed:** Criar/garantir alertas RESOLVED e intervenções **no dia de execução do seed**. Usar `const now = new Date();` e, para “hoje”, definir `createdAt`/`resolvedAt` com a mesma data e hora dentro do dia (ex.: `resolvedAt = new Date(now)`, `resolvedAt.setHours(10, 30, 0, 0)`; `createdAt` algumas horas antes no mesmo dia). Garantir que `resolvedBy` e `Intervention.userId` usem **sempre** o id retornado pelo upsert da enfermeira (`enfermeira@hospitalteste.com`), criado **antes** dos deletes em massa do seed, para que o mesmo id seja usado ao criar alertas e intervenções.
- **Backend:** Manter `getNurseMetrics(tenantId, userId)` inalterado na assinatura; as queries devem filtrar por `tenantId` e `userId` (nurse). O cálculo de `todayStart` deve ser início do dia em horário local. O tempo médio de resposta deve usar `Math.max(0, diffMs)` ao calcular `resolvedAt - createdAt`.
- **Ordem no seed:** Criar os blocos de “alertas resolvidos hoje” e “intervenções hoje” **depois** da criação do tenant e do usuário enfermeira e **depois** da criação dos pacientes, para usar `nurse.id` e `patientMap.*` corretamente.
- **Teste:** Após as alterações, executar `cd backend && npx prisma db seed` e, no **mesmo dia**, logar no frontend como `enfermeira@hospitalteste.com` (senha do seed) e abrir o dashboard da enfermeira; os três indicadores devem exibir valores > 0 e tempo de resposta em minutos (não N/A).

# Formato Esperado

- **Arquivos alterados:** `backend/prisma/seed.ts` (blocos que criam Alert RESOLVED e Intervention com datas “hoje” e `resolvedBy`/`userId` = nurse.id). Opcionalmente `backend/src/dashboard/dashboard.service.ts` apenas se for necessário ajuste de `todayStart` ou do cálculo de tempo de resposta.
- **Comentários no seed:** Indicar explicitamente que o bloco alimenta “Alertas Resolvidos Hoje”, “Tempo Médio de Resposta” e “Pacientes Atendidos Hoje” do dashboard da enfermeira.
- **Execução:** `cd backend && npx prisma db seed` deve rodar sem erros.

# Não Fazer

- Não alterar o schema Prisma nem os DTOs/endpoints do dashboard.
- Não usar `resolvedAt` anterior ou igual a `createdAt` em Alert.
- Não criar usuário enfermeira depois dos deletes em massa (o id da enfermeira deve ser o mesmo usado em Alert e Intervention).
- Não depender de timezone UTC para “hoje”: usar o mesmo critério de dia civil que o backend (local).

---
