# Prompt para Claude Code – Seed completo PoC OncoNav

Objetivo: mapear todas as funcionalidades do app (conforme `docs/planejamento/poc-escopo.md`) e criar um seed completo que simule todas as funcionalidades funcionando para demo e testes.

---

## Prompt para Claude Code

Copie o bloco abaixo e cole no Claude Code para executar a tarefa:

---

# Contexto

O OncoNav é uma plataforma SaaS de navegação oncológica com backend NestJS + Prisma, frontend Next.js e ai-service em Python. O documento `docs/planejamento/poc-escopo.md` define o escopo da PoC: um tenant, jornada colorretal (ou um tipo de câncer), 10–15 pacientes de demonstração, agente WhatsApp, priorização por score, dashboard enfermagem (lista ordenada, histórico de conversa, alertas em tempo real, ação "Assumir conversa"). O seed atual em `backend/prisma/seed.ts` já cria tenant, usuários, 8 pacientes, PatientJourney, 6 conversas com mensagens, 2 alertas, AgentConfig, ClinicalProtocols e questionários ESAS/PRO-CTCAE, mas não cobre todas as entidades e cenários necessários para simular todas as funcionalidades da PoC.

# Tarefa

Mapear todas as funcionalidades do app referenciadas no PoC e no schema Prisma e, em seguida, estender o seed (`backend/prisma/seed.ts`) para criar um seed completo que simule todas essas funcionalidades funcionando: dados consistentes para lista ordenada por prioridade, histórico de conversas, alertas (incluindo um de NO_RESPONSE), handoff ("Assumir conversa") com Intervention e Conversation atualizada, etapas de navegação (NavigationStep), pelo menos um CancerDiagnosis e Treatment por paciente em tratamento, histórico de PriorityScore, lastInteraction em todos os pacientes, e opcionalmente WhatsAppConnection placeholder, InternalNote, Observation e AgentDecisionLog para enriquecer a demo.

# Requisitos

- Manter o que já existe no seed (tenant, usuários, pacientes atuais, PatientJourney, conversas, mensagens, alertas CRITICAL_SYMPTOM, AgentConfig, ClinicalProtocols, ESAS, PRO-CTCAE).
- Adicionar ou ajustar dados para cobrir:
  - **Priorização**: Garantir que todos os pacientes tenham `priorityScore`, `priorityCategory`, `priorityReason` e `priorityUpdatedAt`; criar registros em **PriorityScore** (histórico) para pelo menos 3 pacientes com scores/reasons variados.
  - **lastInteraction**: Preencher `lastInteraction` para todos os pacientes (valores variados: alguns recentes, um com vários dias atrás para suportar alerta NO_RESPONSE).
  - **Alertas**: Manter os 2 alertas CRITICAL_SYMPTOM existentes; adicionar pelo menos 1 alerta do tipo **NO_RESPONSE** (paciente sem resposta há X dias) e, se fizer sentido, 1 **NAVIGATION_DELAY** ou **DELAYED_APPOINTMENT** para demonstrar variedade no dashboard.
  - **Handoff "Assumir conversa"**: Para as conversas com status ESCALATED ou que tenham mensagens com sintoma crítico: atualizar `Conversation` com `handledBy: NURSING`, `assumedByUserId` (id da enfermeira) e `assumedAt`; criar registros em **Intervention** com `type: ASSUME` (e opcionalmente `RESPONSE` ou `ALERT_RESOLVED`) vinculados ao paciente e ao usuário enfermeira, e quando aplicável à mensagem.
  - **NavigationStep**: Criar etapas de navegação (**NavigationStep**) para pelo menos 4 pacientes (mistura de PENDING, IN_PROGRESS, COMPLETED, OVERDUE), vinculadas ao PatientJourney e ao tipo de câncer/jornada (ex.: colorretal – colonoscopia, biópsia, estadiamento, cirurgia, quimio). Usar `journeyStage`, `stepKey`, `stepName`, `expectedDate`, `dueDate`, `status`, `isCompleted`.
  - **CancerDiagnosis e Treatment**: Para pacientes em TREATMENT ou FOLLOW_UP, criar **CancerDiagnosis** (cancerType, stage, diagnosisDate, etc.) e **Treatment** (treatmentType, protocol, currentCycle, totalCycles, status ACTIVE ou COMPLETED) vinculados ao diagnóstico, para que a listagem e o dashboard possam exibir dados realistas.
  - **Observations (opcional)**: Inserir 2–3 **Observation** para pacientes que tenham mensagens com structuredData (ex.: pain severity, nausea), usando códigos LOINC e valueQuantity/valueString.
  - **InternalNote (opcional)**: Uma nota interna (**InternalNote**) para um paciente com alerta crítico (ex.: Marcos ou Antônio), authorId = enfermeira.
  - **WhatsAppConnection (opcional)**: Um registro **WhatsAppConnection** em status CONNECTED ou PENDING para o tenant, com nome e phoneNumber de demonstração, para a tela de configuração não ficar vazia.
  - **AgentDecisionLog (opcional)**: 2–3 registros **AgentDecisionLog** (ex.: CRITICAL_ESCALATION, ALERT_CREATED) vinculados às conversas que dispararam alerta.
- Respeitar multi-tenancy: todas as entidades devem usar o mesmo `tenantId` do tenant de teste.
- Manter consistência referencial: foreign keys válidas (patientId, conversationId, userId, diagnosisId, etc.).
- Não remover usuários existentes; pode adicionar NURSE_CHIEF ou DOCTOR se quiser mais perfis para handoff.
- Garantir que o seed rode de forma idempotente onde fizer sentido (upsert ou deleteMany + create em blocos que forem recriados); para novos blocos, usar create e evitar duplicatas (por exemplo, checar existência antes de criar PriorityScore, Intervention, NavigationStep, etc.).
- Documentar no próprio `seed.ts` (comentários no topo ou antes de cada bloco) o mapeamento funcionalidade-PoC (ex.: "// PoC: Dashboard lista ordenada por prioridade" ou "// PoC: Handoff - Assumir conversa").

# Formato Esperado

- Um único arquivo modificado: `backend/prisma/seed.ts`.
- Código em TypeScript, usando o Prisma Client já importado; helpers locais (como o `createConversation` existente) podem ser reutilizados ou estendidos.
- Comentários que indiquem qual item do escopo PoC ou qual funcionalidade do app cada trecho do seed está simulando.
- Ao final do seed, um `console.log` resumindo o que foi criado (ex.: "PriorityScore: N registros, NavigationStep: M, Interventions: K, Alerts: ...").
- O seed deve executar sem erros com `cd backend && npx prisma db seed`.

# Não Fazer

- Não alterar o schema Prisma (`schema.prisma`) nesta tarefa.
- Não criar novos arquivos de seed; apenas estender o `seed.ts` existente.
- Não usar dados reais de saúde ou telefones reais; manter emails/telefones fictícios (ex.: paciente1@email.com, +5511999999999).
- Não remover os pacientes ou conversas já criados; apenas adicionar dados que faltam e, se necessário, atualizar registros existentes (ex.: Conversation.assumedByUserId, Patient.lastInteraction).
- Não quebrar a ordem de criação por dependências (ex.: criar Intervention após User e Conversation existirem; criar NavigationStep após PatientJourney; criar Treatment após CancerDiagnosis).

---
