/**
 * Script para analisar as mensagens da paciente Bia contra os critérios do plano.
 * Avalia se as ações do agente foram corretas (orchestrator, symptom_analyzer, protocol_engine).
 *
 * Executar: cd backend && npx ts-node scripts/analyze-bia-conversation.ts
 */

import { PrismaClient } from '@generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env') });

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

interface MessageRow {
  direction: string;
  content: string;
  processedBy: string | null;
  structuredData: unknown;
  criticalSymptomsDetected: unknown;
  alertTriggered: boolean | null;
  whatsappTimestamp: Date;
}

interface ChecklistItem {
  ok: boolean;
  note: string;
}

async function main() {
  console.log('📋 Análise das Mensagens da Paciente Bia\n');
  console.log('═'.repeat(60));

  await prisma.$connect();

  const patient = await prisma.patient.findFirst({
    where: { name: { contains: 'Bia', mode: 'insensitive' } },
    include: {
      conversations: {
        orderBy: { lastMessageAt: 'desc' },
        include: {
          messages: {
            orderBy: { whatsappTimestamp: 'asc' },
          },
        },
      },
    },
  });

  if (!patient) {
    console.log('❌ Paciente Bia não encontrado.');
    throw new Error('Paciente Bia não encontrado.');
  }

  const conv = patient.conversations[0];
  if (!conv || !conv.messages.length) {
    console.log('❌ Nenhuma conversa com mensagens.');
    throw new Error('Nenhuma conversa com mensagens.');
  }

  const messages = conv.messages as unknown as MessageRow[];
  const conversationId = conv.id;

  // Buscar AgentDecisionLog e Alerts
  const decisions = await prisma.agentDecisionLog.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
  });

  const alerts = await prisma.alert.findMany({
    where: { patientId: patient.id },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`\n📌 Paciente: ${patient.name} (${patient.cancerType}, ${patient.currentStage})`);
  console.log(`   Conversa: ${conversationId}`);
  console.log(`   Mensagens: ${messages.length} | Decisões: ${decisions.length} | Alertas: ${alerts.length}\n`);

  // Agrupar mensagens em pares INBOUND -> OUTBOUND
  const pairs: { inbound: MessageRow; outbound?: MessageRow }[] = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.direction === 'INBOUND') {
      const outbound = messages[i + 1]?.direction === 'OUTBOUND' ? messages[i + 1] : undefined;
      pairs.push({ inbound: m, outbound });
    }
  }

  const report: string[] = [];
  const deviations: string[] = [];

  // Checklist por par
  for (let idx = 0; idx < pairs.length; idx++) {
    const { inbound, outbound } = pairs[idx];
    const seq = idx + 1;

    report.push(`\n--- Troca ${seq} ---`);
    report.push(`INBOUND: "${inbound.content}"`);
    if (outbound) {report.push(`OUTBOUND: "${outbound.content?.substring(0, 100)}..."`);}

    const checks: ChecklistItem[] = [];

    // 1. Agente pediu escala 0-10 quando apropriado?
    const hasSymptomWord = /dor|náusea|enjoo|fadiga|febre|sintoma/i.test(inbound.content);
    const hasScaleRequest = outbound?.content && /escala.*0.*10|0 a 10|0-10|que nota/i.test(outbound.content);
    checks.push({
      ok: !hasSymptomWord || !!hasScaleRequest,
      note: hasSymptomWord
        ? hasScaleRequest
          ? '✅ Pediu escala 0-10'
          : '❌ Deveria ter pedido escala 0-10'
        : 'N/A (sem sintoma)',
    });
    if (hasSymptomWord && !hasScaleRequest && !/^\d+$/.test(inbound.content))
      {deviations.push(`Troca ${seq}: Paciente relatou sintoma mas agente não pediu escala 0-10`);}

    // 2. Agente extraiu e registrou em structuredData?
    const hasStructuredData = !!(
      (outbound?.structuredData as Record<string, unknown>)?.symptoms ||
      (outbound?.structuredData as Record<string, unknown>)?.scales
    );
    checks.push({
      ok: !hasSymptomWord || hasStructuredData,
      note: outbound ? (hasStructuredData ? '✅ structuredData preenchido' : '⚠️ structuredData null (pode ser bug)') : 'N/A',
    });
    if (hasSymptomWord && outbound && !hasStructuredData)
      {deviations.push(`Troca ${seq}: structuredData não preenchido apesar de sintoma/valor`);}

    // 3. Para score ≥7, foi criado alerta?
    const numericReply = parseInt(inbound.content.replace(/\D/g, ''), 10);
    const isHighScore = !isNaN(numericReply) && numericReply >= 7;
    const decisionHasAlert = decisions.some(
      (d) =>
        d.decisionType === 'ALERT_CREATED' ||
        (d.outputAction as { type?: string })?.type?.includes('ALERT')
    );
    const hasAlertForPatient = alerts.length > 0;
    checks.push({
      ok: !isHighScore || decisionHasAlert || hasAlertForPatient,
      note: isHighScore
        ? decisionHasAlert || hasAlertForPatient
          ? '✅ Alerta esperado (decisão ou Alert)'
          : '❌ Score ≥7 sem alerta registrado'
        : 'N/A',
    });
    if (isHighScore && !decisionHasAlert && !hasAlertForPatient)
      {deviations.push(`Troca ${seq}: Paciente respondeu ${numericReply}/10 mas nenhum alerta foi criado`);}

    // 4. Resposta segue orientações clínicas?
    const hasClinicalGuidance =
      !outbound || /equipe|pronto.socorro|SAMU|192|procurar|avaliar|contato/i.test(outbound.content);
    checks.push({
      ok: true,
      note: hasClinicalGuidance ? '✅ Resposta com orientação' : 'Verificar',
    });

    // 5. alertTriggered na mensagem outbound
    checks.push({
      ok: !isHighScore || (outbound?.alertTriggered === true) || hasAlertForPatient,
      note:
        outbound?.alertTriggered === true
          ? '✅ alertTriggered=true'
          : outbound?.alertTriggered === false && isHighScore
            ? '⚠️ alertTriggered=false (alerta pode estar em Alert/DecisionLog)'
            : 'N/A',
    });

    report.push(checks.map((c) => `  ${c.note}`).join('\n'));
  }

  // Resumo de decisões
  report.push('\n\n📊 Decisões do agente (AgentDecisionLog):');
  if (decisions.length === 0) {
    report.push('   Nenhuma decisão registrada.');
  } else {
    decisions.forEach((d, i) => {
      const action = (d.outputAction as { type?: string })?.type || '-';
      report.push(`   ${i + 1}. ${d.decisionType} | action: ${action}`);
    });
  }

  report.push('\n📊 Alertas (Alert):');
  if (alerts.length === 0) {
    report.push('   Nenhum alerta criado para o paciente.');
  } else {
    alerts.forEach((a, i) => {
      report.push(`   ${i + 1}. ${a.type} | ${a.severity} | ${a.message?.substring(0, 60)}...`);
    });
  }

  // Desvios
  report.push('\n\n🔴 Desvios identificados:');
  if (deviations.length === 0) {
    report.push('   Nenhum desvio crítico.');
  } else {
    deviations.forEach((d) => report.push(`   - ${d}`));
  }

  // Conclusão específica para Bia (dor 8 + inchaço)
  report.push('\n\n📌 Conclusão específica (dor 8/10 + inchaço mama):');
  const lastOutbound = [...messages].reverse().find((m) => m.direction === 'OUTBOUND');
  const agentSaidEscalate =
    lastOutbound?.content && /escalar|registrar|equipe|enfermagem/i.test(lastOutbound.content);
  const hasAlert = alerts.length > 0;

  if (agentSaidEscalate && !hasAlert) {
    report.push(
      '   ⚠️ O agente disse que iria "registrar e escalar", mas não há Alert correspondente.'
    );
    report.push('   Possíveis causas: payload de CREATE_HIGH_CRITICAL_ALERT incompleto ou não executado.');
  } else if (agentSaidEscalate && hasAlert) {
    report.push('   ✅ Agente prometeu escalar e há Alert criado.');
  } else if (!agentSaidEscalate && hasAlert) {
    report.push('   ✅ Há Alert criado.');
  } else {
    report.push('   ❌ Agente não prometeu escalar e não há Alert.');
  }

  console.log(report.join('\n'));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
