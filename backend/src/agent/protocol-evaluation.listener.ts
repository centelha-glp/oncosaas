import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ProtocolEvaluationService } from './protocol-evaluation.service';
import {
  PROTOCOL_SCHEDULE_REEVALUATION_EVENT,
  ProtocolScheduleReevaluationPayload,
} from './protocol-evaluation.events';

@Injectable()
export class ProtocolEvaluationListener {
  private readonly logger = new Logger(ProtocolEvaluationListener.name);

  constructor(
    private readonly protocolEvaluation: ProtocolEvaluationService,
  ) {}

  @OnEvent(PROTOCOL_SCHEDULE_REEVALUATION_EVENT, { async: true })
  async handleProtocolScheduleReevaluation(
    payload: ProtocolScheduleReevaluationPayload,
  ): Promise<void> {
    if (!payload?.patientId || !payload?.tenantId) {
      return;
    }
    try {
      await this.protocolEvaluation.syncScheduledProtocolActions(
        payload.patientId,
        payload.tenantId,
        { trigger: payload.reason ?? 'event' },
      );
    } catch (err) {
      this.logger.warn(
        `protocol schedule reevaluation failed: ${
          err instanceof Error ? err.message : 'unknown'
        }`,
      );
    }
  }
}
