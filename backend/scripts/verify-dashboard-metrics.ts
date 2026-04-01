/**
 * Script de verificação das métricas do dashboard.
 * Executar após prisma:seed: npx ts-node scripts/verify-dashboard-metrics.ts
 *
 * Valida que nenhuma métrica retorna valores inválidos (NaN, negativos,
 * percentuais > 100) e que statusDistribution soma ~100%.
 */

import { PrismaClient } from '@generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { DashboardService } from '../src/dashboard/dashboard.service';
import { PrismaService } from '../src/prisma/prisma.service';

dotenv.config({ path: resolve(__dirname, '../.env') });

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

function isInvalidNumber(value: unknown): boolean {
  if (value === null || value === undefined) {return false;}
  if (typeof value !== 'number') {return false;}
  return Number.isNaN(value) || value < 0 || !Number.isFinite(value);
}

function checkPercentage(value: unknown): boolean {
  if (value === null || value === undefined) {return true;}
  if (typeof value !== 'number') {return true;}
  return value >= 0 && value <= 100;
}

async function main() {
  console.log('🔍 Verificando métricas do dashboard...\n');

  await prisma.$connect();

  const prismaService = prisma as unknown as PrismaService;
  const dashboardService = new DashboardService(prismaService);

  const tenant = await prisma.tenant.findFirst();
  if (!tenant) {
    throw new Error('Nenhum tenant encontrado. Execute prisma:seed primeiro.');
  }

  const tenantId = tenant.id;
  const errors: string[] = [];

  try {
    const metrics = await dashboardService.getMetrics(tenantId);

    if (isInvalidNumber(metrics.totalActivePatients)) {
      errors.push(`totalActivePatients inválido: ${metrics.totalActivePatients}`);
    }
    if (isInvalidNumber(metrics.criticalPatientsCount)) {
      errors.push(`criticalPatientsCount inválido: ${metrics.criticalPatientsCount}`);
    }
    if (isInvalidNumber(metrics.totalPendingAlerts)) {
      errors.push(`totalPendingAlerts inválido: ${metrics.totalPendingAlerts}`);
    }
    if (isInvalidNumber(metrics.unassumedMessagesCount)) {
      errors.push(`unassumedMessagesCount inválido: ${metrics.unassumedMessagesCount}`);
    }
    if (isInvalidNumber(metrics.resolvedTodayCount)) {
      errors.push(`resolvedTodayCount inválido: ${metrics.resolvedTodayCount}`);
    }
    if (
      metrics.averageResponseTimeMinutes !== null &&
      isInvalidNumber(metrics.averageResponseTimeMinutes)
    ) {
      errors.push(
        `averageResponseTimeMinutes inválido: ${metrics.averageResponseTimeMinutes}`
      );
    }
    if (isInvalidNumber(metrics.overdueStepsCount)) {
      errors.push(`overdueStepsCount inválido: ${metrics.overdueStepsCount}`);
    }
    if (
      metrics.averageTimeToTreatmentDays !== null &&
      isInvalidNumber(metrics.averageTimeToTreatmentDays)
    ) {
      errors.push(
        `averageTimeToTreatmentDays inválido: ${metrics.averageTimeToTreatmentDays}`
      );
    }
    if (
      metrics.averageTimeToDiagnosisDays !== null &&
      isInvalidNumber(metrics.averageTimeToDiagnosisDays)
    ) {
      errors.push(
        `averageTimeToDiagnosisDays inválido: ${metrics.averageTimeToDiagnosisDays}`
      );
    }
    if (isInvalidNumber(metrics.stagingCompletePercentage)) {
      errors.push(
        `stagingCompletePercentage inválido: ${metrics.stagingCompletePercentage}`
      );
    }
    if (isInvalidNumber(metrics.pendingBiomarkersCount)) {
      errors.push(
        `pendingBiomarkersCount inválido: ${metrics.pendingBiomarkersCount}`
      );
    }
    if (isInvalidNumber(metrics.treatmentAdherencePercentage)) {
      errors.push(
        `treatmentAdherencePercentage inválido: ${metrics.treatmentAdherencePercentage}`
      );
    }

    const statusSum = metrics.statusDistribution.reduce(
      (sum, s) => sum + s.percentage,
      0
    );
    if (metrics.statusDistribution.length > 0) {
      if (statusSum < 99.5 || statusSum > 100.5) {
        errors.push(
          `statusDistribution: soma de percentage = ${statusSum.toFixed(2)} (deve estar entre 99.5 e 100.5)`
        );
      }
    }

    for (const item of metrics.cancerTypeDistribution) {
      if (!checkPercentage(item.percentage)) {
        errors.push(
          `cancerTypeDistribution[${item.cancerType}]: percentage ${item.percentage} inválido`
        );
      }
    }

    for (const item of metrics.journeyStageDistribution) {
      if (!checkPercentage(item.percentage)) {
        errors.push(
          `journeyStageDistribution[${item.stage}]: percentage ${item.percentage} inválido`
        );
      }
    }

    await dashboardService.getStatistics(tenantId, '7d');
  } catch (err) {
    errors.push(
      `Erro ao executar verificação: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  if (errors.length > 0) {
    throw new Error(`Verificação falhou:\n- ${errors.join('\n- ')}`);
  }

  console.log('✅ Todas as métricas passaram na verificação.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
