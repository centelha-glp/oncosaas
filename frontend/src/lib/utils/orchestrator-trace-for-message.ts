import type { Message, OrchestratorPipelineTrace } from '@/lib/api/messages';
import { parsePipelineTrace } from '@/lib/api/messages';

const SENSITIVE_TRACE_ROOT_KEYS = new Set([
  'patient_id',
  'tenant_id',
  'patientId',
  'tenantId',
]);

/** Remove identificadores sensíveis do trace antes de mostrar no painel de auditoria. */
export function sanitizeTraceForAuditPanel(
  trace: OrchestratorPipelineTrace | null
): OrchestratorPipelineTrace | null {
  if (!trace) return null;
  const raw = trace as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = { ...raw };
  for (const k of SENSITIVE_TRACE_ROOT_KEYS) {
    delete out[k];
  }
  return out as unknown as OrchestratorPipelineTrace;
}

export function resolveTraceForMessage(
  messages: Message[],
  selectedId: string | null
): {
  trace: OrchestratorPipelineTrace | null;
  waitingForAgent: boolean;
  hint: string | null;
} {
  if (!messages.length || !selectedId) {
    return { trace: null, waitingForAgent: false, hint: null };
  }
  const idx = messages.findIndex((m) => m.id === selectedId);
  if (idx === -1) {
    return { trace: null, waitingForAgent: false, hint: null };
  }
  const msg = messages[idx];

  if (msg.direction === 'OUTBOUND' && msg.processedBy === 'AGENT') {
    return {
      trace: parsePipelineTrace(msg.structuredData),
      waitingForAgent: false,
      hint: null,
    };
  }

  if (msg.direction === 'INBOUND') {
    for (let j = idx + 1; j < messages.length; j++) {
      const m = messages[j];
      if (m.direction === 'OUTBOUND' && m.processedBy === 'AGENT') {
        return {
          trace: parsePipelineTrace(m.structuredData),
          waitingForAgent: false,
          hint: 'Trace da resposta do agente a esta mensagem.',
        };
      }
    }
    return {
      trace: null,
      waitingForAgent: true,
      hint: null,
    };
  }

  return {
    trace: null,
    waitingForAgent: false,
    hint:
      msg.processedBy === 'NURSING'
        ? 'Mensagens da enfermagem não incluem trace do orquestrador.'
        : null,
  };
}
