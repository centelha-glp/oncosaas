import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ChannelGatewayService } from '../channel-gateway/channel-gateway.service';
import { ConversationService } from './conversation.service';
import { DecisionGateService } from './decision-gate.service';
import { AlertsGateway } from '../gateways/alerts.gateway';
import {
  ClinicalContext,
  AgentResponse,
} from './interfaces/agent-decision.interface';

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly channelGateway: ChannelGatewayService,
    private readonly conversationService: ConversationService,
    private readonly decisionGate: DecisionGateService,
    private readonly alertsGateway: AlertsGateway
  ) {}

  /**
   * Main entry point: process an incoming message through the agent pipeline.
   *
   * 1. Verify conversation state
   * 2. Build clinical context
   * 3. Get active protocol
   * 4. Get conversation history
   * 5. Call AI service
   * 6. Evaluate decisions via decision gate
   * 7. Execute auto-approved actions
   * 8. Create approval requests for gated actions
   * 9. Update conversation state
   * 10. Send response to patient
   */
  async processIncomingMessage(
    patientId: string,
    tenantId: string,
    conversationId: string,
    messageContent: string
  ): Promise<AgentResponse | null> {
    // 1. Get conversation and check if it's handled by nursing
    const conversation = await this.conversationService.findOne(
      conversationId,
      tenantId
    );

    if (conversation.handledBy === 'NURSING') {
      this.logger.log(
        `Conversation ${conversationId} handled by nursing, skipping agent`
      );
      return null;
    }

    // 2. Build clinical context
    const clinicalContext = await this.buildClinicalContext(
      patientId,
      tenantId
    );

    // 3. Get active protocol for the cancer type
    const protocol = await this.getActiveProtocol(
      tenantId,
      clinicalContext.patient.cancerType
    );

    // 4. Get recent conversation history
    const history = await this.conversationService.getRecentHistory(
      conversationId,
      20
    );

    // 5. Get agent config for tenant
    const agentConfig = await this.getAgentConfig(tenantId);

    // 6. Call AI service
    const aiResponse = await this.callAIService({
      message: messageContent,
      patientId,
      tenantId,
      clinicalContext,
      protocol,
      conversationHistory: history,
      agentState: conversation.agentState as Record<string, any> | null,
      agentConfig,
    });

    if (!aiResponse) {
      this.logger.warn('AI service returned no response');
      return null;
    }

    // 7. Evaluate decisions through decision gate
    const { autoApproved, needsApproval } = this.decisionGate.evaluate(
      aiResponse.decisions || []
    );

    // 8. Execute auto-approved actions
    for (const decision of autoApproved) {
      await this.executeDecision(decision, tenantId, patientId, conversationId);
    }

    // 9. Log all decisions
    for (const decision of [...autoApproved, ...needsApproval]) {
      await this.decisionGate.logDecision(
        tenantId,
        conversationId,
        patientId,
        decision
      );
    }

    // 10. Update conversation state
    if (aiResponse.newState) {
      await this.conversationService.updateState(
        conversationId,
        aiResponse.newState
      );
    }

    // 11. Send response to patient
    if (aiResponse.response) {
      await this.channelGateway.sendMessage(
        patientId,
        tenantId,
        aiResponse.response,
        conversation.channel,
        conversationId
      );
    }

    return aiResponse;
  }

  /**
   * Build complete clinical context for a patient
   */
  async buildClinicalContext(
    patientId: string,
    tenantId: string
  ): Promise<ClinicalContext> {
    const [
      patient,
      diagnoses,
      treatments,
      navigationSteps,
      recentAlerts,
      questionnaireResponses,
      observations,
    ] = await Promise.all([
      this.prisma.patient.findFirst({
        where: { id: patientId, tenantId },
      }),
      this.prisma.cancerDiagnosis.findMany({
        where: { patientId, tenantId, isActive: true },
        orderBy: { diagnosisDate: 'desc' },
        take: 10,
      }),
      this.prisma.treatment.findMany({
        where: { patientId, tenantId, isActive: true },
        orderBy: { startDate: 'desc' },
        take: 10,
      }),
      this.prisma.navigationStep.findMany({
        where: {
          patientId,
          tenantId,
          status: { in: ['PENDING', 'IN_PROGRESS', 'OVERDUE'] },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.prisma.alert.findMany({
        where: {
          patientId,
          tenantId,
          status: { in: ['PENDING', 'ACKNOWLEDGED'] },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.prisma.questionnaireResponse.findMany({
        where: { patientId, tenantId },
        orderBy: { completedAt: 'desc' },
        take: 5,
      }),
      this.prisma.observation.findMany({
        where: { patientId, tenantId },
        orderBy: { effectiveDateTime: 'desc' },
        take: 20,
      }),
    ]);

    return {
      patient: {
        id: patient?.id || patientId,
        name: patient?.name || 'Unknown',
        cancerType: patient?.cancerType || undefined,
        stage: patient?.stage || undefined,
        currentStage: patient?.currentStage || 'SCREENING',
        performanceStatus: patient?.performanceStatus || undefined,
        priorityScore: patient?.priorityScore || 0,
        priorityCategory: patient?.priorityCategory || 'LOW',
      },
      diagnoses,
      treatments,
      navigationSteps,
      recentAlerts,
      questionnaireResponses,
      observations,
    };
  }

  /**
   * Get active clinical protocol for a cancer type
   */
  private async getActiveProtocol(tenantId: string, cancerType?: string) {
    if (!cancerType) {
      return null;
    }

    return this.prisma.clinicalProtocol.findFirst({
      where: {
        tenantId,
        cancerType: cancerType.toLowerCase(),
        isActive: true,
      },
      orderBy: { version: 'desc' },
    });
  }

  /**
   * Get agent configuration for a tenant
   */
  private async getAgentConfig(tenantId: string) {
    return this.prisma.agentConfig.findUnique({
      where: { tenantId },
    });
  }

  /**
   * Call the AI service (Python FastAPI) to process the message
   */
  private async callAIService(request: {
    message: string;
    patientId: string;
    tenantId: string;
    clinicalContext: ClinicalContext;
    protocol: any;
    conversationHistory: any[];
    agentState: Record<string, any> | null;
    agentConfig: any;
  }): Promise<AgentResponse | null> {
    const aiServiceUrl =
      this.configService.get<string>('AI_SERVICE_URL') ||
      'http://localhost:8001';

    try {
      const response = await fetch(`${aiServiceUrl}/api/v1/agent/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: request.message,
          patient_id: request.patientId,
          tenant_id: request.tenantId,
          clinical_context: request.clinicalContext,
          protocol: request.protocol,
          conversation_history: request.conversationHistory.map((m) => ({
            role: m.direction === 'INBOUND' ? 'user' : 'assistant',
            content: m.content,
          })),
          agent_state: request.agentState || {},
          agent_config: request.agentConfig
            ? {
                llm_provider: request.agentConfig.llmProvider,
                llm_model: request.agentConfig.llmModel,
                agent_language: request.agentConfig.agentLanguage,
                max_auto_replies: request.agentConfig.maxAutoReplies,
              }
            : null,
        }),
        signal: AbortSignal.timeout(30000), // 30s timeout
      });

      if (!response.ok) {
        this.logger.error(
          `AI service returned ${response.status}: ${await response.text()}`
        );
        return null;
      }

      return await response.json();
    } catch (error) {
      this.logger.error('Failed to call AI service', error);
      return null;
    }
  }

  /**
   * Execute an auto-approved decision
   */
  private async executeDecision(
    decision: any,
    tenantId: string,
    patientId: string,
    conversationId: string
  ) {
    const actionType = decision.outputAction?.type;

    try {
      switch (actionType) {
        case 'RECORD_SYMPTOM':
          await this.recordSymptom(decision, tenantId, patientId);
          break;
        case 'CREATE_LOW_ALERT':
          await this.createAlert(decision, tenantId, patientId);
          break;
        case 'SCHEDULE_CHECK_IN':
        case 'CHECK_IN_SCHEDULED':
          await this.scheduleCheckIn(
            decision,
            tenantId,
            patientId,
            conversationId
          );
          break;
        case 'QUESTIONNAIRE_COMPLETE':
          await this.saveQuestionnaireResult(
            decision,
            tenantId,
            patientId,
            conversationId
          );
          break;
        case 'START_QUESTIONNAIRE':
        case 'CONTINUE_QUESTIONNAIRE':
        case 'PROTOCOL_ALERT':
        case 'RESPOND_TO_QUESTION':
          // These are handled by the orchestrator response or are informational
          this.logger.debug(`Action handled by orchestrator: ${actionType}`);
          break;
        default:
          this.logger.log(`No handler for action type: ${actionType}`);
      }
    } catch (error) {
      this.logger.error(`Failed to execute decision ${actionType}`, error);
    }
  }

  private async recordSymptom(
    decision: any,
    tenantId: string,
    patientId: string
  ) {
    const { code, display, value } = decision.outputAction.payload || {};
    if (!code || !display) {
      return;
    }

    await this.prisma.observation.create({
      data: {
        tenantId,
        patientId,
        code,
        display,
        valueString: String(value),
        effectiveDateTime: new Date(),
        status: 'final',
      },
    });
  }

  private async createAlert(
    decision: any,
    tenantId: string,
    patientId: string
  ) {
    const { type, severity, message } = decision.outputAction.payload || {};
    if (!type || !severity || !message) {
      return;
    }

    const alert = await this.prisma.alert.create({
      data: {
        tenantId,
        patientId,
        type,
        severity,
        message,
        context: decision.inputData,
      },
    });

    // Emit real-time alert
    this.alertsGateway.emitNewAlert(tenantId, alert);
  }

  private async scheduleCheckIn(
    decision: any,
    tenantId: string,
    patientId: string,
    conversationId: string
  ) {
    const payload = decision.outputAction?.payload || {};
    const frequency = payload.frequency || 'weekly';

    // Determine scheduledAt based on frequency
    const now = new Date();
    const frequencyDays: Record<string, number> = {
      daily: 1,
      twice_weekly: 3,
      weekly: 7,
      biweekly: 14,
      monthly: 30,
    };
    const daysAhead = frequencyDays[frequency] || 7;
    const scheduledAt = new Date(now);
    scheduledAt.setDate(scheduledAt.getDate() + daysAhead);

    await this.prisma.scheduledAction.create({
      data: {
        tenantId,
        patientId,
        conversationId,
        actionType: 'CHECK_IN',
        scheduledAt,
        payload: { frequency, ...payload },
      },
    });

    this.logger.log(
      `Scheduled ${frequency} check-in for patient ${patientId} at ${scheduledAt.toISOString()}`
    );
  }

  private async saveQuestionnaireResult(
    decision: any,
    tenantId: string,
    patientId: string,
    conversationId: string
  ) {
    const payload = decision.outputAction?.payload || {};
    const { questionnaireType, answers, scores } = payload;

    if (!questionnaireType || !answers) {
      return;
    }

    try {
      // Look up or create the Questionnaire template record
      const typeMap: Record<string, 'ESAS' | 'PRO_CTCAE' | 'CUSTOM'> = {
        ESAS: 'ESAS',
        PRO_CTCAE: 'PRO_CTCAE',
      };
      const prismaType = typeMap[questionnaireType] ?? 'CUSTOM';

      let questionnaire = await this.prisma.questionnaire.findFirst({
        where: { tenantId, type: prismaType },
      });

      if (!questionnaire) {
        questionnaire = await this.prisma.questionnaire.create({
          data: {
            tenantId,
            code: questionnaireType,
            name:
              questionnaireType === 'ESAS'
                ? 'ESAS - Edmonton Symptom Assessment'
                : 'PRO-CTCAE',
            type: prismaType,
            structure: {},
          },
        });
      }

      await this.prisma.questionnaireResponse.create({
        data: {
          tenantId,
          patientId,
          questionnaireId: questionnaire.id,
          conversationId,
          responses: answers,
          scores: scores || {},
          completedAt: new Date(),
        },
      });

      this.logger.log(
        `Saved ${questionnaireType} questionnaire for patient ${patientId}`
      );

      // If scores have high-severity alerts, emit a real-time alert
      const alerts: any[] = scores?.alerts || [];
      const hasHighAlerts = alerts.some(
        (a: any) => a.severity === 'HIGH' || a.severity === 'CRITICAL'
      );

      if (hasHighAlerts) {
        const alert = await this.prisma.alert.create({
          data: {
            tenantId,
            patientId,
            type: 'SCORE_CHANGE',
            severity: 'HIGH',
            message: `Pontuação alta no questionário ${questionnaireType}: ${scores?.interpretation || ''}`,
            context: { questionnaireType, scores, alerts },
          },
        });
        this.alertsGateway.emitNewAlert(tenantId, alert);
      }
    } catch (error) {
      this.logger.error('Failed to save questionnaire result', error);
    }
  }
}
