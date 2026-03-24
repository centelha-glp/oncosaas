import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AgentDecisionType } from '@prisma/client';
import { AgentDecision } from './interfaces/agent-decision.interface';

/**
 * Actions the agent can take autonomously
 */
const AUTO_APPROVED_ACTIONS = new Set([
  'RESPOND_TO_QUESTION',
  'APPLY_QUESTIONNAIRE',
  'START_QUESTIONNAIRE',
  'CONTINUE_QUESTIONNAIRE',
  'QUESTIONNAIRE_COMPLETE',
  'SCHEDULE_CHECK_IN',
  'SEND_REMINDER',
  'RECORD_SYMPTOM',
  'RECALCULATE_PRIORITY',
  'CREATE_LOW_ALERT',
  'CREATE_HIGH_CRITICAL_ALERT', // Emergency/critical alerts: created immediately for nursing visibility
  'CRITICAL_ESCALATION', // Same as above, routes to criticalEscalation handler
  'UPDATE_NAVIGATION_STEP',
  // Protocol-driven auto-approved actions
  'CHECK_IN_SCHEDULED',
  'PROTOCOL_ALERT', // Protocol alerts go to nursing dashboard
  // Saudações: resposta rápida pré-definida, sem riscos clínicos
  'GREETING_RESPONSE',
  // Resposta sobre próximos exames/consultas
  'APPOINTMENT_RESPONSE',
]);

/**
 * Actions requiring human approval
 */
const NEEDS_APPROVAL_ACTIONS = new Set([
  'CHANGE_TREATMENT_STATUS',
  'RECOMMEND_APPOINTMENT',
  'HANDOFF_TO_SPECIALIST',
  // Questionnaire-triggered high-severity escalations
  'QUESTIONNAIRE_ESCALATION',
]);

const DECISION_TYPE_ALIASES: Record<string, AgentDecisionType> = {
  APPLY_QUESTIONNAIRE: AgentDecisionType.QUESTIONNAIRE_STARTED,
  GREETING_HANDLED: AgentDecisionType.RESPONSE_GENERATED,
  PRIORITY_RECALCULATED: AgentDecisionType.PRIORITY_UPDATED,
  APPOINTMENT_QUERY_HANDLED: AgentDecisionType.RESPONSE_GENERATED,
};

const VALID_DECISION_TYPES = new Set<AgentDecisionType>(
  Object.values(AgentDecisionType)
);

@Injectable()
export class DecisionGateService {
  private readonly logger = new Logger(DecisionGateService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Evaluate a list of agent decisions and separate them into
   * auto-approved and needs-approval buckets
   */
  evaluate(decisions: AgentDecision[]): {
    autoApproved: AgentDecision[];
    needsApproval: AgentDecision[];
  } {
    const autoApproved: AgentDecision[] = [];
    const needsApproval: AgentDecision[] = [];

    for (const decision of decisions) {
      const actionType = decision.outputAction?.type || '';

      if (decision.requiresApproval || NEEDS_APPROVAL_ACTIONS.has(actionType)) {
        decision.requiresApproval = true;
        needsApproval.push(decision);
      } else if (AUTO_APPROVED_ACTIONS.has(actionType)) {
        decision.requiresApproval = false;
        autoApproved.push(decision);
      } else {
        // Unknown action type → require approval by default
        this.logger.warn(
          `Unknown action type: ${actionType}, requiring approval`
        );
        decision.requiresApproval = true;
        needsApproval.push(decision);
      }
    }

    return { autoApproved, needsApproval };
  }

  /**
   * Log a decision to the audit trail
   */
  async logDecision(
    tenantId: string,
    conversationId: string,
    patientId: string,
    decision: AgentDecision
  ) {
    const normalizedDecisionType = this.normalizeDecisionType(
      decision.decisionType
    );

    return this.prisma.agentDecisionLog.create({
      data: {
        tenantId,
        conversationId,
        patientId,
        decisionType: normalizedDecisionType,
        reasoning: decision.reasoning,
        confidence: decision.confidence,
        inputData: decision.inputData,
        outputAction: decision.outputAction,
        requiresApproval: decision.requiresApproval,
      },
    });
  }

  private normalizeDecisionType(decisionType: unknown): AgentDecisionType {
    const rawType = typeof decisionType === 'string' ? decisionType : '';

    if (VALID_DECISION_TYPES.has(rawType as AgentDecisionType)) {
      return rawType as AgentDecisionType;
    }

    if (rawType && DECISION_TYPE_ALIASES[rawType]) {
      const mappedType = DECISION_TYPE_ALIASES[rawType];
      this.logger.warn(
        `Mapping legacy decisionType '${rawType}' to '${mappedType}'`
      );
      return mappedType;
    }

    this.logger.warn(
      `Unknown decisionType '${rawType || 'undefined'}', defaulting to RESPONSE_GENERATED`
    );
    return AgentDecisionType.RESPONSE_GENERATED;
  }

  /**
   * Approve a pending decision.
   * A1: uses update() (not updateMany) so we get a NotFoundException on
   * unknown IDs and never overwrite an already-approved decision.
   */
  async approveDecision(decisionId: string, tenantId: string, userId: string) {
    const existing = await this.prisma.agentDecisionLog.findFirst({
      where: { id: decisionId, tenantId },
    });
    if (!existing) {
      throw new Error(
        `Decision ${decisionId} not found for tenant ${tenantId}`
      );
    }
    if (existing.approvedBy !== null) {
      throw new Error(`Decision ${decisionId} has already been approved`);
    }
    return this.prisma.agentDecisionLog.update({
      where: { id: decisionId, tenantId },
      data: {
        approvedBy: userId,
        approvedAt: new Date(),
        rejected: false,
      },
    });
  }

  /**
   * Reject a pending decision.
   * A1: uses update() (not updateMany) with same guard as approve.
   */
  async rejectDecision(
    decisionId: string,
    tenantId: string,
    userId: string,
    reason: string
  ) {
    const existing = await this.prisma.agentDecisionLog.findFirst({
      where: { id: decisionId, tenantId },
    });
    if (!existing) {
      throw new Error(
        `Decision ${decisionId} not found for tenant ${tenantId}`
      );
    }
    if (existing.rejected) {
      throw new Error(`Decision ${decisionId} has already been rejected`);
    }
    return this.prisma.agentDecisionLog.update({
      where: { id: decisionId, tenantId },
      data: {
        approvedBy: userId,
        approvedAt: new Date(),
        rejected: true,
        rejectionReason: reason,
      },
    });
  }

  /**
   * Get pending decisions requiring approval
   */
  async getPendingDecisions(tenantId: string, limit: number = 50) {
    return this.prisma.agentDecisionLog.findMany({
      where: {
        tenantId,
        requiresApproval: true,
        approvedBy: null,
        rejected: false,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        conversation: {
          include: {
            patient: {
              select: { id: true, name: true, cancerType: true },
            },
          },
        },
      },
    });
  }
}
