import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getAiServiceConfig } from '../common/utils/ai-service.util';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { ChannelGatewayService } from '../channel-gateway/channel-gateway.service';
import { ClinicalProtocolsService } from '../clinical-protocols/clinical-protocols.service';
import { PatientStatus, ScheduledActionStatus } from '@generated/prisma/client';
import { ChannelType, JourneyStage } from '@generated/prisma/client';

const FREQUENCY_DAYS: Record<string, number> = {
  daily: 1,
  twice_weekly: 3,
  weekly: 7,
  biweekly: 14,
  monthly: 30,
};

const STAGES_WITH_QUESTIONNAIRES: JourneyStage[] = ['TREATMENT', 'FOLLOW_UP'];

@Injectable()
export class AgentSchedulerService {
  private readonly logger = new Logger(AgentSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly channelGateway: ChannelGatewayService,
    private readonly configService: ConfigService,
    private readonly clinicalProtocols: ClinicalProtocolsService,
  ) {}

  /**
   * Every 6 hours: create QUESTIONNAIRE scheduled actions for patients who are due
   * (proactive questionnaire based on protocol checkInRules and last response date).
   */
  @Cron(CronExpression.EVERY_6_HOURS)
  async scheduleProactiveQuestionnaires() {
    try {
      const now = new Date();
      const tenants = await this.prisma.tenant.findMany({
        select: { id: true },
      });

      const basePatientFilter = {
        status: { in: [PatientStatus.ACTIVE, PatientStatus.IN_TREATMENT] },
        cancerType: { not: null },
        currentStage: { in: STAGES_WITH_QUESTIONNAIRES },
        conversations: { some: {} },
      };

      const PAGE_SIZE = 200;
      let created = 0;

      for (const { id: tenantId } of tenants) {
        let skip = 0;
        for (;;) {
          const patients = await this.prisma.patient.findMany({
            where: {
              tenantId,
              ...basePatientFilter,
            },
            select: {
              id: true,
              tenantId: true,
              cancerType: true,
              currentStage: true,
              conversations: {
                where: { status: 'ACTIVE' },
                orderBy: { lastMessageAt: 'desc' },
                take: 1,
                select: { id: true, channel: true },
              },
            },
            orderBy: { id: 'asc' },
            take: PAGE_SIZE,
            skip,
          });

          if (patients.length === 0) {
            break;
          }

          for (const patient of patients) {
            const cancerType = patient.cancerType as string;
            const stage = patient.currentStage as string;
            const conversation = patient.conversations[0];
            if (!conversation || !cancerType) {
              continue;
            }

            const checkInRules = await this.clinicalProtocols.getCheckInRules(
              patient.tenantId,
              cancerType,
            );
            if (!checkInRules) {
              continue;
            }

            const rule = checkInRules[stage] as
              | { frequency: string; questionnaire: string | null }
              | undefined;
            if (!rule?.questionnaire) {
              continue;
            }

            const questionnaireType = rule.questionnaire;
            const frequencyDays = FREQUENCY_DAYS[rule.frequency] ?? 7;

            const lastResponse =
              await this.prisma.questionnaireResponse.findFirst({
                where: {
                  patientId: patient.id,
                  questionnaire: {
                    type: questionnaireType as 'ESAS' | 'PRO_CTCAE',
                  },
                },
                orderBy: { completedAt: 'desc' },
                select: { completedAt: true },
              });

            const lastAt = lastResponse?.completedAt;
            if (lastAt) {
              const daysSince = Math.floor(
                (now.getTime() - lastAt.getTime()) / (24 * 60 * 60 * 1000),
              );
              if (daysSince < frequencyDays) {
                continue;
              }
            }

            const existing = await this.prisma.scheduledAction.findFirst({
              where: {
                patientId: patient.id,
                actionType: 'QUESTIONNAIRE',
                status: ScheduledActionStatus.PENDING,
              },
            });
            if (existing) {
              continue;
            }

            await this.prisma.scheduledAction.create({
              data: {
                tenantId: patient.tenantId,
                patientId: patient.id,
                conversationId: conversation.id,
                actionType: 'QUESTIONNAIRE',
                channel:
                  (conversation.channel as ChannelType) ?? ChannelType.WHATSAPP,
                scheduledAt: now,
                payload: {
                  questionnaireType,
                  frequency: rule.frequency,
                  source: 'proactive_job',
                },
              },
            });
            created++;
          }

          if (patients.length < PAGE_SIZE) {
            break;
          }
          skip += PAGE_SIZE;
        }
      }

      if (created > 0) {
        this.logger.log(
          `Proactive questionnaires: created ${created} QUESTIONNAIRE actions`,
        );
      }
    } catch (error) {
      this.logger.error(
        `scheduleProactiveQuestionnaires failed: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
        error,
      );
    }
  }

  /**
   * Every minute: check for due scheduled actions and execute them
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async executeScheduledActions() {
    const now = new Date();

    const dueActions = await this.prisma.scheduledAction.findMany({
      where: {
        status: ScheduledActionStatus.PENDING,
        scheduledAt: { lte: now },
      },
      take: 50, // Process in batches
      orderBy: { scheduledAt: 'asc' },
    });

    if (dueActions.length === 0) {
      return;
    }

    this.logger.log(`Processing ${dueActions.length} due scheduled actions`);

    for (const action of dueActions) {
      try {
        // Mark as executing
        await this.prisma.scheduledAction.update({
          where: { id: action.id, tenantId: action.tenantId },
          data: { status: ScheduledActionStatus.EXECUTING },
        });

        switch (action.actionType) {
          case 'CHECK_IN':
            await this.executeCheckIn(action);
            break;
          case 'QUESTIONNAIRE':
            await this.executeQuestionnaire(action);
            break;
          case 'MEDICATION_REMINDER':
          case 'APPOINTMENT_REMINDER':
            await this.executeReminder(action);
            break;
          case 'FOLLOW_UP':
            await this.executeFollowUp(action);
            break;
          default:
            this.logger.warn(
              `No handler for action type: ${action.actionType}`
            );
        }

        // Mark as completed
        await this.prisma.scheduledAction.update({
          where: { id: action.id, tenantId: action.tenantId },
          data: {
            status: ScheduledActionStatus.COMPLETED,
            executedAt: new Date(),
          },
        });

        // Handle recurrence
        if (action.isRecurring && action.recurrenceRule) {
          await this.scheduleNextOccurrence(action);
        }
      } catch (error) {
        this.logger.error(
          `Failed to execute scheduled action ${action.id}`,
          error
        );

        const retryCount = action.retryCount + 1;
        await this.prisma.scheduledAction.update({
          where: { id: action.id, tenantId: action.tenantId },
          data: {
            status:
              retryCount >= action.maxRetries
                ? ScheduledActionStatus.FAILED
                : ScheduledActionStatus.PENDING,
            retryCount,
            lastError: error instanceof Error ? error.message : 'Unknown error',
            // Exponential backoff for retries
            scheduledAt:
              retryCount < action.maxRetries
                ? new Date(Date.now() + Math.pow(2, retryCount) * 60000)
                : undefined,
          },
        });
      }
    }
  }

  private async executeCheckIn(action: any) {
    const message = await this.getPersonalizedMessage(action, 'CHECK_IN');
    await this.channelGateway.sendMessage(
      action.patientId,
      action.tenantId,
      message,
      action.channel,
      action.conversationId,
    );
  }

  private async executeQuestionnaire(action: any) {
    const message = await this.getPersonalizedMessage(action, 'QUESTIONNAIRE');
    await this.channelGateway.sendMessage(
      action.patientId,
      action.tenantId,
      message,
      action.channel,
      action.conversationId,
    );
  }

  private async executeReminder(action: any) {
    const message = await this.getPersonalizedMessage(
      action,
      action.actionType === 'MEDICATION_REMINDER'
        ? 'MEDICATION_REMINDER'
        : 'APPOINTMENT_REMINDER',
    );
    await this.channelGateway.sendMessage(
      action.patientId,
      action.tenantId,
      message,
      action.channel,
      action.conversationId,
    );
  }

  private async executeFollowUp(action: any) {
    const message = await this.getPersonalizedMessage(action, 'FOLLOW_UP');
    await this.channelGateway.sendMessage(
      action.patientId,
      action.tenantId,
      message,
      action.channel,
      action.conversationId,
    );
  }

  /**
   * Generate a personalized message via AI Service, falling back to
   * the generic payload message or a default if AI is unavailable.
   */
  private async getPersonalizedMessage(
    action: any,
    actionType: string,
  ): Promise<string> {
    const payload = action.payload as any;
    const defaultMessages: Record<string, string> = {
      CHECK_IN:
        'Olá! Como você está se sentindo hoje? Algum sintoma novo ou preocupação?',
      QUESTIONNAIRE:
        'Hora do nosso acompanhamento! Vou fazer algumas perguntas sobre como você está se sentindo. Podemos começar?',
      MEDICATION_REMINDER:
        'Lembrete: não esqueça de tomar sua medicação conforme prescrito.',
      APPOINTMENT_REMINDER:
        'Lembrete: você tem uma etapa com prazo próximo. Você já tem isso agendado?',
      FOLLOW_UP:
        'Olá! Como você tem se sentido desde a última consulta?',
    };

    const fallback =
      payload?.message || defaultMessages[actionType] || defaultMessages.CHECK_IN;

    try {
      const clinicalContext = await this.buildPatientContext(
        action.patientId,
        action.tenantId,
      );
      if (!clinicalContext) {
        return fallback;
      }

      const { aiServiceUrl, headers: aiHeaders } = getAiServiceConfig(this.configService);

      const response = await fetch(
        `${aiServiceUrl}/api/v1/agent/checkin-message`,
        {
          method: 'POST',
          headers: aiHeaders,
          body: JSON.stringify({
            patient_id: action.patientId,
            tenant_id: action.tenantId,
            action_type: actionType,
            clinical_context: clinicalContext,
          }),
          signal: AbortSignal.timeout(10000),
        },
      );

      if (response.ok) {
        const data = await response.json();
        if (data.message) {
          this.logger.log(
            `Personalized ${actionType} message generated (llm=${data.used_llm})`,
          );
          return data.message;
        }
      }
    } catch (error) {
      this.logger.warn(
        `AI Service unavailable for personalized message, using fallback: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
    }

    return fallback;
  }

  /**
   * Build a minimal clinical context for the patient to send to the AI Service.
   */
  private async buildPatientContext(
    patientId: string,
    tenantId: string,
  ): Promise<Record<string, any> | null> {
    try {
      const patient = await this.prisma.patient.findFirst({
        where: { id: patientId, tenantId },
        select: {
          name: true,
          cancerType: true,
          stage: true,
          currentStage: true,
          priorityCategory: true,
          priorityScore: true,
          performanceStatus: true,
        },
      });

      if (!patient) {return null;}

      const currentStage = patient.currentStage ?? 'SCREENING';
      const recentSteps = await this.prisma.navigationStep.findMany({
        where: {
          patientId,
          tenantId,
          status: { in: ['PENDING', 'IN_PROGRESS'] },
          journeyStage: currentStage,
        },
        orderBy: { dueDate: 'asc' },
        take: 3,
        select: { stepName: true, status: true, dueDate: true },
      });

      return {
        patient: {
          name: patient.name,
          cancerType: patient.cancerType,
          stage: patient.stage,
          currentStage: patient.currentStage,
          priorityCategory: patient.priorityCategory,
          priorityScore: patient.priorityScore,
          performanceStatus: patient.performanceStatus,
        },
        navigationSteps: recentSteps,
      };
    } catch (error) {
      this.logger.warn(
        `Failed to build patient context for personalized message: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
      return null;
    }
  }

  /**
   * Schedule the next occurrence of a recurring action
   */
  private async scheduleNextOccurrence(action: any) {
    const rule = action.recurrenceRule;
    let nextDate: Date | null = null;

    // Simple recurrence rules
    const now = new Date();
    switch (rule) {
      case 'daily':
        nextDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        break;
      case 'twice_weekly':
        nextDate = new Date(now.getTime() + 3.5 * 24 * 60 * 60 * 1000);
        break;
      case 'weekly':
        nextDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        break;
      case 'biweekly':
        nextDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        nextDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        this.logger.warn(`Unknown recurrence rule: ${rule}`);
        return;
    }

    if (nextDate) {
      await this.prisma.scheduledAction.create({
        data: {
          tenantId: action.tenantId,
          patientId: action.patientId,
          conversationId: action.conversationId,
          actionType: action.actionType,
          channel: action.channel,
          scheduledAt: nextDate,
          payload: action.payload,
          isRecurring: true,
          recurrenceRule: rule,
          status: ScheduledActionStatus.PENDING,
        },
      });
    }
  }
}
