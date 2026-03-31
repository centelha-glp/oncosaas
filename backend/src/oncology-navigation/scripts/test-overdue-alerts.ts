/**
 * Script de teste para verificar e criar alertas de etapas atrasadas
 * Execute: npx ts-node src/oncology-navigation/scripts/test-overdue-alerts.ts
 */

import { PrismaClient } from '@generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

async function testOverdueAlerts() {
  console.log('🔍 Verificando etapas atrasadas...\n');

  const now = new Date();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Buscar todas as etapas com dueDate no passado
  const overdueSteps = await prisma.navigationStep.findMany({
    where: {
      status: {
        in: ['PENDING', 'IN_PROGRESS'],
      },
      isCompleted: false,
      dueDate: {
        lt: now,
      },
    },
    include: {
      patient: {
        select: {
          id: true,
          name: true,
          cancerType: true,
        },
      },
    },
    take: 20, // Limitar a 20 para teste
  });

  console.log(`📊 Encontradas ${overdueSteps.length} etapas atrasadas\n`);

  if (overdueSteps.length === 0) {
    console.log('✅ Nenhuma etapa atrasada encontrada!');
    console.log(
      '\n💡 Dica: Crie etapas com dueDate no passado para testar os alertas.'
    );
    return;
  }

  // Mostrar detalhes das etapas atrasadas
  for (const step of overdueSteps) {
    const daysOverdue = Math.floor(
      (today.getTime() - new Date(step.dueDate).setHours(0, 0, 0, 0)) /
        (1000 * 60 * 60 * 24)
    );

    console.log(`📋 Etapa: ${step.stepName}`);
    console.log(
      `   Paciente: ${step.patient.name} (${step.patient.cancerType})`
    );
    console.log(`   Prazo: ${step.dueDate?.toLocaleDateString('pt-BR')}`);
    console.log(`   Atraso: ${daysOverdue} dias`);
    console.log(`   Status: ${step.status}`);
    console.log('');

    // Verificar se já existe alerta
    const existingAlerts = await prisma.alert.findMany({
      where: {
        tenantId: step.tenantId,
        patientId: step.patientId,
        type: 'NAVIGATION_DELAY',
        status: {
          in: ['PENDING', 'ACKNOWLEDGED'],
        },
      },
      select: {
        id: true,
        context: true,
        message: true,
      },
    });

    const hasAlert = existingAlerts.some((alert) => {
      if (!alert.context || typeof alert.context !== 'object') {
        return false;
      }
      const context = alert.context as { stepId?: string };
      return context.stepId === step.id;
    });

    if (hasAlert) {
      console.log(`   ✅ Alerta já existe`);
    } else {
      console.log(
        `   ⚠️  Alerta NÃO existe - será criado ao executar checkOverdueSteps`
      );
    }
    console.log('');
  }

  // Verificar alertas existentes
  const allAlerts = await prisma.alert.findMany({
    where: {
      type: 'NAVIGATION_DELAY',
      status: {
        in: ['PENDING', 'ACKNOWLEDGED'],
      },
    },
    select: {
      id: true,
      message: true,
      patient: {
        select: {
          name: true,
        },
      },
      context: true,
    },
    take: 10,
  });

  console.log(
    `\n📢 Alertas de NAVIGATION_DELAY existentes: ${allAlerts.length}\n`
  );

  if (allAlerts.length > 0) {
    for (const alert of allAlerts) {
      console.log(`   • ${alert.message}`);
      console.log(`     Paciente: ${alert.patient.name}`);
      if (alert.context && typeof alert.context === 'object') {
        const context = alert.context as {
          stepId?: string;
          daysOverdue?: number;
        };
        console.log(`     StepId: ${context.stepId}`);
        console.log(`     Dias de atraso: ${context.daysOverdue}`);
      }
      console.log('');
    }
  }

}

testOverdueAlerts().catch((error) => {
  console.error('❌ Erro:', error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
