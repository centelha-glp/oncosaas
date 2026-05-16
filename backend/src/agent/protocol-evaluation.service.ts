import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ChannelType,
  JourneyStage,
  PatientStatus,
  QuestionnaireType,
  ScheduledActionStatus,
} from '@generated/prisma/client';
import { getAiServiceConfig } from '../common/utils/ai-service.util';
import { PrismaService } from '../prisma/prisma.service';
import { ClinicalProtocolsService } from '../clinical-protocols/clinical-protocols.service';

const STAGES_WITH_QUESTIONNAIRES: JourneyStage[] = [
  JourneyStage.TREATMENT,
  JourneyStage.FOLLOW_UP,
];

const EMPTY_SYMPTOM_ANALYSIS = {
  detectedSymptoms: [] as unknown[],
  overallSeverity: 'LOW',
  requiresEscalation: false,
  structuredData: {},
};

export interface ProtocolScheduleSyncResult {
  questionnairesCreated: number;
  checkInsCreated: number;
  skippedReason?: string;
}

function mapQuestionnaireCodeToPrismaType(
  code: string | null | undefined,
): QuestionnaireType | null {
  if (!code) {
    return null;
  }
  const u = String(code).toUpperCase().replace(/-/g, '_');
  if (u === 'ESAS') {
    return QuestionnaireType.ESAS;
  }
  if (u === 'PRO_CTCAE') {
    return QuestionnaireType.PRO_CTCAE;
  }
  return null;
}

@Injectable()
export class ProtocolEvaluationService {
  private readonly logger = new Logger(ProtocolEvaluationService.name);
  private readonly inFlight = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly clinicalProtocols: ClinicalProtocolsService,
  ) {}

  /**
   * Avaliação canónica via Python (`POST /api/v1/agent/evaluate-protocol`) e
   * materializa START_QUESTIONNAIRE / SCHEDULE_CHECK_IN em `ScheduledAction` com dedupe.
   * Chamadas concorrentes para o mesmo par tenant+paciente são ignoradas (idempotência operacional).
   */
  async syncScheduledProtocolActions(
    patientId: string,
    tenantId: string,
    meta?: { trigger?: string },
  ): Promise<ProtocolScheduleSyncResult> {
    const flightKey = `${tenantId}:${patientId}`;
    if (this.inFlight.has(flightKey)) {
      return {
        questionnairesCreated: 0,
        checkInsCreated: 0,
        skippedReason: 'in_flight',
      };
    }
    this.inFlight.add(flightKey);
    try {
      return await this.doSyncScheduledProtocolActions(patientId, tenantId, meta);
    } finally {
      this.inFlight.delete(flightKey);
    }
  }

  private async doSyncScheduledProtocolActions(
    patientId: string,
    tenantId: string,
    meta?: { trigger?: string },
  ): Promise<ProtocolScheduleSyncResult> {
    const patient = await this.prisma.patient.findFirst({
      where: {
        id: patientId,
        tenantId,
        status: { in: [PatientStatus.ACTIVE, PatientStatus.IN_TREATMENT] },
        cancerType: { not: null },
        currentStage: { in: STAGES_WITH_QUESTIONNAIRES },
      },
      select: {
        id: true,
        tenantId: true,
        cancerType: true,
        currentStage: true,
      },
    });

    if (!patient?.cancerType) {
      return {
        questionnairesCreated: 0,
        checkInsCreated: 0,
        skippedReason: 'patient_not_eligible',
      };
    }

    const conversation = await this.prisma.conversation.findFirst({
      where: { patientId, tenantId, status: 'ACTIVE' },
      orderBy: { lastMessageAt: 'desc' },
      select: { id: true, channel: true, agentState: true },
    });

    if (!conversation) {
      return {
        questionnairesCreated: 0,
        checkInsCreated: 0,
        skippedReason: 'no_active_conversation',
      };
    }

    const protocol = await this.prisma.clinicalProtocol.findFirst({
      where: {
        tenantId,
        cancerType: patient.cancerType.toLowerCase(),
        isActive: true,
      },
      orderBy: { version: 'desc' },
    });

    const stage = patient.currentStage as string;
    const checkInRules = await this.clinicalProtocols.getCheckInRules(
      tenantId,
      patient.cancerType as string,
    );
    const rule = checkInRules?.[stage];
    const questionnaireCode = rule?.questionnaire ?? null;

    const prismaQuestionnaireType =
      mapQuestionnaireCodeToPrismaType(questionnaireCode);

    const baseAgentState =
      (conversation.agentState as Record<string, unknown> | null) ?? {};

    let lastQuestionnaireIso: string | undefined;
    if (prismaQuestionnaireType) {
      const lastResponse = await this.prisma.questionnaireResponse.findFirst({
        where: {
          patientId,
          tenantId,
          questionnaire: { type: prismaQuestionnaireType },
        },
        orderBy: { completedAt: 'desc' },
        select: { completedAt: true },
      });
      if (lastResponse?.completedAt) {
        lastQuestionnaireIso = lastResponse.completedAt.toISOString();
      }
    }

    const agentState: Record<string, unknown> = {
      ...baseAgentState,
      ...(lastQuestionnaireIso
        ? { last_questionnaire_at: lastQuestionnaireIso }
        : {}),
    };

    const protocolPayload = protocol
      ? {
          checkInRules: protocol.checkInRules,
          criticalSymptoms: protocol.criticalSymptoms,
          definition: protocol.definition,
          cancerType: protocol.cancerType,
        }
      : null;

    const { aiServiceUrl, headers } = getAiServiceConfig(this.configService);
    const url = `${aiServiceUrl}/api/v1/agent/evaluate-protocol`;

    let actions: Array<Record<string, unknown>> = [];
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          cancer_type: patient.cancerType,
          journey_stage: stage,
          symptom_analysis: EMPTY_SYMPTOM_ANALYSIS,
          agent_state: agentState,
          protocol: protocolPayload,
          patient_id: patientId,
          tenant_id: tenantId,
        }),
        signal: AbortSignal.timeout(30_000),
      });

      if (!response.ok) {
        this.logger.warn(
          `evaluate-protocol HTTP ${response.status} (trigger=${meta?.trigger ?? 'n/a'})`,
        );
        return {
          questionnairesCreated: 0,
          checkInsCreated: 0,
          skippedReason: 'ai_service_error',
        };
      }

      const body = (await response.json()) as { actions?: unknown };
      actions = Array.isArray(body.actions)
        ? (body.actions as Array<Record<string, unknown>>)
        : [];
    } catch (err) {
      this.logger.warn(
        `evaluate-protocol request failed: ${
          err instanceof Error ? err.message : 'unknown'
        }`,
      );
      return {
        questionnairesCreated: 0,
        checkInsCreated: 0,
        skippedReason: 'ai_service_unreachable',
      };
    }

    const now = new Date();
    let questionnairesCreated = 0;
    let checkInsCreated = 0;

    for (const action of actions) {
      const type = action.type as string | undefined;
      if (type === 'START_QUESTIONNAIRE') {
        const questionnaireType = (action.questionnaire_type as string) || 'ESAS';
        const existingQ = await this.prisma.scheduledAction.findFirst({
          where: {
            patientId,
            tenantId,
            actionType: 'QUESTIONNAIRE',
            status: ScheduledActionStatus.PENDING,
          },
        });
        if (existingQ) {
          continue;
        }
        await this.prisma.scheduledAction.create({
          data: {
            tenantId,
            patientId,
            conversationId: conversation.id,
            actionType: 'QUESTIONNAIRE',
            channel:
              (conversation.channel as ChannelType) ?? ChannelType.WHATSAPP,
            scheduledAt: now,
            payload: {
              questionnaireType,
              frequency: rule?.frequency,
              source: meta?.trigger ?? 'protocol_evaluation',
            },
          },
        });
        questionnairesCreated++;
      } else if (type === 'SCHEDULE_CHECK_IN') {
        const existingC = await this.prisma.scheduledAction.findFirst({
          where: {
            patientId,
            tenantId,
            actionType: 'CHECK_IN',
            status: ScheduledActionStatus.PENDING,
          },
        });
        if (existingC) {
          continue;
        }
        const frequency = (action.frequency as string) || 'weekly';
        await this.prisma.scheduledAction.create({
          data: {
            tenantId,
            patientId,
            conversationId: conversation.id,
            actionType: 'CHECK_IN',
            channel:
              (conversation.channel as ChannelType) ?? ChannelType.WHATSAPP,
            scheduledAt: now,
            payload: {
              frequency,
              source: meta?.trigger ?? 'protocol_evaluation',
            },
          },
        });
        checkInsCreated++;
      }
    }

    if (questionnairesCreated > 0 || checkInsCreated > 0) {
      this.logger.log(
        `Protocol sync (${meta?.trigger ?? 'n/a'}): +${questionnairesCreated} QUESTIONNAIRE, +${checkInsCreated} CHECK_IN`,
      );
    }

    return { questionnairesCreated, checkInsCreated };
  }
}
