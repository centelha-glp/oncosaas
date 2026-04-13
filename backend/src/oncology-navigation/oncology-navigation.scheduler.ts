import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { getAiServiceConfig } from '../common/utils/ai-service.util';
import { OncologyNavigationService } from './oncology-navigation.service';
import { PrismaService } from '../prisma/prisma.service';
import { AlertsService } from '../alerts/alerts.service';
import { AlertType, AlertSeverity } from '@generated/prisma/client';

@Injectable()
export class OncologyNavigationScheduler {
  private readonly logger = new Logger(OncologyNavigationScheduler.name);

  constructor(
    private readonly navigationService: OncologyNavigationService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly alertsService: AlertsService,
  ) {}

  /**
   * Verifica etapas atrasadas diariamente às 6h da manhã
   * Executa para todos os tenants do sistema
   */
  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async handleOverdueStepsCheck() {
    this.logger.log('Iniciando verificação diária de etapas atrasadas...');

    try {
      // Obter todos os tenants ativos
      const tenants = await this.prisma.tenant.findMany({
        select: {
          id: true,
          name: true,
        },
      });

      this.logger.log(
        `Verificando etapas atrasadas para ${tenants.length} tenant(s)`
      );

      let totalChecked = 0;
      let totalMarkedOverdue = 0;
      let totalAlertsCreated = 0;

      for (const tenant of tenants) {
        try {
          const result = await this.navigationService.checkOverdueSteps(
            tenant.id
          );
          totalChecked += result.checked;
          totalMarkedOverdue += result.markedOverdue;
          totalAlertsCreated += result.alertsCreated;

          if (result.alertsCreated > 0) {
            this.logger.log(
              `Tenant ${tenant.name}: ${result.alertsCreated} alerta(s) criado(s) para ${result.markedOverdue} etapa(s) atrasada(s)`
            );
          }
        } catch (error) {
          this.logger.error(
            `Erro ao verificar etapas atrasadas para tenant ${tenant.name}:`,
            error
          );
        }
      }

      this.logger.log(
        `Verificação concluída: ${totalChecked} etapa(s) verificada(s), ${totalMarkedOverdue} marcada(s) como atrasada(s), ${totalAlertsCreated} alerta(s) criado(s)`
      );
    } catch (error) {
      this.logger.error(
        'Erro ao executar verificação de etapas atrasadas:',
        error
      );
    }
  }

  /**
   * Verifica etapas atrasadas a cada hora (para testes ou verificação mais frequente)
   * Pode ser desabilitado em produção se preferir apenas verificação diária
   */
  @Cron(CronExpression.EVERY_HOUR)
  async handleHourlyOverdueStepsCheck() {
    this.logger.log('Verificação horária de etapas atrasadas...');
    await this.handleOverdueStepsCheck();
  }

  /**
   * Recalcula prioridades de todos os pacientes ativos diariamente às 5h.
   * Usa o modelo ML treinado no AI Service para gerar scores atualizados.
   */
  @Cron(CronExpression.EVERY_DAY_AT_5AM)
  async handleDailyPriorityRecalculation() {
    this.logger.log('Iniciando recálculo diário de prioridades...');

    const { aiServiceUrl, headers: aiHeaders } = getAiServiceConfig(
      this.configService,
    );

    try {
      const tenants = await this.prisma.tenant.findMany({ select: { id: true, name: true } });

      let totalUpdated = 0;

      for (const tenant of tenants) {
        try {
          const patients = await this.prisma.patient.findMany({
            where: { tenantId: tenant.id },
            select: {
              id: true,
              cancerType: true,
              stage: true,
              performanceStatus: true,
              birthDate: true,
            },
          });

          if (patients.length === 0) {continue;}

          const items = patients.map((p) => {
            const age = p.birthDate
              ? Math.floor(
                  (Date.now() - new Date(p.birthDate).getTime()) / (365.25 * 24 * 3600 * 1000),
                )
              : 60;

            return {
              patient_id: p.id,
              cancer_type: p.cancerType || 'other',
              stage: p.stage || 'unknown',
              ecog: p.performanceStatus ?? 1,
              age,
              pain_level: 0,
              nausea_level: 0,
              fatigue_level: 0,
              days_since_last_visit: 30,
              treatment_cycle: 1,
            };
          });

          const BATCH_SIZE = 50;
          for (let i = 0; i < items.length; i += BATCH_SIZE) {
            const batch = items.slice(i, i + BATCH_SIZE);

            try {
              const response = await fetch(`${aiServiceUrl}/api/v1/prioritize-bulk`, {
                method: 'POST',
                headers: aiHeaders,
                body: JSON.stringify({ patients: batch }),
                // 120s — lote até 50 pacientes; payload pode ser grande
                signal: AbortSignal.timeout(120_000),
              });

              if (!response.ok) {
                this.logger.warn(
                  `AI Service retornou ${response.status} para bulk priority (tenant ${tenant.name})`,
                );
                continue;
              }

              const data = (await response.json()) as {
                results: Array<{
                  patient_id: string;
                  priority_score: number;
                  priority_category: string;
                  reason: string;
                }>;
              };

              for (const result of data.results) {
                const categoryMap: Record<string, string> = {
                  critical: 'CRITICAL',
                  high: 'HIGH',
                  medium: 'MEDIUM',
                  low: 'LOW',
                };

                await this.prisma.patient.update({
                  where: { id: result.patient_id, tenantId: tenant.id },
                  data: {
                    priorityScore: Math.round(result.priority_score),
                    priorityCategory: (categoryMap[result.priority_category] || 'LOW') as any,
                    priorityReason: result.reason,
                    priorityUpdatedAt: new Date(),
                  },
                });
                totalUpdated++;
              }
            } catch (batchError) {
              this.logger.error(
                `Erro no batch de priorização (tenant ${tenant.name}):`,
                batchError,
              );
            }
          }
        } catch (tenantError) {
          this.logger.error(
            `Erro ao recalcular prioridades para tenant ${tenant.name}:`,
            tenantError,
          );
        }
      }

      this.logger.log(`Recálculo de prioridades concluído: ${totalUpdated} paciente(s) atualizado(s)`);
    } catch (error) {
      this.logger.error('Erro ao executar recálculo de prioridades:', error);
    }
  }

  /**
   * Analisa riscos preditivos diariamente às 5h30 (após priorização às 5h).
   * Chama o AI Service para cada tenant, gerando alertas automáticos quando
   * detecta atrasos iminentes, piora de ESAS, ausência ou risco de abandono.
   */
  @Cron('0 30 5 * * *')
  async handleDailyPredictiveAlerts() {
    this.logger.log('Iniciando análise preditiva diária de riscos...');

    const { aiServiceUrl, headers: aiHeaders } = getAiServiceConfig(
      this.configService,
    );

    const RISK_TYPE_TO_ALERT_TYPE: Record<string, AlertType> = {
      STEP_DELAY: 'NAVIGATION_DELAY',
      SYMPTOM_WORSENING: 'SYMPTOM_WORSENING',
      NO_RESPONSE: 'NO_RESPONSE',
      ABANDONMENT: 'NO_RESPONSE',
    };

    const SEVERITY_MAP: Record<string, AlertSeverity> = {
      CRITICAL: 'CRITICAL',
      HIGH: 'HIGH',
      MEDIUM: 'MEDIUM',
      LOW: 'LOW',
    };

    try {
      const tenants = await this.prisma.tenant.findMany({ select: { id: true, name: true } });
      let totalAlerts = 0;

      for (const tenant of tenants) {
        try {
          const patients = await this.prisma.patient.findMany({
            where: { tenantId: tenant.id, status: 'ACTIVE' },
            select: {
              id: true,
              name: true,
              cancerType: true,
              stage: true,
              performanceStatus: true,
              priorityScore: true,
              lastInteraction: true,
              createdAt: true,
              navigationSteps: {
                select: {
                  stepKey: true,
                  stepName: true,
                  status: true,
                  isRequired: true,
                  expectedDate: true,
                  dueDate: true,
                  completedAt: true,
                },
              },
              questionnaireResponses: {
                where: { questionnaire: { type: 'ESAS' } },
                orderBy: { completedAt: 'desc' },
                take: 3,
                select: { completedAt: true, scores: true },
              },
              messages: { select: { id: true } },
            },
          });

          if (patients.length === 0) {continue;}

          const now = new Date();

          const riskPayload = patients.map((p) => {
            const lastInteractionDays = p.lastInteraction
              ? Math.floor((now.getTime() - new Date(p.lastInteraction).getTime()) / (86400000))
              : 999;

            const daysSinceRegistration = Math.floor(
              (now.getTime() - new Date(p.createdAt).getTime()) / 86400000,
            );

            return {
              patient_id: p.id,
              patient_name: p.name,
              cancer_type: p.cancerType || undefined,
              stage: p.stage || undefined,
              performance_status: p.performanceStatus ?? undefined,
              priority_score: p.priorityScore,
              last_interaction_days: lastInteractionDays,
              navigation_steps: p.navigationSteps.map((s) => ({
                step_key: s.stepKey,
                step_name: s.stepName,
                status: s.status,
                is_required: s.isRequired,
                expected_date: s.expectedDate?.toISOString() ?? undefined,
                due_date: s.dueDate?.toISOString() ?? undefined,
                completed_at: s.completedAt?.toISOString() ?? undefined,
              })),
              esas_history: p.questionnaireResponses.map((qr) => ({
                completed_at: qr.completedAt.toISOString(),
                scores: (qr.scores as Record<string, any>) ?? {},
              })),
              total_messages: p.messages.length,
              days_since_registration: daysSinceRegistration,
            };
          });

          const BATCH_SIZE = 30;
          for (let i = 0; i < riskPayload.length; i += BATCH_SIZE) {
            const batch = riskPayload.slice(i, i + BATCH_SIZE);

            try {
              const response = await fetch(`${aiServiceUrl}/api/v1/agent/predict-risk-bulk`, {
                method: 'POST',
                headers: aiHeaders,
                body: JSON.stringify({ patients: batch }),
                // 120s — lote de risco preditivo com histórico ESAS/steps por paciente
                signal: AbortSignal.timeout(120_000),
              });

              if (!response.ok) {
                this.logger.warn(
                  `AI Service retornou ${response.status} para predict-risk-bulk (tenant ${tenant.name})`,
                );
                continue;
              }

              const data = (await response.json()) as {
                results: Array<{
                  patient_id: string;
                  risks: Array<{
                    risk_type: string;
                    probability: number;
                    severity: string;
                    message: string;
                    details: Record<string, any>;
                  }>;
                  highest_severity: string;
                }>;
              };

              for (const result of data.results) {
                const highRisks = result.risks.filter(
                  (r) => r.severity === 'CRITICAL' || r.severity === 'HIGH',
                );

                for (const risk of highRisks) {
                  try {
                    await this.alertsService.create(
                      {
                        patientId: result.patient_id,
                        type: RISK_TYPE_TO_ALERT_TYPE[risk.risk_type] || 'NO_RESPONSE',
                        severity: SEVERITY_MAP[risk.severity] || 'MEDIUM',
                        message: `[Preditivo] ${risk.message}`,
                        context: {
                          source: 'predictive_model',
                          risk_type: risk.risk_type,
                          probability: risk.probability,
                          ...risk.details,
                        },
                      },
                      tenant.id,
                    );
                    totalAlerts++;
                  } catch (alertError) {
                    this.logger.error(
                      `Erro ao criar alerta preditivo para paciente ${result.patient_id}:`,
                      alertError,
                    );
                  }
                }
              }
            } catch (batchError) {
              this.logger.error(
                `Erro no batch de análise preditiva (tenant ${tenant.name}):`,
                batchError,
              );
            }
          }
        } catch (tenantError) {
          this.logger.error(
            `Erro ao analisar riscos para tenant ${tenant.name}:`,
            tenantError,
          );
        }
      }

      this.logger.log(
        `Análise preditiva concluída: ${totalAlerts} alerta(s) preditivo(s) criado(s)`,
      );
    } catch (error) {
      this.logger.error('Erro ao executar análise preditiva de riscos:', error);
    }
  }
}