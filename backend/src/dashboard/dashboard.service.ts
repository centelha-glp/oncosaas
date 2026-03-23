import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardMetricsDto } from './dto/dashboard-metrics.dto';
import {
  DashboardStatisticsDto,
  AlertStatisticsPoint,
} from './dto/dashboard-statistics.dto';
import {
  NavigationMetricsDto,
  StageMetrics,
  Bottleneck,
} from './dto/navigation-metrics.dto';
import { PatientWithCriticalStepDto } from './dto/patients-with-critical-steps.dto';
import {
  CriticalTimelinesDto,
  CriticalTimelineMetric,
  CriticalTimelineBenchmark,
} from './dto/critical-timelines.dto';
import {
  PriorityCategory,
  PatientStatus,
  JourneyStage,
  AlertSeverity,
  AlertStatus,
} from '@prisma/client';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getMetrics(tenantId: string): Promise<DashboardMetricsDto> {
    // Total de pacientes ativos
    const totalActivePatients = await this.prisma.patient.count({
      where: {
        tenantId,
        status: {
          in: ['ACTIVE', 'IN_TREATMENT', 'FOLLOW_UP'],
        },
      },
    });

    // Pacientes críticos (priorityCategory = CRITICAL)
    const criticalPatientsCount = await this.prisma.patient.count({
      where: {
        tenantId,
        priorityCategory: 'CRITICAL',
        status: {
          in: ['ACTIVE', 'IN_TREATMENT', 'FOLLOW_UP'],
        },
      },
    });

    // Alertas pendentes por severidade
    const alertsBySeverity = await this.prisma.alert.groupBy({
      by: ['severity'],
      where: {
        tenantId,
        status: {
          not: 'RESOLVED',
        },
      },
      _count: true,
    });

    const criticalAlertsCount =
      alertsBySeverity.find((a) => a.severity === 'CRITICAL')?._count || 0;
    const highAlertsCount =
      alertsBySeverity.find((a) => a.severity === 'HIGH')?._count || 0;
    const mediumAlertsCount =
      alertsBySeverity.find((a) => a.severity === 'MEDIUM')?._count || 0;
    const lowAlertsCount =
      alertsBySeverity.find((a) => a.severity === 'LOW')?._count || 0;
    const totalPendingAlerts =
      criticalAlertsCount +
      highAlertsCount +
      mediumAlertsCount +
      lowAlertsCount;

    // Mensagens não assumidas
    const unassumedMessagesCount = await this.prisma.message.count({
      where: {
        tenantId,
        direction: 'INBOUND',
        assumedBy: null,
      },
    });

    // Alertas resolvidos hoje
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const resolvedTodayCount = await this.prisma.alert.count({
      where: {
        tenantId,
        status: 'RESOLVED',
        resolvedAt: {
          gte: todayStart,
        },
      },
    });

    // Tempo médio de resposta a alertas (em minutos) — últimos 90 dias
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const resolvedAlerts = await this.prisma.alert.findMany({
      where: {
        tenantId,
        status: 'RESOLVED',
        resolvedAt: { not: null },
        createdAt: { gte: ninetyDaysAgo },
      },
      select: {
        createdAt: true,
        resolvedAt: true,
      },
    });

    let averageResponseTimeMinutes: number | null = null;
    if (resolvedAlerts.length > 0) {
      const totalMinutes = resolvedAlerts.reduce((sum, alert) => {
        if (alert.createdAt && alert.resolvedAt) {
          const diffMs =
            new Date(alert.resolvedAt).getTime() -
            new Date(alert.createdAt).getTime();
          return sum + Math.round(diffMs / (1000 * 60)); // Converter para minutos
        }
        return sum;
      }, 0);
      averageResponseTimeMinutes = Math.round(
        totalMinutes / resolvedAlerts.length
      );
    }

    // Distribuição por prioridade
    const priorityDistribution = await this.prisma.patient.groupBy({
      by: ['priorityCategory'],
      where: {
        tenantId,
        status: {
          in: ['ACTIVE', 'IN_TREATMENT', 'FOLLOW_UP'],
        },
      },
      _count: true,
    });

    const priorityDist = {
      critical:
        priorityDistribution.find((p) => p.priorityCategory === 'CRITICAL')
          ?._count || 0,
      high:
        priorityDistribution.find((p) => p.priorityCategory === 'HIGH')
          ?._count || 0,
      medium:
        priorityDistribution.find((p) => p.priorityCategory === 'MEDIUM')
          ?._count || 0,
      low:
        priorityDistribution.find((p) => p.priorityCategory === 'LOW')
          ?._count || 0,
    };

    // Distribuição por tipo de câncer
    const cancerTypeDistribution = await this.prisma.patient.groupBy({
      by: ['cancerType'],
      where: {
        tenantId,
        cancerType: { not: null },
        status: {
          in: ['ACTIVE', 'IN_TREATMENT', 'FOLLOW_UP'],
        },
      },
      _count: true,
    });

    const cancerTypeDist = cancerTypeDistribution
      .map((item) => ({
        cancerType: item.cancerType || 'Não informado',
        count: item._count,
        percentage:
          totalActivePatients > 0
            ? Math.round((item._count / totalActivePatients) * 100 * 10) / 10
            : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10

    // Distribuição por Jornada
    const journeyStageDistribution = await this.prisma.patient.groupBy({
      by: ['currentStage'],
      where: {
        tenantId,
        status: {
          in: ['ACTIVE', 'IN_TREATMENT', 'FOLLOW_UP'],
        },
      },
      _count: true,
    });

    const journeyDist = journeyStageDistribution.map((item) => ({
      stage: item.currentStage,
      count: item._count,
      percentage:
        totalActivePatients > 0
          ? Math.round((item._count / totalActivePatients) * 100 * 10) / 10
          : 0,
    }));

    // Distribuição por status
    const statusDistribution = await this.prisma.patient.groupBy({
      by: ['status'],
      where: {
        tenantId,
      },
      _count: true,
    });

    const totalPatients = statusDistribution.reduce(
      (sum, i) => sum + i._count,
      0
    );
    const statusDist = statusDistribution.map((item) => ({
      status: item.status,
      count: item._count,
      percentage:
        totalPatients > 0
          ? Math.round((item._count / totalPatients) * 100 * 10) / 10
          : 0,
    }));

    // Contar etapas de navegação atrasadas (OVERDUE ou com dueDate vencido)
    const now = new Date();
    const overdueStepsCount = await this.prisma.navigationStep.count({
      where: {
        tenantId,
        isCompleted: false,
        OR: [
          { status: 'OVERDUE' },
          {
            status: { in: ['PENDING', 'IN_PROGRESS'] },
            dueDate: { lt: now },
          },
        ],
      },
    });

    // ========== MÉTRICAS CLÍNICAS CRÍTICAS ==========

    // 1. Time-to-Treatment: Tempo médio desde diagnóstico confirmado até início de tratamento
    const patientsWithTreatment = await this.prisma.patientJourney.findMany({
      where: {
        tenantId,
        diagnosisConfirmed: true,
        diagnosisDate: { not: null },
        treatmentStartDate: { not: null },
      },
      select: {
        diagnosisDate: true,
        treatmentStartDate: true,
      },
    });

    let averageTimeToTreatmentDays: number | null = null;
    if (patientsWithTreatment.length > 0) {
      const totalDays = patientsWithTreatment.reduce((sum, journey) => {
        if (journey.diagnosisDate && journey.treatmentStartDate) {
          const diffMs =
            new Date(journey.treatmentStartDate).getTime() -
            new Date(journey.diagnosisDate).getTime();
          return sum + Math.floor(diffMs / (1000 * 60 * 60 * 24));
        }
        return sum;
      }, 0);
      averageTimeToTreatmentDays = Math.round(
        totalDays / patientsWithTreatment.length
      );
    }

    // 2. Time-to-Diagnosis: Tempo médio desde primeira etapa DIAGNOSIS até diagnóstico confirmado
    // Buscar pacientes com diagnóstico confirmado e primeira etapa DIAGNOSIS
    const patientsWithDiagnosis = await this.prisma.patient.findMany({
      where: {
        tenantId,
        journey: {
          diagnosisConfirmed: true,
          diagnosisDate: { not: null },
        },
      },
      include: {
        navigationSteps: {
          where: {
            journeyStage: 'DIAGNOSIS',
          },
          orderBy: {
            createdAt: 'asc',
          },
          take: 1,
        },
        journey: {
          select: {
            diagnosisDate: true,
          },
        },
      },
    });

    let averageTimeToDiagnosisDays: number | null = null;
    const validDiagnosisTimes = patientsWithDiagnosis
      .filter((p) => p.journey?.diagnosisDate && p.navigationSteps.length > 0)
      .map((p) => {
        const firstDiagnosisStep = p.navigationSteps[0];
        const diagnosisDate = p.journey.diagnosisDate;
        const diffMs =
          new Date(diagnosisDate).getTime() -
          new Date(firstDiagnosisStep.createdAt).getTime();
        return Math.floor(diffMs / (1000 * 60 * 60 * 24));
      })
      .filter((days) => days >= 0); // Apenas valores válidos

    if (validDiagnosisTimes.length > 0) {
      const totalDays = validDiagnosisTimes.reduce(
        (sum, days) => sum + days,
        0
      );
      averageTimeToDiagnosisDays = Math.round(
        totalDays / validDiagnosisTimes.length
      );
    }

    // 3. Estadiamento Completo: % de pacientes com estadiamento completo antes de tratamento
    const patientsWithStaging = await this.prisma.patientJourney.findMany({
      where: {
        tenantId,
        treatmentStartDate: { not: null },
      },
      select: {
        stagingDate: true,
        treatmentStartDate: true,
      },
    });

    const patientsWithCompleteStaging = patientsWithStaging.filter(
      (journey) =>
        journey.stagingDate &&
        journey.treatmentStartDate &&
        new Date(journey.stagingDate) <= new Date(journey.treatmentStartDate)
    ).length;

    const stagingCompletePercentage =
      patientsWithStaging.length > 0
        ? Math.round(
            (patientsWithCompleteStaging / patientsWithStaging.length) * 100
          )
        : 0;

    // 4. Biomarcadores Pendentes: Pacientes aguardando resultados de biomarcadores críticos
    // Biomarcadores críticos: HER2, EGFR, PD-L1, MSI-H, KRAS, BRAF, ALK
    const biomarkerStepKeys = [
      'her2_test',
      'egfr_test',
      'pdl1_test',
      'msi_test',
      'kras_test',
      'braf_test',
      'alk_test',
      'biomarker_her2',
      'biomarker_egfr',
      'biomarker_pdl1',
      'biomarker_msi',
      'biomarker_kras',
      'biomarker_braf',
      'biomarker_alk',
    ];

    const pendingBiomarkerSteps = await this.prisma.navigationStep.findMany({
      where: {
        tenantId,
        stepKey: {
          in: biomarkerStepKeys,
        },
        isCompleted: false,
        status: {
          in: ['PENDING', 'IN_PROGRESS', 'OVERDUE'],
        },
      },
      select: {
        patientId: true,
      },
      distinct: ['patientId'],
    });

    const pendingBiomarkersCount = pendingBiomarkerSteps.length;

    // 5. Taxa de Adesão ao Tratamento: % de pacientes que completam ciclos conforme planejado.
    // Considera apenas pacientes que já atingiram 80% dos ciclos (avaliamos aderência);
    // pacientes no início (ex: ciclo 1/12) não entram no denominador.
    const patientsInTreatment = await this.prisma.patientJourney.findMany({
      where: {
        tenantId,
        treatmentStartDate: { not: null },
        totalCycles: { not: null },
        currentCycle: { not: null },
      },
      select: {
        currentCycle: true,
        totalCycles: true,
      },
    });

    const eligibleForAdherence = patientsInTreatment.filter(
      (journey) =>
        journey.currentCycle &&
        journey.totalCycles &&
        journey.currentCycle >= Math.floor(journey.totalCycles * 0.8)
    );

    const patientsOnTrack = eligibleForAdherence.filter(
      (journey) =>
        journey.currentCycle &&
        journey.totalCycles &&
        journey.currentCycle >= journey.totalCycles
    ).length;

    const treatmentAdherencePercentage =
      eligibleForAdherence.length > 0
        ? Math.round(
            (patientsOnTrack / eligibleForAdherence.length) * 100
          )
        : 0;

    return {
      totalActivePatients,
      criticalPatientsCount,
      totalPendingAlerts,
      criticalAlertsCount,
      highAlertsCount,
      mediumAlertsCount,
      lowAlertsCount,
      unassumedMessagesCount,
      resolvedTodayCount,
      averageResponseTimeMinutes,
      overdueStepsCount,
      // Métricas Clínicas Críticas
      averageTimeToTreatmentDays,
      averageTimeToDiagnosisDays,
      stagingCompletePercentage,
      pendingBiomarkersCount,
      treatmentAdherencePercentage,
      priorityDistribution: priorityDist,
      cancerTypeDistribution: cancerTypeDist,
      journeyStageDistribution: journeyDist,
      statusDistribution: statusDist,
    };
  }

  async getStatistics(
    tenantId: string,
    period: '7d' | '30d' | '90d' = '7d'
  ): Promise<DashboardStatisticsDto> {
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // Estatísticas de alertas por dia
    const alerts = await this.prisma.alert.findMany({
      where: {
        tenantId,
        createdAt: { gte: startDate },
      },
      select: {
        createdAt: true,
        severity: true,
      },
    });

    // Agrupar por data e severidade
    const alertsByDate = new Map<
      string,
      { critical: number; high: number; medium: number; low: number }
    >();

    alerts.forEach((alert) => {
      const dateKey = new Date(alert.createdAt).toISOString().split('T')[0];
      if (!alertsByDate.has(dateKey)) {
        alertsByDate.set(dateKey, { critical: 0, high: 0, medium: 0, low: 0 });
      }
      const dayData = alertsByDate.get(dateKey);
      if (alert.severity === 'CRITICAL') {
        dayData.critical++;
      } else if (alert.severity === 'HIGH') {
        dayData.high++;
      } else if (alert.severity === 'MEDIUM') {
        dayData.medium++;
      } else if (alert.severity === 'LOW') {
        dayData.low++;
      }
    });

    // Preencher dias sem dados com zeros
    const alertStatistics: AlertStatisticsPoint[] = [];
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateKey = date.toISOString().split('T')[0];
      const dayData = alertsByDate.get(dateKey) || {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
      };
      alertStatistics.push({
        date: dateKey,
        ...dayData,
        total: dayData.critical + dayData.high + dayData.medium + dayData.low,
      });
    }

    // Estatísticas de pacientes por dia
    const patients = await this.prisma.patient.findMany({
      where: {
        tenantId,
        createdAt: { gte: startDate },
      },
      select: {
        createdAt: true,
        priorityScore: true,
        status: true,
      },
    });

    const patientsByDate = new Map<
      string,
      { active: number; critical: number; new: number }
    >();

    // Para cada dia, contar pacientes ativos e críticos naquele momento
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      date.setHours(23, 59, 59, 999);
      const dateKey = date.toISOString().split('T')[0];

      const activeOnDate = patients.filter(
        (p) =>
          new Date(p.createdAt) <= date &&
          ['ACTIVE', 'IN_TREATMENT', 'FOLLOW_UP'].includes(p.status)
      );

      const criticalOnDate = activeOnDate.filter(
        (p) => (p.priorityScore || 0) >= 75
      );
      const newOnDate = patients.filter((p) => {
        const pDate = new Date(p.createdAt).toISOString().split('T')[0];
        return pDate === dateKey;
      });

      patientsByDate.set(dateKey, {
        active: activeOnDate.length,
        critical: criticalOnDate.length,
        new: newOnDate.length,
      });
    }

    const patientStatistics = Array.from(patientsByDate.entries()).map(
      ([date, data]) => ({
        date,
        ...data,
      })
    );

    // Estatísticas de tempo de resposta
    const resolvedAlerts = await this.prisma.alert.findMany({
      where: {
        tenantId,
        status: 'RESOLVED',
        resolvedAt: { not: null },
        createdAt: { gte: startDate },
      },
      select: {
        createdAt: true,
        resolvedAt: true,
      },
    });

    const responseTimeByDate = new Map<string, number[]>();

    resolvedAlerts.forEach((alert) => {
      if (alert.createdAt && alert.resolvedAt) {
        const dateKey = new Date(alert.resolvedAt).toISOString().split('T')[0];
        const diffMs =
          new Date(alert.resolvedAt).getTime() -
          new Date(alert.createdAt).getTime();
        const minutes = Math.round(diffMs / (1000 * 60));

        if (!responseTimeByDate.has(dateKey)) {
          responseTimeByDate.set(dateKey, []);
        }
        responseTimeByDate.get(dateKey).push(minutes);
      }
    });

    const responseTimeStatistics = Array.from(responseTimeByDate.entries()).map(
      ([date, times]) => ({
        date,
        averageMinutes: Math.round(
          times.reduce((sum, t) => sum + t, 0) / times.length
        ),
      })
    );

    // Preencher dias sem dados
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateKey = date.toISOString().split('T')[0];
      if (!responseTimeStatistics.find((r) => r.date === dateKey)) {
        responseTimeStatistics.push({
          date: dateKey,
          averageMinutes: 0,
        });
      }
    }

    responseTimeStatistics.sort((a, b) => a.date.localeCompare(b.date));

    return {
      period,
      alertStatistics,
      patientStatistics,
      responseTimeStatistics,
    };
  }

  async getNurseMetrics(tenantId: string, userId: string) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Alertas resolvidos hoje pelo enfermeiro
    const alertsResolvedToday = await this.prisma.alert.count({
      where: {
        tenantId,
        status: 'RESOLVED',
        resolvedBy: userId,
        resolvedAt: {
          gte: todayStart,
        },
      },
    });

    // Tempo médio de resposta do enfermeiro (em minutos) — últimos 90 dias
    const ninetyDaysAgoNurse = new Date();
    ninetyDaysAgoNurse.setDate(ninetyDaysAgoNurse.getDate() - 90);
    const resolvedAlerts = await this.prisma.alert.findMany({
      where: {
        tenantId,
        status: 'RESOLVED',
        resolvedBy: userId,
        resolvedAt: { not: null },
        createdAt: { gte: ninetyDaysAgoNurse },
      },
      select: {
        createdAt: true,
        resolvedAt: true,
      },
    });

    let averageResponseTimeMinutes: number | null = null;
    if (resolvedAlerts.length > 0) {
      const totalMinutes = resolvedAlerts.reduce((sum, alert) => {
        if (alert.createdAt && alert.resolvedAt) {
          const diffMs =
            new Date(alert.resolvedAt).getTime() -
            new Date(alert.createdAt).getTime();
          return sum + Math.round(diffMs / (1000 * 60));
        }
        return sum;
      }, 0);
      averageResponseTimeMinutes = Math.round(
        totalMinutes / resolvedAlerts.length
      );
    }

    // Pacientes atendidos hoje (com intervenções do enfermeiro)
    // Usar groupBy para contar pacientes únicos
    const uniquePatients = await this.prisma.intervention.groupBy({
      by: ['patientId'],
      where: {
        tenantId,
        userId,
        createdAt: {
          gte: todayStart,
        },
      },
    });
    const patientsAttendedToday = uniquePatients.length;

    // Taxa de resposta ao agente (últimos 30 dias)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    // Total de mensagens recebidas do paciente (INBOUND) nos últimos 30 dias
    const totalInboundMessages = await this.prisma.message.count({
      where: {
        tenantId,
        direction: 'INBOUND',
        createdAt: {
          gte: thirtyDaysAgo,
        },
      },
    });

    // Total de mensagens respondidas pelo enfermeiro (OUTBOUND assumidas) nos últimos 30 dias
    const respondedMessages = await this.prisma.message.count({
      where: {
        tenantId,
        direction: 'OUTBOUND',
        processedBy: 'NURSING',
        assumedBy: userId,
        createdAt: {
          gte: thirtyDaysAgo,
        },
      },
    });

    const agentResponseRate =
      totalInboundMessages > 0
        ? Math.round((respondedMessages / totalInboundMessages) * 100)
        : 0;

    // Sintomas mais reportados (últimos 30 dias)
    const messagesWithSymptoms = await this.prisma.message.findMany({
      where: {
        tenantId,
        direction: 'INBOUND',
        createdAt: {
          gte: thirtyDaysAgo,
        },
        criticalSymptomsDetected: {
          isEmpty: false,
        },
      },
      select: {
        criticalSymptomsDetected: true,
      },
    });

    // Contar sintomas
    const symptomCounts = new Map<string, number>();
    messagesWithSymptoms.forEach((message) => {
      message.criticalSymptomsDetected.forEach((symptom) => {
        symptomCounts.set(symptom, (symptomCounts.get(symptom) || 0) + 1);
      });
    });

    // Converter para array e ordenar
    const topReportedSymptoms = Array.from(symptomCounts.entries())
      .map(([symptom, count]) => ({
        symptom,
        count,
        percentage:
          totalInboundMessages > 0
            ? Math.round((count / totalInboundMessages) * 100 * 10) / 10
            : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5); // Top 5

    return {
      alertsResolvedToday,
      averageResponseTimeMinutes,
      patientsAttendedToday,
      agentResponseRate,
      topReportedSymptoms,
    };
  }

  /**
   * Calcula métricas de navegação oncológica para o dashboard da nurse
   */
  async getNavigationMetrics(tenantId: string): Promise<NavigationMetricsDto> {
    const now = new Date();
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    // Etapas atrasadas (OVERDUE ou dueDate no passado)
    const overdueSteps = await this.prisma.navigationStep.findMany({
      where: {
        tenantId,
        status: {
          in: ['OVERDUE', 'PENDING', 'IN_PROGRESS'],
        },
        isCompleted: false,
        OR: [
          { status: 'OVERDUE' },
          {
            dueDate: {
              lt: now,
            },
          },
        ],
      },
    });

    const overdueStepsCount = overdueSteps.length;

    // Etapas críticas atrasadas (obrigatórias + >14 dias)
    const criticalOverdueSteps = overdueSteps.filter((step) => {
      if (!step.isRequired || !step.dueDate) {
        return false;
      }
      const daysOverdue = Math.floor(
        (now.getTime() - new Date(step.dueDate).getTime()) /
          (1000 * 60 * 60 * 24)
      );
      return daysOverdue > 14;
    });
    const criticalOverdueStepsCount = criticalOverdueSteps.length;

    // Pacientes por fase da jornada
    const patientsByStage = await this.prisma.patient.groupBy({
      by: ['currentStage'],
      where: {
        tenantId,
        status: {
          in: ['ACTIVE', 'IN_TREATMENT', 'FOLLOW_UP'],
        },
      },
      _count: true,
    });

    const stageCounts = {
      SCREENING: 0,
      DIAGNOSIS: 0,
      TREATMENT: 0,
      FOLLOW_UP: 0,
      PALLIATIVE: 0,
    };

    patientsByStage.forEach((item) => {
      if (item.currentStage in stageCounts) {
        stageCounts[item.currentStage as keyof typeof stageCounts] =
          item._count;
      }
    });

    // Etapas próximas do prazo (próximas 7 dias)
    const stepsDueSoon = await this.prisma.navigationStep.count({
      where: {
        tenantId,
        status: {
          in: ['PENDING', 'IN_PROGRESS'],
        },
        isCompleted: false,
        dueDate: {
          gte: now,
          lte: sevenDaysFromNow,
        },
      },
    });

    // Taxa de conclusão geral de etapas
    const allSteps = await this.prisma.navigationStep.findMany({
      where: {
        tenantId,
      },
      select: {
        isCompleted: true,
      },
    });

    const totalSteps = allSteps.length;
    const completedSteps = allSteps.filter((s) => s.isCompleted).length;
    const overallCompletionRate =
      totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

    // ========== MÉTRICAS AVANÇADAS DE NAVEGAÇÃO ==========

    const stageLabels: Record<string, string> = {
      SCREENING: 'Rastreio',
      DIAGNOSIS: 'Diagnóstico',
      TREATMENT: 'Tratamento',
      FOLLOW_UP: 'Seguimento',
      PALLIATIVE: 'Paliativo',
    };

    const totalActivePatients = Object.values(stageCounts).reduce(
      (sum, count) => sum + count,
      0
    );

    // Calcular métricas detalhadas por fase
    const stageMetrics: StageMetrics[] = [];
    const averageTimePerStage: Record<string, number | null> = {
      SCREENING: null,
      DIAGNOSIS: null,
      TREATMENT: null,
      FOLLOW_UP: null,
      PALLIATIVE: null,
    };

    for (const stage of Object.keys(stageCounts) as JourneyStage[]) {
      // Buscar etapas desta fase
      const stageSteps = await this.prisma.navigationStep.findMany({
        where: {
          tenantId,
          journeyStage: stage,
        },
        select: {
          isCompleted: true,
          status: true,
          createdAt: true,
          completedAt: true,
          dueDate: true,
        },
      });

      const totalStageSteps = stageSteps.length;
      const completedStageSteps = stageSteps.filter(
        (s) => s.isCompleted
      ).length;
      const pendingStageSteps = stageSteps.filter(
        (s) => !s.isCompleted && s.status !== 'OVERDUE'
      ).length;
      const overdueStageSteps = stageSteps.filter(
        (s) => s.status === 'OVERDUE'
      ).length;

      const completionRate =
        totalStageSteps > 0
          ? Math.round((completedStageSteps / totalStageSteps) * 100)
          : 0;

      // Calcular tempo médio nesta fase
      // Tempo médio = média do tempo entre criação da primeira etapa e conclusão da última etapa da fase
      const patientsInStage = await this.prisma.patient.findMany({
        where: {
          tenantId,
          currentStage: stage,
          status: {
            in: ['ACTIVE', 'IN_TREATMENT', 'FOLLOW_UP'],
          },
        },
        include: {
          navigationSteps: {
            where: {
              journeyStage: stage,
            },
            orderBy: {
              createdAt: 'asc',
            },
          },
        },
      });

      let averageTimeDays: number | null = null;
      const validTimes: number[] = [];

      for (const patient of patientsInStage) {
        if (patient.navigationSteps.length === 0) {
          continue;
        }

        const firstStep = patient.navigationSteps[0];
        const lastCompletedStep = patient.navigationSteps
          .filter((s) => s.isCompleted && s.completedAt)
          .sort(
            (a, b) =>
              new Date(b.completedAt).getTime() -
              new Date(a.completedAt).getTime()
          )[0];

        if (lastCompletedStep && lastCompletedStep.completedAt) {
          const diffMs =
            new Date(lastCompletedStep.completedAt).getTime() -
            new Date(firstStep.createdAt).getTime();
          const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
          if (days >= 0) {
            validTimes.push(days);
          }
        }
      }

      if (validTimes.length > 0) {
        averageTimeDays = Math.round(
          validTimes.reduce((sum, days) => sum + days, 0) / validTimes.length
        );
      }

      averageTimePerStage[stage] = averageTimeDays;

      stageMetrics.push({
        stage,
        patientsCount: stageCounts[stage],
        completionRate,
        averageTimeDays,
        totalSteps: totalStageSteps,
        completedSteps: completedStageSteps,
        pendingSteps: pendingStageSteps,
        overdueSteps: overdueStageSteps,
      });
    }

    // Identificar bottlenecks
    // Bottleneck = fase com >20% dos pacientes OU tempo médio >50% acima do esperado
    const expectedTimes: Record<string, number> = {
      SCREENING: 30,
      DIAGNOSIS: 45,
      TREATMENT: 180,
      FOLLOW_UP: 90,
      PALLIATIVE: 365,
    };

    const bottlenecks: Bottleneck[] = [];

    for (const metric of stageMetrics) {
      const percentage =
        totalActivePatients > 0
          ? Math.round((metric.patientsCount / totalActivePatients) * 100)
          : 0;

      let reason = '';
      const expectedTime = expectedTimes[metric.stage] || 0;

      if (percentage > 20) {
        reason = `Alta concentração de pacientes (${percentage}% do total)`;
      } else if (
        metric.averageTimeDays !== null &&
        expectedTime > 0 &&
        metric.averageTimeDays > expectedTime * 1.5
      ) {
        reason = `Tempo médio acima do esperado (${metric.averageTimeDays} dias vs ${expectedTime} dias esperados)`;
      } else if (metric.overdueSteps > metric.completedSteps) {
        reason = `Muitas etapas atrasadas (${metric.overdueSteps} atrasadas vs ${metric.completedSteps} concluídas)`;
      }

      if (reason) {
        bottlenecks.push({
          stage: metric.stage,
          stageLabel: stageLabels[metric.stage] || metric.stage,
          patientsCount: metric.patientsCount,
          percentage,
          averageTimeDays: metric.averageTimeDays,
          reason,
        });
      }
    }

    // Ordenar bottlenecks por severidade (maior porcentagem primeiro)
    bottlenecks.sort((a, b) => b.percentage - a.percentage);

    return {
      overdueStepsCount,
      criticalOverdueStepsCount,
      patientsByStage: stageCounts,
      stepsDueSoonCount: stepsDueSoon,
      overallCompletionRate,
      // Métricas Avançadas
      stageMetrics,
      bottlenecks: bottlenecks.slice(0, 3), // Top 3 bottlenecks
      averageTimePerStage: {
        SCREENING: averageTimePerStage.SCREENING,
        DIAGNOSIS: averageTimePerStage.DIAGNOSIS,
        TREATMENT: averageTimePerStage.TREATMENT,
        FOLLOW_UP: averageTimePerStage.FOLLOW_UP,
        PALLIATIVE: averageTimePerStage.PALLIATIVE,
      },
    };
  }

  /**
   * Lista pacientes com etapas críticas, priorizados por urgência
   */
  async getPatientsWithCriticalSteps(
    tenantId: string,
    filters?: {
      journeyStage?: JourneyStage;
      cancerType?: string;
      maxResults?: number;
    }
  ): Promise<PatientWithCriticalStepDto[]> {
    const now = new Date();
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    // Buscar etapas críticas (OVERDUE obrigatórias ou próximas do prazo)
    const criticalSteps = await this.prisma.navigationStep.findMany({
      where: {
        tenantId,
        isCompleted: false,
        isRequired: true,
        ...(filters?.journeyStage && { journeyStage: filters.journeyStage }),
        ...(filters?.cancerType && {
          patient: {
            cancerType: filters.cancerType,
          },
        }),
        OR: [
          {
            status: 'OVERDUE',
          },
          {
            status: {
              in: ['PENDING', 'IN_PROGRESS'],
            },
            dueDate: {
              lte: now,
            },
          },
          {
            status: {
              in: ['PENDING', 'IN_PROGRESS'],
            },
            dueDate: {
              gte: now,
              lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // Próximos 7 dias
            },
          },
        ],
      },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            birthDate: true,
            cancerType: true,
            currentStage: true,
            priorityScore: true,
            priorityCategory: true,
          },
        },
      },
      orderBy: [
        {
          dueDate: 'asc', // Mais atrasadas primeiro
        },
        {
          isRequired: 'desc',
        },
      ],
      take: filters?.maxResults || 50,
    });

    // Agrupar por paciente e pegar a etapa mais crítica de cada um
    const patientMap = new Map<string, PatientWithCriticalStepDto>();

    for (const step of criticalSteps) {
      const patient = step.patient;
      const patientId = patient.id;

      // Calcular dias de atraso
      let daysOverdue: number | null = null;
      if (step.dueDate && new Date(step.dueDate) < now) {
        daysOverdue = Math.floor(
          (now.getTime() - new Date(step.dueDate).getTime()) /
            (1000 * 60 * 60 * 24)
        );
      }

      // Se paciente já está no mapa, verificar se esta etapa é mais crítica
      if (patientMap.has(patientId)) {
        const existing = patientMap.get(patientId);
        // Se esta etapa está mais atrasada, substituir
        if (
          daysOverdue !== null &&
          (existing.criticalStep.daysOverdue === null ||
            daysOverdue > existing.criticalStep.daysOverdue)
        ) {
          existing.criticalStep = {
            id: step.id,
            stepName: step.stepName,
            stepDescription: step.stepDescription,
            journeyStage: step.journeyStage,
            status: step.status,
            isRequired: step.isRequired,
            dueDate: step.dueDate?.toISOString() || null,
            daysOverdue,
            expectedDate: step.expectedDate?.toISOString() || null,
          };
        }
      } else {
        // Calcular idade
        const age = patient.birthDate
          ? new Date().getFullYear() - new Date(patient.birthDate).getFullYear()
          : 0;

        // Contar etapas totais e concluídas do paciente
        const allPatientSteps = await this.prisma.navigationStep.findMany({
          where: {
            tenantId,
            patientId,
          },
          select: {
            isCompleted: true,
          },
        });

        const totalSteps = allPatientSteps.length;
        const completedSteps = allPatientSteps.filter(
          (s) => s.isCompleted
        ).length;
        const completionRate =
          totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

        // Contar alertas de navegação do paciente
        const navigationAlertsCount = await this.prisma.alert.count({
          where: {
            tenantId,
            patientId,
            type: {
              in: [
                'NAVIGATION_DELAY',
                'MISSING_EXAM',
                'STAGING_INCOMPLETE',
                'TREATMENT_DELAY',
                'FOLLOW_UP_OVERDUE',
              ],
            },
            status: {
              in: ['PENDING', 'ACKNOWLEDGED'],
            },
          },
        });

        patientMap.set(patientId, {
          patientId,
          patientName: patient.name,
          patientAge: age,
          cancerType: patient.cancerType,
          currentStage: patient.currentStage,
          priorityScore: patient.priorityScore,
          priorityCategory: patient.priorityCategory,
          criticalStep: {
            id: step.id,
            stepName: step.stepName,
            stepDescription: step.stepDescription,
            journeyStage: step.journeyStage,
            status: step.status,
            isRequired: step.isRequired,
            dueDate: step.dueDate?.toISOString() || null,
            daysOverdue,
            expectedDate: step.expectedDate?.toISOString() || null,
          },
          totalSteps,
          completedSteps,
          completionRate,
          navigationAlertsCount,
        });
      }
    }

    // Converter para array e ordenar por urgência
    const result = Array.from(patientMap.values());

    // Ordenar por:
    // 1. Etapas OVERDUE obrigatórias (>14 dias) primeiro
    // 2. Etapas OVERDUE obrigatórias (≤14 dias)
    // 3. Etapas obrigatórias próximas do prazo (próximas 7 dias)
    // 4. Outras etapas críticas
    result.sort((a, b) => {
      const aDays = a.criticalStep.daysOverdue ?? Infinity;
      const bDays = b.criticalStep.daysOverdue ?? Infinity;

      // Etapas atrasadas primeiro
      if (aDays !== Infinity && bDays === Infinity) {
        return -1;
      }
      if (aDays === Infinity && bDays !== Infinity) {
        return 1;
      }

      // Entre etapas atrasadas, mais dias primeiro
      if (aDays !== Infinity && bDays !== Infinity) {
        return bDays - aDays;
      }

      // Entre etapas não atrasadas, prioridade do paciente
      return b.priorityScore - a.priorityScore;
    });

    return result;
  }

  /**
   * Calcula prazos críticos por tipo de câncer com comparação com benchmarks (NCCN/ESMO)
   */
  async getCriticalTimelines(tenantId: string): Promise<CriticalTimelinesDto> {
    try {
      this.logger.debug(
        `Iniciando cálculo de prazos críticos para tenantId: ${tenantId}`
      );
      // Benchmarks baseados em guidelines (NCCN, ESMO, INCA)
      const benchmarks: Record<string, CriticalTimelineBenchmark[]> = {
        colorectal: [
          {
            cancerType: 'colorectal',
            metric: 'time_to_diagnosis',
            idealDays: 60,
            acceptableDays: 90,
            criticalDays: 120,
          },
          {
            cancerType: 'colorectal',
            metric: 'time_to_treatment',
            idealDays: 30,
            acceptableDays: 60,
            criticalDays: 90,
          },
          {
            cancerType: 'colorectal',
            metric: 'biopsy_to_pathology',
            idealDays: 14,
            acceptableDays: 21,
            criticalDays: 30,
          },
          {
            cancerType: 'colorectal',
            metric: 'diagnosis_to_surgery',
            idealDays: 42,
            acceptableDays: 60,
            criticalDays: 90,
          },
          {
            cancerType: 'colorectal',
            metric: 'surgery_to_adjuvant_chemotherapy',
            idealDays: 56, // 8 semanas
            acceptableDays: 84, // 12 semanas
            criticalDays: 112, // 16 semanas
          },
        ],
        breast: [
          {
            cancerType: 'breast',
            metric: 'time_to_diagnosis',
            idealDays: 60,
            acceptableDays: 90,
            criticalDays: 120,
          },
          {
            cancerType: 'breast',
            metric: 'time_to_treatment',
            idealDays: 30,
            acceptableDays: 60,
            criticalDays: 90,
          },
          {
            cancerType: 'breast',
            metric: 'biopsy_to_pathology',
            idealDays: 14,
            acceptableDays: 21,
            criticalDays: 30,
          },
          {
            cancerType: 'breast',
            metric: 'diagnosis_to_surgery',
            idealDays: 42,
            acceptableDays: 60,
            criticalDays: 90,
          },
          {
            cancerType: 'breast',
            metric: 'surgery_to_adjuvant_chemotherapy',
            idealDays: 56,
            acceptableDays: 84,
            criticalDays: 112,
          },
        ],
        lung: [
          {
            cancerType: 'lung',
            metric: 'time_to_diagnosis',
            idealDays: 60,
            acceptableDays: 90,
            criticalDays: 120,
          },
          {
            cancerType: 'lung',
            metric: 'time_to_treatment',
            idealDays: 30,
            acceptableDays: 60,
            criticalDays: 90,
          },
          {
            cancerType: 'lung',
            metric: 'biopsy_to_pathology',
            idealDays: 14,
            acceptableDays: 21,
            criticalDays: 30,
          },
        ],
        prostate: [
          {
            cancerType: 'prostate',
            metric: 'time_to_diagnosis',
            idealDays: 60,
            acceptableDays: 90,
            criticalDays: 120,
          },
          {
            cancerType: 'prostate',
            metric: 'time_to_treatment',
            idealDays: 30,
            acceptableDays: 60,
            criticalDays: 90,
          },
        ],
      };

      const metricLabels: Record<string, string> = {
        time_to_diagnosis: 'Tempo até Diagnóstico',
        time_to_treatment: 'Tempo até Tratamento',
        biopsy_to_pathology: 'Biópsia → Laudo Patológico',
        diagnosis_to_surgery: 'Diagnóstico → Cirurgia',
        surgery_to_adjuvant_chemotherapy: 'Cirurgia → Quimioterapia Adjuvante',
      };

      const metrics: CriticalTimelineMetric[] = [];

      // Para cada tipo de câncer
      for (const [cancerType, cancerBenchmarks] of Object.entries(benchmarks)) {
        // Para cada métrica do tipo de câncer
        for (const benchmark of cancerBenchmarks) {
          let currentAverageDays: number | null = null;
          let patientsCount = 0;
          let patientsAtRisk = 0;

          // Calcular média atual baseada na métrica
          try {
            switch (benchmark.metric) {
              case 'time_to_diagnosis': {
                // Tempo desde primeira etapa DIAGNOSIS até diagnóstico confirmado
                const whereClause: any = {
                  tenantId,
                  journey: {
                    diagnosisConfirmed: true,
                    diagnosisDate: { not: null },
                  },
                };
                if (cancerType) {
                  whereClause.cancerType = {
                    equals: cancerType,
                    mode: 'insensitive',
                  };
                }
                const patients = await this.prisma.patient.findMany({
                  where: whereClause,
                  include: {
                    navigationSteps: {
                      where: {
                        journeyStage: 'DIAGNOSIS',
                      },
                      orderBy: {
                        createdAt: 'asc',
                      },
                      take: 1,
                    },
                    journey: {
                      select: {
                        diagnosisDate: true,
                      },
                    },
                  },
                });

                const validTimes = patients
                  .filter(
                    (p) =>
                      p.journey?.diagnosisDate && p.navigationSteps.length > 0
                  )
                  .map((p) => {
                    const firstDiagnosisStep = p.navigationSteps[0];
                    const diagnosisDate = p.journey.diagnosisDate;
                    const diffMs =
                      new Date(diagnosisDate).getTime() -
                      new Date(firstDiagnosisStep.createdAt).getTime();
                    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
                  })
                  .filter((days) => days >= 0);

                if (validTimes.length > 0) {
                  currentAverageDays = Math.round(
                    validTimes.reduce((sum, days) => sum + days, 0) /
                      validTimes.length
                  );
                  patientsCount = validTimes.length;
                  patientsAtRisk = validTimes.filter(
                    (days) => days > benchmark.criticalDays
                  ).length;
                }
                break;
              }

              case 'time_to_treatment': {
                // Tempo desde diagnóstico até início de tratamento
                const whereClause: any = {
                  tenantId,
                  journey: {
                    diagnosisDate: { not: null },
                    treatmentStartDate: { not: null },
                  },
                };
                if (cancerType) {
                  whereClause.cancerType = {
                    equals: cancerType,
                    mode: 'insensitive',
                  };
                }
                const patients = await this.prisma.patient.findMany({
                  where: whereClause,
                  include: {
                    journey: {
                      select: {
                        diagnosisDate: true,
                        treatmentStartDate: true,
                      },
                    },
                  },
                });

                const validTimes = patients
                  .filter(
                    (p) =>
                      p.journey?.diagnosisDate && p.journey?.treatmentStartDate
                  )
                  .map((p) => {
                    const diffMs =
                      new Date(p.journey.treatmentStartDate).getTime() -
                      new Date(p.journey.diagnosisDate).getTime();
                    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
                  })
                  .filter((days) => days >= 0);

                if (validTimes.length > 0) {
                  currentAverageDays = Math.round(
                    validTimes.reduce((sum, days) => sum + days, 0) /
                      validTimes.length
                  );
                  patientsCount = validTimes.length;
                  patientsAtRisk = validTimes.filter(
                    (days) => days > benchmark.criticalDays
                  ).length;
                }
                break;
              }

              case 'biopsy_to_pathology': {
                // Tempo desde biópsia até laudo patológico
                const whereClause: any = {
                  tenantId,
                  stepKey: {
                    in: [
                      'biopsy',
                      'colonoscopy',
                      'breast_biopsy',
                      'lung_biopsy',
                    ],
                  },
                  isCompleted: true,
                  completedAt: { not: null },
                };
                if (cancerType) {
                  whereClause.cancerType = {
                    equals: cancerType,
                    mode: 'insensitive',
                  };
                }
                const biopsySteps = await this.prisma.navigationStep.findMany({
                  where: whereClause,
                  include: {
                    patient: {
                      include: {
                        navigationSteps: {
                          where: {
                            stepKey: {
                              in: ['pathology_report', 'pathology_result'],
                            },
                            isCompleted: true,
                            completedAt: { not: null },
                          },
                          orderBy: {
                            completedAt: 'asc',
                          },
                          take: 1,
                        },
                      },
                    },
                  },
                });

                const validTimes = biopsySteps
                  .filter(
                    (step) =>
                      step.completedAt &&
                      step.patient.navigationSteps.length > 0
                  )
                  .map((step) => {
                    const pathologyStep = step.patient.navigationSteps[0];
                    const diffMs =
                      new Date(pathologyStep.completedAt).getTime() -
                      new Date(step.completedAt).getTime();
                    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
                  })
                  .filter((days) => days >= 0);

                if (validTimes.length > 0) {
                  currentAverageDays = Math.round(
                    validTimes.reduce((sum, days) => sum + days, 0) /
                      validTimes.length
                  );
                  patientsCount = validTimes.length;
                  patientsAtRisk = validTimes.filter(
                    (days) => days > benchmark.criticalDays
                  ).length;
                }
                break;
              }

              case 'diagnosis_to_surgery': {
                // Tempo desde diagnóstico até cirurgia
                const whereClause: any = {
                  tenantId,
                  journey: {
                    diagnosisDate: { not: null },
                  },
                };
                if (cancerType) {
                  whereClause.cancerType = {
                    equals: cancerType,
                    mode: 'insensitive',
                  };
                }
                const patients = await this.prisma.patient.findMany({
                  where: whereClause,
                  include: {
                    navigationSteps: {
                      where: {
                        stepKey: {
                          in: [
                            'surgery',
                            'colectomy',
                            'mastectomy',
                            'lumpectomy',
                          ],
                        },
                        isCompleted: true,
                        completedAt: { not: null },
                      },
                      orderBy: {
                        completedAt: 'asc',
                      },
                      take: 1,
                    },
                    journey: {
                      select: {
                        diagnosisDate: true,
                      },
                    },
                  },
                });

                const validTimes = patients
                  .filter(
                    (p) =>
                      p.journey?.diagnosisDate && p.navigationSteps.length > 0
                  )
                  .map((p) => {
                    const surgeryStep = p.navigationSteps[0];
                    const diffMs =
                      new Date(surgeryStep.completedAt).getTime() -
                      new Date(p.journey.diagnosisDate).getTime();
                    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
                  })
                  .filter((days) => days >= 0);

                if (validTimes.length > 0) {
                  currentAverageDays = Math.round(
                    validTimes.reduce((sum, days) => sum + days, 0) /
                      validTimes.length
                  );
                  patientsCount = validTimes.length;
                  patientsAtRisk = validTimes.filter(
                    (days) => days > benchmark.criticalDays
                  ).length;
                }
                break;
              }

              case 'surgery_to_adjuvant_chemotherapy': {
                // Tempo desde cirurgia até início de quimioterapia adjuvante
                const whereClause: any = {
                  tenantId,
                };
                if (cancerType) {
                  whereClause.cancerType = {
                    equals: cancerType,
                    mode: 'insensitive',
                  };
                }
                const patients = await this.prisma.patient.findMany({
                  where: whereClause,
                  include: {
                    navigationSteps: {
                      where: {
                        stepKey: {
                          in: [
                            'surgery',
                            'colectomy',
                            'mastectomy',
                            'lumpectomy',
                          ],
                        },
                        isCompleted: true,
                        completedAt: { not: null },
                      },
                      orderBy: {
                        completedAt: 'desc',
                      },
                      take: 1,
                    },
                    journey: {
                      select: {
                        treatmentStartDate: true,
                      },
                    },
                  },
                });

                const validTimes = patients
                  .filter(
                    (p) =>
                      p.navigationSteps.length > 0 &&
                      p.journey?.treatmentStartDate
                  )
                  .map((p) => {
                    const surgeryStep = p.navigationSteps[0];
                    const diffMs =
                      new Date(p.journey.treatmentStartDate).getTime() -
                      new Date(surgeryStep.completedAt).getTime();
                    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
                  })
                  .filter((days) => days >= 0);

                if (validTimes.length > 0) {
                  currentAverageDays = Math.round(
                    validTimes.reduce((sum, days) => sum + days, 0) /
                      validTimes.length
                  );
                  patientsCount = validTimes.length;
                  patientsAtRisk = validTimes.filter(
                    (days) => days > benchmark.criticalDays
                  ).length;
                }
                break;
              }
            }
          } catch (error) {
            // Se houver erro ao calcular uma métrica específica, continuar com as outras
            this.logger.error(
              `Erro ao calcular métrica ${benchmark.metric} para ${cancerType}:`,
              error instanceof Error ? error.stack : String(error)
            );
          }

          // Determinar status baseado na comparação com benchmark
          let status: 'IDEAL' | 'ACCEPTABLE' | 'CRITICAL' | 'NO_DATA';
          if (currentAverageDays === null) {
            status = 'NO_DATA';
          } else if (currentAverageDays <= benchmark.idealDays) {
            status = 'IDEAL';
          } else if (currentAverageDays <= benchmark.acceptableDays) {
            status = 'ACCEPTABLE';
          } else {
            status = 'CRITICAL';
          }

          metrics.push({
            cancerType,
            metric: benchmark.metric,
            metricLabel: metricLabels[benchmark.metric] || benchmark.metric,
            currentAverageDays,
            benchmark,
            status,
            patientsCount,
            patientsAtRisk,
          });
        }
      }

      // Calcular resumo
      const summary = {
        totalMetrics: metrics.length,
        metricsInIdealRange: metrics.filter((m) => m.status === 'IDEAL').length,
        metricsInAcceptableRange: metrics.filter(
          (m) => m.status === 'ACCEPTABLE'
        ).length,
        metricsInCriticalRange: metrics.filter((m) => m.status === 'CRITICAL')
          .length,
        metricsWithNoData: metrics.filter((m) => m.status === 'NO_DATA').length,
      };

      this.logger.debug(
        `Cálculo de prazos críticos concluído. Total de métricas: ${metrics.length}`
      );
      return {
        metrics,
        summary,
      };
    } catch (error) {
      this.logger.error(
        'Erro ao calcular prazos críticos:',
        error instanceof Error ? error.stack : String(error)
      );
      // Retornar estrutura vazia em caso de erro
      return {
        metrics: [],
        summary: {
          totalMetrics: 0,
          metricsInIdealRange: 0,
          metricsInAcceptableRange: 0,
          metricsInCriticalRange: 0,
          metricsWithNoData: 0,
        },
      };
    }
  }

  /**
   * Lista alertas pendentes para drill-down do KPI "Alertas Pendentes".
   */
  async getPendingAlerts(tenantId: string, maxResults: number = 100) {
    const alerts = await this.prisma.alert.findMany({
      where: {
        tenantId,
        status: { in: ['PENDING', 'ACKNOWLEDGED'] },
      },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
      },
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
      take: maxResults,
    });

    return alerts.map((alert) => ({
      id: alert.id,
      type: alert.type,
      severity: alert.severity,
      message: alert.message,
      status: alert.status,
      createdAt: alert.createdAt,
      patientId: alert.patientId,
      patient: {
        id: alert.patient.id,
        name: alert.patient.name,
        phone: alert.patient.phone,
      },
    }));
  }

  /**
   * Lista pacientes filtrados por indicador (mensagens não assumidas, biomarcadores pendentes).
   */
  async getPatientsByIndicator(
    tenantId: string,
    indicator: 'messages' | 'biomarkers',
    maxResults: number = 100,
  ) {
    if (indicator === 'messages') {
      // Pacientes com mensagens não assumidas + contagem por paciente
      const messageCounts = await this.prisma.message.groupBy({
        by: ['patientId'],
        where: {
          tenantId,
          direction: 'INBOUND',
          assumedBy: null,
        },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: maxResults,
      });

      const patientIds = messageCounts.map((m) => m.patientId);
      if (patientIds.length === 0) {
        return [];
      }

      const patients = await this.prisma.patient.findMany({
        where: {
          id: { in: patientIds },
          tenantId,
        },
        select: {
          id: true,
          name: true,
          phone: true,
          priorityScore: true,
          priorityCategory: true,
          currentStage: true,
          cancerType: true,
          status: true,
        },
      });

      // Anexar contagem de mensagens a cada paciente
      const countMap = new Map(messageCounts.map((m) => [m.patientId, m._count.id]));
      return patients.map((p) => ({
        ...p,
        unassumedMessagesCount: countMap.get(p.id) ?? 0,
      }));
    }

    if (indicator === 'biomarkers') {
      // Pacientes com biomarcadores pendentes
      const biomarkerStepKeys = [
        'her2_test', 'egfr_test', 'pdl1_test', 'msi_test',
        'kras_test', 'braf_test', 'alk_test',
        'biomarker_her2', 'biomarker_egfr', 'biomarker_pdl1',
        'biomarker_msi', 'biomarker_kras', 'biomarker_braf', 'biomarker_alk',
      ];

      const pendingSteps = await this.prisma.navigationStep.findMany({
        where: {
          tenantId,
          stepKey: { in: biomarkerStepKeys },
          isCompleted: false,
          status: { in: ['PENDING', 'IN_PROGRESS', 'OVERDUE'] },
        },
        select: { patientId: true },
        distinct: ['patientId'],
        take: maxResults,
      });

      const patientIds = pendingSteps.map((s) => s.patientId);
      if (patientIds.length === 0) {
        return [];
      }

      return this.prisma.patient.findMany({
        where: {
          id: { in: patientIds },
          tenantId,
        },
        select: {
          id: true,
          name: true,
          phone: true,
          priorityScore: true,
          priorityCategory: true,
          currentStage: true,
          cancerType: true,
          status: true,
        },
        take: maxResults,
      });
    }

    return [];
  }
}