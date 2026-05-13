import {
  Injectable,
  Logger,
  Inject,
  forwardRef,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  getAiServiceConfig,
  getAiServiceHeadersWithTenant,
} from '../common/utils/ai-service.util';
import { PrismaService } from '../prisma/prisma.service';
import { ChannelGatewayService } from '../channel-gateway/channel-gateway.service';
import { ConversationService } from './conversation.service';
import { DecisionGateService } from './decision-gate.service';
import { AlertsGateway } from '../gateways/alerts.gateway';
import { PriorityRecalculationService } from '../oncology-navigation/priority-recalculation.service';
import { OncologyNavigationService } from '../oncology-navigation/oncology-navigation.service';
import { CreateConsultationAppointmentDto } from '../oncology-navigation/dto/create-consultation-appointment.dto';
import { UpdateNavigationStepDto } from '../oncology-navigation/dto/update-navigation-step.dto';
import { isConsultationStepKey } from '../oncology-navigation/consultation-step-keys';
import { PatientsService } from '../patients/patients.service';
import { CreatePatientDto, Gender } from '../patients/dto/create-patient.dto';
import { UpdatePatientDto } from '../patients/dto/update-patient.dto';
import {
  hashPhoneNumber,
  normalizePhoneNumber,
} from '../common/utils/phone.util';
import {
  AppointmentConfirmationStatus,
  HealthCoverageType,
  JourneyStage,
  NavigationStepStatus,
  Patient,
} from '@generated/prisma/client';
import {
  CANCEL_CONSULTATION_APPOINTMENT,
  CONFIRM_CONSULTATION_APPOINTMENT,
  CREATE_CONSULTATION_APPOINTMENT,
  RESCHEDULE_CONSULTATION_APPOINTMENT,
} from './scheduling-secretary.constants';
import { AgentSchedulingSecretaryError } from './scheduling-secretary.errors';
import {
  ClinicalContext,
  AgentResponse,
} from './interfaces/agent-decision.interface';
import { resolveNavigationStepIdForAgentQuestionnaire } from './questionnaire-navigation.helper';
import { mergeOutboundStructuredData } from './merge-outbound-structured-data';

/** Paciente mínimo criado pelo channel-gateway para conversas WhatsApp antes do cadastro completo (secretária). */
const WHATSAPP_INTAKE_STUB_PATIENT_NAME = 'Cadastro WhatsApp (incompleto)';

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => ChannelGatewayService))
    private readonly channelGateway: ChannelGatewayService,
    private readonly conversationService: ConversationService,
    private readonly decisionGate: DecisionGateService,
    private readonly alertsGateway: AlertsGateway,
    private readonly priorityRecalculationService: PriorityRecalculationService,
    @Inject(forwardRef(() => OncologyNavigationService))
    private readonly oncologyNavigationService: OncologyNavigationService,
    private readonly patientsService: PatientsService
  ) {}

  /**
   * Garante um registro de paciente no tenant para um número WhatsApp ainda não cadastrado.
   * `tenantId` deve vir exclusivamente da `WhatsAppConnection` (webhook assinado), nunca do cliente.
   */
  async ensureWhatsAppIntakePatient(
    tenantId: string,
    phoneRaw: string
  ): Promise<Patient | null> {
    const normalizedPhone = normalizePhoneNumber(phoneRaw);
    const phoneHash = hashPhoneNumber(phoneRaw);
    const existing = await this.prisma.patient.findFirst({
      where: { tenantId, phoneHash },
    });
    if (existing) {
      return existing;
    }
    try {
      return await this.patientsService.create(
        {
          name: WHATSAPP_INTAKE_STUB_PATIENT_NAME,
          birthDate: '1900-01-01',
          phone: normalizedPhone,
          currentStage: JourneyStage.SCREENING,
        } as CreatePatientDto,
        tenantId
      );
    } catch (err) {
      this.logger.warn(
        `ensureWhatsAppIntakePatient: falha ou corrida na criação; reconsultando hash (${tenantId})`,
        err instanceof Error ? err.stack : String(err)
      );
      return this.prisma.patient.findFirst({
        where: { tenantId, phoneHash },
      });
    }
  }

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
    messageContent: string,
    options?: {
      skipExternalSend?: boolean;
    }
  ): Promise<AgentResponse | null> {
    const skipExternalSend = options?.skipExternalSend === true;

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
      this.logger.warn(
        `AI service unavailable for conversation ${conversationId}. Sending fallback message to patient.`
      );
      // B2: Send a fallback message so the patient is not left without a response
      const fallbackMessage =
        'Olá! Estou com uma pequena instabilidade no momento. ' +
        'Por favor, aguarde alguns instantes ou entre em contato com a equipe de enfermagem em caso de urgência.';
      await this.channelGateway.sendMessage(
        patientId,
        tenantId,
        fallbackMessage,
        conversation.channel,
        conversationId,
        { skipExternalSend }
      );
      return null;
    }

    // A2: Validate AI response structure before using it.
    // A malformed response (missing `response` string) would silently send
    // nothing to the patient. Treat it like an unavailable AI service.
    if (
      typeof aiResponse !== 'object' ||
      (aiResponse.response !== undefined &&
        typeof aiResponse.response !== 'string')
    ) {
      this.logger.error(
        `AI service returned invalid response structure for conversation ${conversationId}: ` +
          JSON.stringify(aiResponse).substring(0, 200)
      );
      const fallbackMessage =
        'Olá! Recebi uma resposta inesperada do sistema. ' +
        'A equipe de enfermagem foi notificada e entrará em contato em breve.';
      await this.channelGateway.sendMessage(
        patientId,
        tenantId,
        fallbackMessage,
        conversation.channel,
        conversationId,
        { skipExternalSend }
      );
      return null;
    }

    // 7. Evaluate decisions through decision gate
    const decisions = aiResponse.decisions || [];
    const recordSymptomCount = decisions.filter(
      (d: any) => d?.outputAction?.type === 'RECORD_SYMPTOM'
    ).length;
    if (recordSymptomCount > 0) {
      this.logger.log(
        `AI returned ${recordSymptomCount} RECORD_SYMPTOM decision(s), total decisions: ${decisions.length}`
      );
    }

    const { autoApproved, needsApproval } = this.decisionGate.evaluate(
      decisions
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
    const responseText =
      aiResponse.response && aiResponse.response.trim().length > 0
        ? aiResponse.response
        : 'Sua mensagem foi registrada. Um membro da equipe de enfermagem será notificado para dar continuidade ao seu atendimento.';

    if (!aiResponse.response || aiResponse.response.trim().length === 0) {
      this.logger.warn(
        `AI service returned empty response for conversation ${conversationId}. Using fallback.`
      );
    }

    try {
      const symptomAnalysis = aiResponse.symptomAnalysis as
        | { structuredData?: unknown; structured_data?: unknown }
        | undefined;
      const baseStructured = (symptomAnalysis?.structuredData ??
        symptomAnalysis?.structured_data ?? {}) as Record<string, any>;

      // Enrich structuredData with symptoms from RECORD_SYMPTOM decisions
      const symptoms: Record<string, number> = {
        ...(baseStructured.symptoms || {}),
      };
      for (const d of autoApproved) {
        if (d?.outputAction?.type === 'RECORD_SYMPTOM') {
          const { display, value } = d.outputAction.payload || {};
          if (display) {
            const severityMap: Record<string, number> = {
              LOW: 3,
              MEDIUM: 5,
              HIGH: 8,
              CRITICAL: 10,
            };
            symptoms[display] = severityMap[value] || 5;
          }
        }
      }
      const structuredData = mergeOutboundStructuredData(
        baseStructured as Record<string, unknown>,
        symptoms,
        aiResponse.pipelineTrace
      );

      const alertTriggered = autoApproved.some(
        (d) =>
          d?.outputAction?.type === 'CREATE_LOW_ALERT' ||
          d?.outputAction?.type === 'CREATE_HIGH_CRITICAL_ALERT'
      );
      await this.channelGateway.sendMessage(
        patientId,
        tenantId,
        responseText,
        conversation.channel,
        conversationId,
        {
          skipExternalSend,
          structuredData: structuredData as unknown,
          alertTriggered,
        }
      );
    } catch (sendError) {
      this.logger.error(
        `Failed to send agent response for conversation ${conversationId}`,
        sendError instanceof Error ? sendError.stack : String(sendError)
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
      medications,
      comorbidities,
      performanceStatusHistory,
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
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
        take: 50,
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
      this.prisma.medication.findMany({
        where: { patientId, tenantId, isActive: true },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      this.prisma.comorbidity.findMany({
        where: { patientId, tenantId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.prisma.performanceStatusHistory.findMany({
        where: { patientId, tenantId },
        orderBy: { assessedAt: 'desc' },
        take: 5,
      }),
    ]);

    const currentStage = patient?.currentStage || 'SCREENING';
    const stepsInCurrentPhase = (navigationSteps || []).filter(
      (s: { journeyStage?: string }) => s.journeyStage === currentStage,
    );

    return {
      patient: {
        id: patient?.id || patientId,
        name: patient?.name || 'Unknown',
        cancerType: patient?.cancerType || undefined,
        stage: patient?.stage || undefined,
        currentStage,
        performanceStatus: patient?.performanceStatus || undefined,
        priorityScore: patient?.priorityScore || 0,
        priorityCategory: patient?.priorityCategory || 'LOW',
        clinicalDisposition: patient?.clinicalDisposition || undefined,
      },
      diagnoses,
      treatments,
      navigationSteps: stepsInCurrentPhase,
      recentAlerts,
      questionnaireResponses,
      observations,
      medications: medications || [],
      comorbidities: comorbidities || [],
      performanceStatusHistory: performanceStatusHistory || [],
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
    const { aiServiceUrl, headers: aiHeaders } = getAiServiceConfig(this.configService);

    try {
      const response = await fetch(`${aiServiceUrl}/api/v1/agent/process`, {
        method: 'POST',
        headers: aiHeaders,
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
                llm_fallback_provider: request.agentConfig.llmFallbackProvider,
                llm_fallback_model: request.agentConfig.llmFallbackModel,
                agent_language: request.agentConfig.agentLanguage,
                max_auto_replies: request.agentConfig.maxAutoReplies,
              }
            : null,
        }),
        signal: AbortSignal.timeout(120_000), // 120s timeout — multi-agent pipeline can be slow
      });

      if (!response.ok) {
        this.logger.error(
          `AI service returned ${response.status}: ${await response.text()}`
        );
        return null;
      }

      const raw = await response.json();
      return this.normalizeAIServiceResponse(raw);
    } catch (error) {
      this.logger.error('Failed to call AI service', error);
      return null;
    }
  }

  private normalizeAIServiceResponse(raw: any): AgentResponse {
    const rawDecisions = Array.isArray(raw?.decisions) ? raw.decisions : [];

    return {
      response: typeof raw?.response === 'string' ? raw.response : '',
      actions: Array.isArray(raw?.actions) ? raw.actions : [],
      symptomAnalysis:
        raw?.symptomAnalysis ?? raw?.symptom_analysis ?? undefined,
      newState: raw?.newState ?? raw?.new_state ?? undefined,
      pipelineTrace:
        raw?.pipelineTrace ?? raw?.pipeline_trace ?? undefined,
      decisions: rawDecisions.map((decision: any) => ({
        ...decision,
        // Compatibilidade com ai-service legado ainda não reiniciado
        decisionType:
          decision?.decisionType === 'APPLY_QUESTIONNAIRE'
            ? 'QUESTIONNAIRE_STARTED'
            : decision?.decisionType,
      })),
    };
  }

  /**
   * Execute a decision that was manually approved by a nurse/admin.
   * Called from the controller after DecisionGateService.approveDecision().
   */
  async executeApprovedDecision(decisionLog: {
    tenantId: string;
    patientId: string;
    conversationId: string;
    outputAction: Record<string, any> | null;
    inputData: Record<string, any> | null;
  }) {
    if (!decisionLog.outputAction) {
      this.logger.warn(
        `Approved decision has no outputAction, skipping execution`
      );
      return;
    }

    const decision = {
      outputAction: decisionLog.outputAction,
      inputData: decisionLog.inputData || {},
    };

    this.logger.log(
      `Executing approved decision: ${decision.outputAction.type} for patient ${decisionLog.patientId}`
    );

    await this.executeDecision(
      decision,
      decisionLog.tenantId,
      decisionLog.patientId,
      decisionLog.conversationId
    );
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
        case 'CREATE_HIGH_CRITICAL_ALERT':
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
        case 'CHANGE_TREATMENT_STATUS':
          await this.changeTreatmentStatus(decision, tenantId, patientId);
          break;
        case 'RECOMMEND_APPOINTMENT':
          await this.recommendAppointment(
            decision,
            tenantId,
            patientId,
            conversationId
          );
          break;
        case 'HANDOFF_TO_SPECIALIST':
          await this.handoffToSpecialist(
            decision,
            tenantId,
            patientId,
            conversationId
          );
          break;
        case 'CRITICAL_ESCALATION':
          await this.criticalEscalation(decision, tenantId, patientId);
          break;
        case 'UPDATE_NAVIGATION_STEP':
          await this.updateNavigationStep(
            decision,
            tenantId,
            patientId
          );
          break;
        case 'SEND_REMINDER':
          await this.sendReminder(
            decision,
            tenantId,
            patientId,
            conversationId
          );
          break;
        case 'RECALCULATE_PRIORITY':
          await this.priorityRecalculationService.recalculate(
            patientId,
            tenantId
          );
          break;
        case CREATE_CONSULTATION_APPOINTMENT:
          await this.executeCreateConsultationAppointment(
            decision,
            tenantId,
            patientId,
            conversationId
          );
          break;
        case RESCHEDULE_CONSULTATION_APPOINTMENT:
          await this.executeRescheduleConsultationAppointment(
            decision,
            tenantId,
            patientId
          );
          break;
        case CANCEL_CONSULTATION_APPOINTMENT:
          await this.executeCancelConsultationAppointment(
            decision,
            tenantId,
            patientId
          );
          break;
        case CONFIRM_CONSULTATION_APPOINTMENT:
          await this.executeConfirmConsultationAppointment(
            decision,
            tenantId,
            patientId
          );
          break;
        case 'UPDATE_CLINICAL_DISPOSITION':
          await this.updateClinicalDisposition(decision, tenantId, patientId);
          break;
        case 'START_QUESTIONNAIRE':
        case 'CONTINUE_QUESTIONNAIRE':
        case 'PROTOCOL_ALERT':
        case 'RESPOND_TO_QUESTION':
        case 'GREETING_RESPONSE':
          // These are handled by the orchestrator response or are informational
          this.logger.debug(`Action handled by orchestrator: ${actionType}`);
          break;
        default:
          this.logger.log(`No handler for action type: ${actionType}`);
      }
    } catch (error) {
      if (error instanceof AgentSchedulingSecretaryError) {
        this.logger.warn(
          `Scheduling secretary [${error.code}]: ${error.message}`
        );
      } else {
        this.logger.error(`Failed to execute decision ${actionType}`, error);
      }
    }
  }

  private schedulingPayload(
    decision: { outputAction?: { payload?: unknown } } | null
  ): Record<string, unknown> {
    const raw = decision?.outputAction?.payload;
    return raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  }

  private navigationStepIdFromPayload(
    p: Record<string, unknown>
  ): string | null {
    const raw =
      p.navigationStepId ?? p.navigation_step_id ?? p.stepId ?? p.step_id;
    return typeof raw === 'string' && this.isUuidString(raw) ? raw : null;
  }

  private isUuidString(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    );
  }

  private mergeConsultationMetadata(
    outputPayload: Record<string, unknown>,
    conversationId: string
  ): Record<string, unknown> | undefined {
    const meta = outputPayload.metadata;
    const base =
      meta && typeof meta === 'object' && !Array.isArray(meta)
        ? { ...(meta as Record<string, unknown>) }
        : {};
    delete base.tenantId;
    delete base.tenant_id;
    delete base.patientId;
    delete base.patient_id;
    return {
      ...base,
      source: 'agent_scheduling_secretary',
      conversationId,
    };
  }

  private async assertConsultationStepOwned(
    navigationStepId: string,
    tenantId: string,
    patientId: string
  ) {
    const step = await this.prisma.navigationStep.findFirst({
      where: { id: navigationStepId, tenantId, patientId },
    });
    if (!step) {
      throw new AgentSchedulingSecretaryError(
        'Etapa de navegação não encontrada ou não pertence ao paciente.',
        'NAVIGATION_STEP_NOT_FOUND'
      );
    }
    if (!isConsultationStepKey(step.stepKey)) {
      throw new AgentSchedulingSecretaryError(
        'A etapa indicada não é uma consulta agendável.',
        'INVALID_STATE'
      );
    }
    if (step.status === NavigationStepStatus.CANCELLED) {
      throw new AgentSchedulingSecretaryError(
        'Consulta já cancelada.',
        'INVALID_STATE'
      );
    }
    return step;
  }

  private async resolveTargetPatientIdForConsultationCreate(
    tenantId: string,
    contextPatientId: string,
    payload: Record<string, unknown>,
    journeyStageRaw: string
  ): Promise<string> {
    const np = payload.newPatient ?? payload.patientIntake ?? payload.patient_intake;
    if (np !== undefined && np !== null) {
      if (typeof np !== 'object' || Array.isArray(np)) {
        throw new AgentSchedulingSecretaryError(
          'Payload de novo paciente inválido.',
          'INCOMPLETE_PAYLOAD'
        );
      }
      const o = np as Record<string, unknown>;
      const phone =
        typeof o.phone === 'string' ? o.phone.trim() : '';
      if (!phone) {
        throw new AgentSchedulingSecretaryError(
          'Telefone obrigatório para cadastro rápido.',
          'INCOMPLETE_PAYLOAD'
        );
      }
      const existing = await this.patientsService.findByPhone(phone, tenantId);
      if (existing) {
        if (existing.id !== contextPatientId) {
          throw new AgentSchedulingSecretaryError(
            'Telefone já vinculado a outro cadastro no mesmo hospital.',
            'PATIENT_PHONE_CONFLICT'
          );
        }
        await this.applySchedulingNewPatientOntoIntakeStubIfNeeded(
          existing.id,
          tenantId,
          o,
          journeyStageRaw
        );
        return existing.id;
      }
      const createDto = this.mapNewPatientPayload(o, journeyStageRaw);
      const created = await this.patientsService.create(createDto, tenantId);
      return created.id;
    }

    const p = await this.prisma.patient.findFirst({
      where: { id: contextPatientId, tenantId },
      select: { id: true },
    });
    if (!p) {
      throw new AgentSchedulingSecretaryError(
        'Paciente não encontrado.',
        'PATIENT_NOT_FOUND'
      );
    }
    return contextPatientId;
  }

  private mapNewPatientPayload(
    raw: Record<string, unknown>,
    journeyStageRaw: string
  ): CreatePatientDto {
    let gender: Gender | undefined;
    if (typeof raw.gender === 'string') {
      const g = raw.gender.toLowerCase();
      if (g === 'male' || g === 'female' || g === 'other') {
        gender = g as Gender;
      }
    }
    const coverageRaw = raw.healthCoverageType;
    let healthCoverageType: HealthCoverageType | undefined;
    if (
      coverageRaw === HealthCoverageType.PRIVATE ||
      coverageRaw === HealthCoverageType.HEALTH_PLAN
    ) {
      healthCoverageType = coverageRaw;
    } else if (typeof coverageRaw === 'string') {
      const up = coverageRaw.toUpperCase();
      if (up === 'PRIVATE' || up === 'PARTICULAR') {
        healthCoverageType = HealthCoverageType.PRIVATE;
      } else if (up === 'HEALTH_PLAN' || up === 'PLANO') {
        healthCoverageType = HealthCoverageType.HEALTH_PLAN;
      }
    }

    const journeyUpper = String(journeyStageRaw || 'SCREENING').toUpperCase();
    const currentStage = Object.values(JourneyStage).includes(
      journeyUpper as JourneyStage
    )
      ? (journeyUpper as JourneyStage)
      : JourneyStage.SCREENING;

    return {
      name: String(raw.name).trim(),
      birthDate: String(raw.birthDate),
      phone: normalizePhoneNumber(String(raw.phone).trim()),
      email:
        typeof raw.email === 'string' && raw.email.trim().length > 0
          ? raw.email.trim()
          : undefined,
      cpf:
        typeof raw.cpf === 'string' && raw.cpf.trim().length > 0
          ? raw.cpf.trim()
          : undefined,
      gender,
      currentStage,
      healthCoverageType,
      healthPlanName:
        typeof raw.healthPlanName === 'string'
          ? raw.healthPlanName
          : undefined,
      insuranceMemberId:
        typeof raw.insuranceMemberId === 'string'
          ? raw.insuranceMemberId
          : undefined,
    };
  }

  /**
   * Quando a conversa está ligada ao cadastro mínimo do WhatsApp e o agente envia `newPatient`
   * com dados completos, atualiza o registro para não ficar preso em nome/data placeholder.
   */
  private async applySchedulingNewPatientOntoIntakeStubIfNeeded(
    patientId: string,
    tenantId: string,
    newPatientFields: Record<string, unknown>,
    journeyStageRaw: string
  ): Promise<void> {
    const row = await this.prisma.patient.findFirst({
      where: { id: patientId, tenantId },
      select: { name: true },
    });
    if (!row || row.name !== WHATSAPP_INTAKE_STUB_PATIENT_NAME) {
      return;
    }
    const dto = this.mapNewPatientPayload(newPatientFields, journeyStageRaw);
    const patch: UpdatePatientDto = {
      name: dto.name,
      birthDate: dto.birthDate,
      phone: dto.phone,
      email: dto.email,
      cpf: dto.cpf,
      gender: dto.gender,
      currentStage: dto.currentStage,
      healthCoverageType: dto.healthCoverageType,
      healthPlanName: dto.healthPlanName,
      insuranceMemberId: dto.insuranceMemberId,
    };
    await this.patientsService.update(patientId, patch, tenantId);
  }

  private async executeCreateConsultationAppointment(
    decision: { outputAction?: { payload?: unknown } },
    tenantId: string,
    patientId: string,
    conversationId: string
  ) {
    const payload = this.schedulingPayload(decision);
    const journeyStageRaw = String(payload.journeyStage || '').trim();
    if (
      !this.isUuidString(String(payload.scheduledProfessionalId || '')) ||
      !journeyStageRaw
    ) {
      throw new AgentSchedulingSecretaryError(
        'Dados insuficientes para criar consulta.',
        'INCOMPLETE_PAYLOAD'
      );
    }

    const targetPatientId = await this.resolveTargetPatientIdForConsultationCreate(
      tenantId,
      patientId,
      payload,
      journeyStageRaw
    );

    const journeyStage = journeyStageRaw.toUpperCase() as JourneyStage;
    if (!Object.values(JourneyStage).includes(journeyStage)) {
      throw new AgentSchedulingSecretaryError(
        'Fase da jornada inválida.',
        'INCOMPLETE_PAYLOAD'
      );
    }

    const dto = {
      patientId: targetPatientId,
      journeyStage,
      stepKey: String(payload.stepKey).trim(),
      stepName: String(payload.stepName).trim(),
      expectedDate: String(payload.expectedDate),
      scheduledProfessionalId: String(payload.scheduledProfessionalId),
      stepDescription:
        typeof payload.stepDescription === 'string'
          ? payload.stepDescription
          : undefined,
      metadata: this.mergeConsultationMetadata(payload, conversationId),
      cancerType:
        typeof payload.cancerType === 'string' ? payload.cancerType : undefined,
    } as CreateConsultationAppointmentDto;

    try {
      await this.oncologyNavigationService.createConsultationAppointment(
        dto,
        tenantId,
        undefined
      );
      this.logger.log(
        `CREATE_CONSULTATION_APPOINTMENT ok for patient ${targetPatientId} (tenant-scoped)`
      );
    } catch (err) {
      if (err instanceof BadRequestException) {
        throw new AgentSchedulingSecretaryError(
          err.message || 'Validação da agenda falhou.',
          'INVALID_STATE'
        );
      }
      throw err;
    }
  }

  private async executeRescheduleConsultationAppointment(
    decision: { outputAction?: { payload?: unknown } },
    tenantId: string,
    patientId: string
  ) {
    const payload = this.schedulingPayload(decision);
    const stepId = this.navigationStepIdFromPayload(payload);
    const whenRaw =
      payload.newExpectedDate ??
      payload.expectedDate ??
      payload.rescheduledExpectedDate;
    if (!stepId || typeof whenRaw !== 'string' || !whenRaw.trim()) {
      throw new AgentSchedulingSecretaryError(
        'navigationStepId e nova data são obrigatórios.',
        'INCOMPLETE_PAYLOAD'
      );
    }
    await this.assertConsultationStepOwned(stepId, tenantId, patientId);

    const updateDto: UpdateNavigationStepDto = {
      expectedDate: whenRaw.trim(),
    };
    if (
      typeof payload.scheduledProfessionalId === 'string' &&
      this.isUuidString(payload.scheduledProfessionalId)
    ) {
      updateDto.scheduledProfessionalId = payload.scheduledProfessionalId;
    }

    try {
      await this.oncologyNavigationService.updateStep(
        stepId,
        updateDto,
        tenantId,
        undefined
      );
      this.logger.log(
        `RESCHEDULE_CONSULTATION_APPOINTMENT ok step=${stepId} patient=${patientId}`
      );
    } catch (err) {
      if (err instanceof BadRequestException) {
        throw new AgentSchedulingSecretaryError(
          err.message || 'Não foi possível reagendar (slot ou regra da agenda).',
          'INVALID_STATE'
        );
      }
      throw err;
    }
  }

  private async executeCancelConsultationAppointment(
    decision: { outputAction?: { payload?: unknown } },
    tenantId: string,
    patientId: string
  ) {
    const payload = this.schedulingPayload(decision);
    const stepId = this.navigationStepIdFromPayload(payload);
    if (!stepId) {
      throw new AgentSchedulingSecretaryError(
        'navigationStepId é obrigatório para cancelar.',
        'INCOMPLETE_PAYLOAD'
      );
    }
    await this.assertConsultationStepOwned(stepId, tenantId, patientId);

    const updateDto: UpdateNavigationStepDto = {
      status: NavigationStepStatus.CANCELLED,
    };
    if (typeof payload.cancelReason === 'string' && payload.cancelReason.trim()) {
      updateDto.notes = `[Agent] ${payload.cancelReason.trim().slice(0, 2000)}`;
    }

    await this.oncologyNavigationService.updateStep(
      stepId,
      updateDto,
      tenantId,
      undefined
    );
    this.logger.log(
      `CANCEL_CONSULTATION_APPOINTMENT ok step=${stepId} patient=${patientId}`
    );
  }

  private async executeConfirmConsultationAppointment(
    decision: { outputAction?: { payload?: unknown } },
    tenantId: string,
    patientId: string
  ) {
    const payload = this.schedulingPayload(decision);
    const stepId = this.navigationStepIdFromPayload(payload);
    if (!stepId) {
      throw new AgentSchedulingSecretaryError(
        'navigationStepId é obrigatório para confirmar.',
        'INCOMPLETE_PAYLOAD'
      );
    }
    await this.assertConsultationStepOwned(stepId, tenantId, patientId);

    await this.oncologyNavigationService.updateStep(
      stepId,
      {
        appointmentConfirmationStatus:
          AppointmentConfirmationStatus.CONFIRMED,
      },
      tenantId,
      undefined
    );
    this.logger.log(
      `CONFIRM_CONSULTATION_APPOINTMENT ok step=${stepId} patient=${patientId}`
    );
  }

  private async updateClinicalDisposition(
    decision: any,
    tenantId: string,
    patientId: string
  ) {
    const { disposition, reason } = decision.outputAction?.payload || {};
    if (!disposition) {
      this.logger.warn(`updateClinicalDisposition skipped: missing disposition`);
      return;
    }

    this.logger.log(
      `Updating clinical disposition: ${disposition} for patient ${patientId}`
    );

    await this.prisma.patient.update({
      where: { id: patientId, tenantId },
      data: {
        clinicalDisposition: disposition,
        clinicalDispositionAt: new Date(),
        clinicalDispositionReason: reason || null,
      },
    });
  }

  private async recordSymptom(
    decision: any,
    tenantId: string,
    patientId: string
  ) {
    const { code, display, value } = decision.outputAction.payload || {};
    if (!code || !display) {
      this.logger.warn(
        `recordSymptom skipped: missing code or display in payload`
      );
      return;
    }

    this.logger.log(
      `Registering symptom: code=${code} display=${display} value=${value} patientId=${patientId}`
    );

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

    this.priorityRecalculationService.triggerRecalculation(patientId, tenantId);
  }

  private mapToAlertType(agentType: string): string {
    const mapping: Record<string, string> = {
      AI_DETECTED_ALERT: 'CRITICAL_SYMPTOM',
      NURSING_ESCALATION: 'SYMPTOM_WORSENING',
      SYMPTOM_ALERT: 'CRITICAL_SYMPTOM',
      PAIN_ALERT: 'CRITICAL_SYMPTOM',
      EMERGENCY_ALERT: 'CRITICAL_SYMPTOM',
    };
    // If the agent already returns a valid AlertType, use it directly
    const validTypes = [
      'CRITICAL_SYMPTOM',
      'NO_RESPONSE',
      'DELAYED_APPOINTMENT',
      'SCORE_CHANGE',
      'SYMPTOM_WORSENING',
      'NAVIGATION_DELAY',
      'MISSING_EXAM',
      'STAGING_INCOMPLETE',
      'TREATMENT_DELAY',
      'FOLLOW_UP_OVERDUE',
      'PALLIATIVE_SYMPTOM_WORSENING',
      'PALLIATIVE_MEDICATION_ADJUSTMENT',
      'PALLIATIVE_FAMILY_SUPPORT',
      'PALLIATIVE_PSYCHOSOCIAL',
      'QUESTIONNAIRE_ALERT',
    ];
    if (validTypes.includes(agentType)) {return agentType;}
    return mapping[agentType] || 'CRITICAL_SYMPTOM';
  }

  private async createAlert(
    decision: any,
    tenantId: string,
    patientId: string
  ) {
    const { type, severity, message } = decision.outputAction.payload || {};
    if (!type || !severity || !message) {
      this.logger.warn(
        `createAlert skipped: missing type, severity or message in payload`
      );
      return;
    }

    const mappedType = this.mapToAlertType(type);
    this.logger.log(
      `Creating alert: type=${type} → ${mappedType} severity=${severity} patientId=${patientId}`
    );

    const alert = await this.prisma.alert.create({
      data: {
        tenantId,
        patientId,
        type: mappedType as any,
        severity,
        message,
        context: decision.inputData,
      },
    });

    // Emit real-time alert (critical gets dedicated event for dashboard)
    if (alert.severity === 'CRITICAL') {
      this.alertsGateway.emitCriticalAlert(tenantId, alert);
    }
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

    // Determine scheduledAt: payload.days (from agendar_checkin) or frequency map (from protocol)
    const now = new Date();
    const frequencyDays: Record<string, number> = {
      daily: 1,
      twice_weekly: 3,
      weekly: 7,
      biweekly: 14,
      monthly: 30,
    };
    const daysAhead =
      typeof payload.days === 'number' && payload.days >= 1 && payload.days <= 365
        ? payload.days
        : frequencyDays[frequency] || 7;
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

  private async changeTreatmentStatus(
    decision: any,
    tenantId: string,
    patientId: string
  ) {
    const { treatmentId, newStatus, reason } =
      decision.outputAction?.payload || {};
    if (!treatmentId || !newStatus) {
      this.logger.warn(
        'CHANGE_TREATMENT_STATUS missing treatmentId or newStatus'
      );
      return;
    }

    const treatment = await this.prisma.treatment.findFirst({
      where: { id: treatmentId, patientId, tenantId },
    });

    if (!treatment) {
      this.logger.warn(
        `Treatment ${treatmentId} not found for patient ${patientId}`
      );
      return;
    }

    await this.prisma.treatment.update({
      where: { id: treatmentId, tenantId },
      data: {
        status: newStatus,
        notes: reason
          ? `${treatment.notes ? treatment.notes + '\n' : ''}[Agent] ${reason}`
          : treatment.notes,
      },
    });

    this.logger.log(
      `Treatment ${treatmentId} status changed to ${newStatus} for patient ${patientId}`
    );
  }

  private async recommendAppointment(
    decision: any,
    tenantId: string,
    patientId: string,
    conversationId: string
  ) {
    const payload = decision.outputAction?.payload || {};
    const { reason, urgency, specialty } = payload;

    const scheduledAt = new Date();
    scheduledAt.setDate(scheduledAt.getDate() + (urgency === 'URGENT' ? 1 : 7));

    await this.prisma.scheduledAction.create({
      data: {
        tenantId,
        patientId,
        conversationId,
        actionType: 'APPOINTMENT_REMINDER',
        scheduledAt,
        payload: { reason, urgency, specialty, ...payload },
      },
    });

    // Create an informational alert for the nursing team
    const severity = urgency === 'URGENT' ? 'HIGH' : 'MEDIUM';
    const alert = await this.prisma.alert.create({
      data: {
        tenantId,
        patientId,
        type: 'NAVIGATION_DELAY',
        severity,
        message: `Consulta recomendada${specialty ? ` com ${specialty}` : ''}${reason ? `: ${reason}` : ''}`,
        context: decision.inputData,
      },
    });

    this.alertsGateway.emitNewAlert(tenantId, alert);
    this.logger.log(
      `Appointment recommended for patient ${patientId} (urgency: ${urgency})`
    );
  }

  private async handoffToSpecialist(
    decision: any,
    tenantId: string,
    patientId: string,
    conversationId: string
  ) {
    const payload = decision.outputAction?.payload || {};
    const { specialistType, reason } = payload;

    // Escalate the conversation to nursing/specialist
    await this.prisma.conversation.update({
      where: { id: conversationId, tenantId },
      data: {
        handledBy: 'NURSING',
        status: 'WAITING',
      },
    });

    const alert = await this.prisma.alert.create({
      data: {
        tenantId,
        patientId,
        type: 'NAVIGATION_DELAY',
        severity: 'HIGH',
        message: `Paciente necessita de encaminhamento${specialistType ? ` para ${specialistType}` : ''}${reason ? `: ${reason}` : ''}`,
        context: decision.inputData,
      },
    });

    this.alertsGateway.emitNewAlert(tenantId, alert);
    this.logger.log(
      `Conversation ${conversationId} handed off to specialist for patient ${patientId}`
    );
  }

  private async criticalEscalation(
    decision: any,
    tenantId: string,
    patientId: string
  ) {
    const payload = decision.outputAction?.payload || {};
    const { message, symptoms } = payload;

    const alert = await this.prisma.alert.create({
      data: {
        tenantId,
        patientId,
        type: 'CRITICAL_SYMPTOM',
        severity: 'CRITICAL',
        message:
          message ||
          'Sintomas críticos detectados. Avaliação imediata necessária.',
        context: { ...decision.inputData, symptoms },
      },
    });

    this.alertsGateway.emitNewAlert(tenantId, alert);
    this.logger.warn(
      `CRITICAL escalation created for patient ${patientId}: ${alert.id}`
    );
  }

  private async updateNavigationStep(
    decision: any,
    tenantId: string,
    patientId: string
  ) {
    const payload = decision.outputAction?.payload || {};
    const { stepId, stepKey, status, isCompleted } = payload;

    let resolvedStepId = stepId;
    if (!resolvedStepId && stepKey) {
      const step = await this.prisma.navigationStep.findFirst({
        where: {
          tenantId,
          patientId,
          stepKey: String(stepKey),
          status: { in: ['PENDING', 'IN_PROGRESS', 'OVERDUE'] },
        },
        orderBy: { dueDate: 'asc' },
        select: { id: true },
      });
      resolvedStepId = step?.id;
    }

    if (!resolvedStepId) {
      this.logger.warn(
        'UPDATE_NAVIGATION_STEP missing stepId or unresolvable stepKey in payload, skipping'
      );
      return;
    }

    const validStatuses = [
      'PENDING',
      'IN_PROGRESS',
      'COMPLETED',
      'OVERDUE',
      'CANCELLED',
      'NOT_APPLICABLE',
    ];
    const updateData: Record<string, any> = {};

    if (status && validStatuses.includes(String(status).toUpperCase())) {
      updateData.status = String(status).toUpperCase();
    }
    if (typeof isCompleted === 'boolean') {
      updateData.isCompleted = isCompleted;
      if (isCompleted) {
        updateData.completedAt = new Date();
      }
    }

    if (Object.keys(updateData).length === 0) {
      this.logger.warn(
        'UPDATE_NAVIGATION_STEP payload has no status or isCompleted, skipping'
      );
      return;
    }

    const updated = await this.prisma.navigationStep.updateMany({
      where: {
        id: resolvedStepId,
        tenantId,
        patientId,
      },
      data: updateData,
    });

    if (updated.count === 0) {
      this.logger.warn(
        `UPDATE_NAVIGATION_STEP step ${resolvedStepId} not found or not owned by patient ${patientId}`
      );
      return;
    }

    this.logger.log(
      `Updated navigation step ${resolvedStepId} for patient ${patientId}: ${JSON.stringify(updateData)}`
    );
  }

  private async sendReminder(
    decision: any,
    tenantId: string,
    patientId: string,
    conversationId: string
  ) {
    const payload = decision.outputAction?.payload || {};
    const {
      message,
      scheduledAt,
      daysFromNow,
      actionType = 'FOLLOW_UP',
    } = payload;

    if (!message || typeof message !== 'string') {
      this.logger.warn(
        'SEND_REMINDER missing message (string) in payload, skipping'
      );
      return;
    }

    const validActionTypes = [
      'FOLLOW_UP',
      'APPOINTMENT_REMINDER',
      'MEDICATION_REMINDER',
    ];
    const finalActionType = validActionTypes.includes(
      String(actionType).toUpperCase()
    )
      ? (String(actionType).toUpperCase() as 'FOLLOW_UP' | 'APPOINTMENT_REMINDER' | 'MEDICATION_REMINDER')
      : 'FOLLOW_UP';

    let scheduledDate: Date;
    if (scheduledAt) {
      scheduledDate = new Date(scheduledAt);
      if (isNaN(scheduledDate.getTime())) {
        this.logger.warn(
          'SEND_REMINDER invalid scheduledAt, using daysFromNow default'
        );
        scheduledDate = new Date();
        scheduledDate.setDate(scheduledDate.getDate() + 1);
      }
    } else {
      const days =
        typeof daysFromNow === 'number' && daysFromNow >= 0
          ? daysFromNow
          : 1;
      scheduledDate = new Date();
      scheduledDate.setDate(scheduledDate.getDate() + days);
    }

    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
      select: { channel: true },
    });
    const channel = conv?.channel ?? 'WHATSAPP';

    await this.prisma.scheduledAction.create({
      data: {
        tenantId,
        patientId,
        conversationId,
        actionType: finalActionType,
        channel,
        scheduledAt: scheduledDate,
        payload: { message, ...payload },
      },
    });

    this.logger.log(
      `Scheduled ${finalActionType} reminder for patient ${patientId} at ${scheduledDate.toISOString()}`
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

      const navigationStepId =
        await resolveNavigationStepIdForAgentQuestionnaire(
          this.prisma,
          tenantId,
          patientId
        );

      await this.prisma.questionnaireResponse.create({
        data: {
          tenantId,
          patientId,
          questionnaireId: questionnaire.id,
          conversationId,
          responses: answers,
          scores: scores || {},
          completedAt: new Date(),
          navigationStepId,
        },
      });

      this.priorityRecalculationService.triggerRecalculation(
        patientId,
        tenantId
      );

      this.logger.log(
        `Saved ${questionnaireType} questionnaire for patient ${patientId}` +
          (navigationStepId ? ` (navigationStepId=${navigationStepId})` : '')
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

  /**
   * Get AI-powered nurse assistance for a conversation.
   * Provides: summary, suggested replies, suggested actions.
   */
  async getNurseAssistance(
    conversationId: string,
    tenantId: string
  ): Promise<any> {
    const conversation = await this.conversationService.findOne(
      conversationId,
      tenantId
    );

    const patientId = conversation.patientId;
    const clinicalContext = await this.buildClinicalContext(patientId, tenantId);

    const history = await this.conversationService.getRecentHistory(
      conversationId,
      20
    );

    const agentConfig = await this.getAgentConfig(tenantId);

    const conversationHistory = history.map((msg: any) => ({
      role:
        msg.direction === 'INBOUND'
          ? 'patient'
          : msg.processedBy === 'NURSING'
            ? 'nursing'
            : 'agent',
      content: msg.content || '',
      timestamp: msg.createdAt?.toISOString(),
    }));

    const recentSymptoms: string[] = [];
    for (const msg of history) {
      if (msg.criticalSymptomsDetected && Array.isArray(msg.criticalSymptomsDetected)) {
        for (const s of msg.criticalSymptomsDetected) {
          if (typeof s === 'string' && !recentSymptoms.includes(s)) {
            recentSymptoms.push(s);
          }
        }
      }
    }

    let esasScores: Record<string, any> | undefined;
    if (clinicalContext.questionnaireResponses?.length > 0) {
      const latestQr = clinicalContext.questionnaireResponses[0];
      if (latestQr.scores && typeof latestQr.scores === 'object') {
        esasScores = latestQr.scores as Record<string, any>;
      }
    }

    const payload = {
      patient_id: patientId,
      patient_name: clinicalContext.patient.name,
      cancer_type: clinicalContext.patient.cancerType || null,
      stage: clinicalContext.patient.stage || null,
      performance_status: clinicalContext.patient.performanceStatus ?? null,
      priority_score: clinicalContext.patient.priorityScore || 0,
      priority_category: clinicalContext.patient.priorityCategory || 'LOW',
      current_stage: clinicalContext.patient.currentStage || null,
      conversation_history: conversationHistory,
      navigation_steps: (clinicalContext.navigationSteps || []).map((s: any) => ({
        step_key: s.stepKey || s.id,
        step_name: s.stepName || s.name || 'Step',
        status: s.status,
        is_required: s.isRequired ?? true,
        expected_date: s.expectedDate?.toISOString() || null,
        due_date: s.dueDate?.toISOString() || null,
        completed_at: s.completedAt?.toISOString() || null,
      })),
      recent_symptoms: recentSymptoms,
      esas_scores: esasScores || null,
      alerts: (clinicalContext.recentAlerts || []).map(
        (a: any) => `[${a.severity}] ${a.message}`
      ),
    };

    const { aiServiceUrl, headers: aiHeaders } = getAiServiceConfig(this.configService);

    try {
      const response = await fetch(`${aiServiceUrl}/api/v1/agent/nurse-assist`, {
        method: 'POST',
        headers: aiHeaders,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(120_000),
      });

      if (!response.ok) {
        this.logger.warn(
          `AI nurse-assist returned ${response.status}: ${response.statusText}`
        );
        return this.buildFallbackNurseAssist(clinicalContext, conversationHistory);
      }

      return response.json();
    } catch (error) {
      this.logger.error(`Failed to call nurse-assist AI: ${error.message}`);
      return this.buildFallbackNurseAssist(clinicalContext, conversationHistory);
    }
  }

  private buildFallbackNurseAssist(
    context: ClinicalContext,
    history: any[]
  ) {
    const patientFirstName = context.patient.name?.split(' ')[0] || 'Paciente';
    return {
      summary: `Paciente ${context.patient.name}, ${context.patient.cancerType || 'diagnóstico não informado'}. Prioridade: ${context.patient.priorityCategory}.`,
      suggested_replies: [
        {
          label: 'Empática',
          text: `Olá ${patientFirstName}, obrigada por entrar em contato. Estamos acompanhando você. Como está se sentindo?`,
        },
        {
          label: 'Informativa',
          text: `${patientFirstName}, recebi suas informações e vou verificar com a equipe. Retorno em breve.`,
        },
        {
          label: 'Ação',
          text: `${patientFirstName}, vou agendar uma avaliação para você. Posso confirmar um horário?`,
        },
      ],
      suggested_actions: [],
      used_llm: false,
    };
  }

  async getPatientSummary(
    patientId: string,
    tenantId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<any> {
    const clinicalContext = await this.buildClinicalContext(patientId, tenantId);
    const patient = clinicalContext.patient;

    const fullPatient = await this.prisma.patient.findFirst({
      where: { id: patientId, tenantId },
      select: { birthDate: true, gender: true, comorbidities: true },
    });

    const recentSymptoms: string[] = [];
    const conversations = await this.prisma.conversation.findMany({
      where: { patientId, tenantId },
      orderBy: { updatedAt: 'desc' },
      take: 5,
      include: { messages: { orderBy: { createdAt: 'desc' }, take: 10 } },
    });

    for (const conv of conversations) {
      for (const msg of conv.messages) {
        if (
          msg.criticalSymptomsDetected &&
          Array.isArray(msg.criticalSymptomsDetected)
        ) {
          for (const s of msg.criticalSymptomsDetected) {
            if (typeof s === 'string' && !recentSymptoms.includes(s)) {
              recentSymptoms.push(s);
            }
          }
        }
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let esasScores: Record<string, any> | undefined;
    if (clinicalContext.questionnaireResponses?.length > 0) {
      const latestQr = clinicalContext.questionnaireResponses[0];
      if (latestQr.scores && typeof latestQr.scores === 'object') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        esasScores = latestQr.scores as Record<string, any>;
      }
    }

    const comorbidities: string[] = [];
    const rawComorbidities = fullPatient?.comorbidities;
    if (rawComorbidities && Array.isArray(rawComorbidities)) {
      for (const c of rawComorbidities) {
        if (typeof c === 'string') {
          comorbidities.push(c);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } else if (typeof c === 'object' && c !== null && (c as any).name) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          comorbidities.push((c as any).name);
        }
      }
    }

    const lastConv = conversations[0];
    const lastInteraction = lastConv?.updatedAt?.toISOString() || null;

    const payload = {
      patient_id: patientId,
      patient_name: patient.name,
      cancer_type: patient.cancerType || null,
      stage: patient.stage || null,
      performance_status: patient.performanceStatus ?? null,
      priority_score: patient.priorityScore || 0,
      priority_category: patient.priorityCategory || 'LOW',
      current_stage: patient.currentStage || null,
      date_of_birth: fullPatient?.birthDate
        ? new Date(fullPatient.birthDate).toISOString().split('T')[0]
        : null,
      gender: fullPatient?.gender || null,
      comorbidities,
      navigation_steps: (clinicalContext.navigationSteps || []).map(
        (s: any) => ({
          step_key: s.stepKey || s.id,
          step_name: s.stepName || s.name || 'Step',
          status: s.status,
          is_required: s.isRequired ?? true,
          expected_date: s.expectedDate?.toISOString() || null,
          due_date: s.dueDate?.toISOString() || null,
          completed_at: s.completedAt?.toISOString() || null,
        }),
      ),
      recent_symptoms: recentSymptoms,
      esas_scores: esasScores || null,
      alerts: (clinicalContext.recentAlerts || []).map(
        (a: any) => `[${a.severity}] ${a.message}`,
      ),
      recent_conversations_count: conversations.length,
      last_interaction_date: lastInteraction,
      treatments: [],
    };

    const { aiServiceUrl, headers: aiHeaders } = getAiServiceConfig(
      this.configService,
    );

    try {
      const response = await fetch(
        `${aiServiceUrl}/api/v1/agent/patient-summary`,
        {
          method: 'POST',
          headers: aiHeaders,
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(120_000),
        },
      );

      if (!response.ok) {
        this.logger.warn(
          `AI patient-summary returned ${response.status}: ${response.statusText}`,
        );
        return this.buildFallbackPatientSummary(clinicalContext);
      }

      return response.json();
    } catch (error) {
      this.logger.error(`Failed to call patient-summary AI: ${error.message}`);
      return this.buildFallbackPatientSummary(clinicalContext);
    }
  }

  private buildFallbackPatientSummary(context: ClinicalContext) {
    const p = context.patient;
    const steps = context.navigationSteps || [];
    const completed = steps.filter((s: any) => s.status === 'COMPLETED');
    const pending = steps.filter(
      (s: any) => s.status === 'PENDING' || s.status === 'IN_PROGRESS',
    );

    return {
      narrative: `Paciente ${p.name}, ${p.cancerType || 'diagnóstico a definir'}${p.stage ? ` estágio ${p.stage}` : ''}. Prioridade: ${p.priorityCategory || 'LOW'}. ${completed.length}/${steps.length} etapas concluídas.`,
      highlights: [
        ...(p.cancerType
          ? [{ icon: 'info', text: `Diagnóstico: ${p.cancerType}` }]
          : []),
        ...(p.stage
          ? [{ icon: 'info', text: `Estadiamento: ${p.stage}` }]
          : []),
        ...(completed.length > 0
          ? [
              {
                icon: 'success',
                text: `${completed.length} etapa(s) concluída(s)`,
              },
            ]
          : []),
      ],
      risks: [],
      next_steps: pending.slice(0, 3).map((s: any) => ({
        step: s.stepName || s.name || 'Próxima etapa',
        urgency: 'NORMAL',
      })),
      used_llm: false,
    };
  }

  // ==========================================
  // OBSERVABILITY PROXY
  // ==========================================

  async getObservabilityTraces(tenantId: string, limit = 50): Promise<any> {
    try {
      const { aiServiceUrl } = getAiServiceConfig(this.configService);
      const url = `${aiServiceUrl}/api/v1/observability/traces?limit=${limit}`;
      const headers = getAiServiceHeadersWithTenant(
        this.configService,
        tenantId,
      );
      const response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(20_000),
      });
      return response.json();
    } catch (error) {
      this.logger.error(`Failed to fetch observability traces: ${error.message}`);
      return { traces: [] };
    }
  }

  async getObservabilityStats(tenantId: string): Promise<any> {
    try {
      const { aiServiceUrl } = getAiServiceConfig(this.configService);
      const url = `${aiServiceUrl}/api/v1/observability/stats`;
      const headers = getAiServiceHeadersWithTenant(
        this.configService,
        tenantId,
      );
      const response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(20_000),
      });
      return response.json();
    } catch (error) {
      this.logger.error(`Failed to fetch observability stats: ${error.message}`);
      return { total_traces: 0 };
    }
  }

  async clearObservabilityTraces(tenantId: string): Promise<any> {
    try {
      const { aiServiceUrl } = getAiServiceConfig(this.configService);
      const url = `${aiServiceUrl}/api/v1/observability/traces`;
      const headers = getAiServiceHeadersWithTenant(
        this.configService,
        tenantId,
      );
      const response = await fetch(url, {
        method: 'DELETE',
        headers,
        signal: AbortSignal.timeout(20_000),
      });
      return response.json();
    } catch (error) {
      this.logger.error(`Failed to clear observability traces: ${error.message}`);
      return { cleared: false };
    }
  }

  /**
   * Send an assisted reply — called when the nurse accepts or edits an AI suggestion.
   * Delegates to ChannelGatewayService so the message is sent via WhatsApp
   * and persisted as an OUTBOUND NURSING message.
   */
  async sendAssistedReply(
    patientId: string,
    tenantId: string,
    conversationId: string | undefined,
    content: string
  ): Promise<void> {
    await this.channelGateway.sendMessage(
      patientId,
      tenantId,
      content,
      undefined,
      conversationId,
      { structuredData: undefined, alertTriggered: false }
    );
  }
}
