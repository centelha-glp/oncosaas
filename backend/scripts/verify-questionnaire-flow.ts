/**
 * Script de verificação do fluxo de questionários.
 * Executar: cd backend && npm run verify-questionnaire
 *
 * Valida:
 * - Protocolo clínico com checkInRules (TREATMENT→ESAS, FOLLOW_UP→PRO_CTCAE)
 * - Paciente Bia com cancerType e currentStage compatíveis
 * - Conversation com agentState (para simular continuação)
 * - QuestionnaireResponse (para validar persistência pós-conclusão)
 */

import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Verificando fluxo de questionários...\n');

  await prisma.$connect();

  const tenant = await prisma.tenant.findFirst();
  if (!tenant) {
    console.error('❌ Nenhum tenant encontrado.');
    process.exit(1);
  }

  const tenantId = tenant.id;
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Verificar protocolo clínico (breast) com checkInRules
  const protocol = await prisma.clinicalProtocol.findFirst({
    where: { tenantId, cancerType: 'breast', isActive: true },
    orderBy: { version: 'desc' },
  });

  if (!protocol) {
    errors.push('Protocolo breast não encontrado ou inativo.');
  } else {
    const checkIn = protocol.checkInRules as Record<string, any> | null;
    if (!checkIn || typeof checkIn !== 'object') {
      errors.push('Protocolo breast sem checkInRules.');
    } else {
      const treatment = checkIn['TREATMENT'];
      const followUp = checkIn['FOLLOW_UP'];
      if (!treatment?.questionnaire) {
        warnings.push('TREATMENT sem questionnaire (ESAS esperado).');
      } else {
        console.log(`✅ TREATMENT → questionnaire: ${treatment.questionnaire}`);
      }
      if (!followUp?.questionnaire) {
        warnings.push('FOLLOW_UP sem questionnaire (PRO_CTCAE esperado).');
      } else {
        console.log(`✅ FOLLOW_UP → questionnaire: ${followUp.questionnaire}`);
      }
    }
  }

  // 2. Verificar paciente (Bia ou primeiro breast+TREATMENT do seed)
  let patient = await prisma.patient.findFirst({
    where: { tenantId, name: { contains: 'Bia', mode: 'insensitive' } },
    include: {
      conversations: {
        take: 1,
        orderBy: { lastMessageAt: 'desc' },
      },
    },
  });

  if (!patient) {
    patient = await prisma.patient.findFirst({
      where: { tenantId, cancerType: 'breast', currentStage: 'TREATMENT' },
      include: {
        conversations: {
          take: 1,
          orderBy: { lastMessageAt: 'desc' },
        },
      },
    });
  }

  if (!patient) {
    warnings.push('Nenhum paciente breast+TREATMENT encontrado. Execute prisma:seed.');
  } else {
    console.log(`\n✅ Paciente: ${patient.name}`);
    console.log(`   cancerType: ${patient.cancerType}`);
    console.log(`   currentStage: ${patient.currentStage}`);

    if (!patient.cancerType || !patient.currentStage) {
      errors.push('Paciente precisa de cancerType e currentStage para trigger de questionário.');
    }

    const conv = patient.conversations[0];
    if (conv) {
      const state = conv.agentState as Record<string, unknown> | null;
      const hasActive = state?.active_questionnaire;
      const lastQ = state?.last_questionnaire_at;
      console.log(`   Conversa: ${conv.id}`);
      console.log(`   active_questionnaire: ${hasActive ? 'SIM' : 'não'}`);
      console.log(`   last_questionnaire_at: ${lastQ ?? 'nunca'}`);
    } else {
      warnings.push('Paciente sem conversas. Envie uma mensagem para criar.');
    }
  }

  // 3. Verificar QuestionnaireResponse (persistência)
  const qCount = await prisma.questionnaireResponse.count({
    where: { tenantId },
  });
  console.log(`\n   QuestionnaireResponse no tenant: ${qCount}`);

  // 4. Verificar Questionnaire templates
  const questionnaires = await prisma.questionnaire.findMany({
    where: { tenantId },
    select: { type: true, code: true },
  });
  if (questionnaires.length === 0) {
    console.log('   (Questionnaire templates são criados automaticamente em saveQuestionnaireResult)');
  } else {
    console.log(`   Questionnaires: ${questionnaires.map((q) => q.code || q.type).join(', ')}`);
  }

  console.log('\n--- Resumo ---');
  if (errors.length > 0) {
    console.error('❌ Erros:\n');
    errors.forEach((e) => console.error(`   - ${e}`));
    process.exit(1);
  }
  if (warnings.length > 0) {
    console.warn('⚠️ Avisos:\n');
    warnings.forEach((w) => console.warn(`   - ${w}`));
  }
  console.log('✅ Fluxo de questionários pronto para teste.');
  console.log('\nComo testar:');
  console.log('  - Frontend: simule mensagem como paciente Bia (ex: "oi")');
  console.log('  - Protocolo TREATMENT + ESAS deve iniciar questionário');
  console.log('  - Responda 1, 2, ... 9 para as 9 perguntas ESAS');
  console.log('  - Ao concluir: QuestionnaireResponse é criado + last_questionnaire_at atualizado');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
