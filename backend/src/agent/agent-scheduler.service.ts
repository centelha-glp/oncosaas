import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { ChannelGatewayService } from '../channel-gateway/channel-gateway.service';
import { ScheduledActionStatus } from '@prisma/client';

@Injectable()
export class AgentSchedulerService {
  private readonly logger = new Logger(AgentSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly channelGateway: ChannelGatewayService,
    private readonly configService: ConfigService,
  ) {}

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
          where: { id: action.id },
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
          where: { id: action.id },
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
          where: { id: action.id },
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

      const aiServiceUrl =
        this.configService.get<string>('AI_SERVICE_URL') ||
        'http://localhost:8001';

      const response = await fetch(
        `${aiServiceUrl}/api/v1/agent/checkin-message`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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

      if (!patient) return null;

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
