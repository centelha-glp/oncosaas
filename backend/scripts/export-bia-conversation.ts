/**
 * Script para exportar conversas da paciente Bia (ou paciente com nome contendo "Bia").
 * Executar: cd backend && npx ts-node scripts/export-bia-conversation.ts
 *
 * Saída: JSON com patient + conversations + messages, útil para análise de ações do agente.
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

async function main() {
  console.log('🔍 Buscando paciente Bia e conversas...\n');

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
    console.log('❌ Paciente Bia não encontrado no banco de dados.');
    console.log(
      '   Dica: crie um paciente com nome contendo "Bia" ou use prisma:seed.'
    );
    throw new Error('Paciente Bia não encontrado no banco de dados.');
  }

  console.log(`✅ Paciente encontrado: ${patient.name} (ID: ${patient.id})\n`);
  console.log(
    `   Câncer: ${patient.cancerType} | Estágio: ${patient.currentStage}\n`
  );

  const output = {
    patient: {
      id: patient.id,
      name: patient.name,
      cancerType: patient.cancerType,
      currentStage: patient.currentStage,
      priorityCategory: patient.priorityCategory,
    },
    conversations: patient.conversations.map((c) => ({
      id: c.id,
      status: c.status,
      handledBy: c.handledBy,
      messageCount: c.messageCount,
      lastMessageAt: c.lastMessageAt,
      agentState: (c as unknown as { agentState?: unknown }).agentState,
      messages: c.messages.map((m) => ({
        direction: m.direction,
        content: m.content,
        processedBy: m.processedBy,
        structuredData: m.structuredData,
        criticalSymptomsDetected: m.criticalSymptomsDetected,
        alertTriggered: m.alertTriggered,
        whatsappTimestamp: m.whatsappTimestamp,
      })),
    })),
  };

  console.log(JSON.stringify(output, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
