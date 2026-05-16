import { describe, expect, it } from 'vitest';
import type { Message } from '@/lib/api/messages';
import {
  resolveTraceForMessage,
  sanitizeTraceForAuditPanel,
} from '@/lib/utils/orchestrator-trace-for-message';

const baseMsg = (over: Partial<Message>): Message => ({
  id: 'm1',
  tenantId: 't1',
  patientId: 'p1',
  conversationId: 'c1',
  whatsappMessageId: 'w1',
  whatsappTimestamp: new Date().toISOString(),
  type: 'TEXT',
  direction: 'INBOUND',
  content: 'oi',
  audioUrl: null,
  audioDuration: null,
  transcribedText: null,
  processedBy: 'AGENT',
  structuredData: null,
  criticalSymptomsDetected: [],
  alertTriggered: false,
  suggestedResponse: null,
  suggestionStatus: null,
  assumedBy: null,
  assumedAt: null,
  createdAt: new Date().toISOString(),
  ...over,
});

describe('resolveTraceForMessage', () => {
  it('retorna null sem seleção', () => {
    expect(resolveTraceForMessage([], null)).toEqual({
      trace: null,
      waitingForAgent: false,
      hint: null,
    });
  });

  it('usa structuredData da mensagem OUTBOUND do agente', () => {
    const trace = { pipeline_path: 'main', intent: 'GENERAL' };
    const messages = [
      baseMsg({
        id: 'in',
        direction: 'INBOUND',
        processedBy: 'AGENT',
      }),
      baseMsg({
        id: 'out',
        direction: 'OUTBOUND',
        processedBy: 'AGENT',
        structuredData: { pipelineTrace: trace },
      }),
    ];
    const r = resolveTraceForMessage(messages, 'out');
    expect(r.waitingForAgent).toBe(false);
    expect(r.hint).toBeNull();
    expect(r.trace?.pipeline_path).toBe('main');
    expect(r.trace?.intent).toBe('GENERAL');
  });

  it('em INBOUND devolve trace da primeira resposta AGENT seguinte', () => {
    const messages = [
      baseMsg({ id: 'in', direction: 'INBOUND' }),
      baseMsg({
        id: 'out',
        direction: 'OUTBOUND',
        processedBy: 'AGENT',
        structuredData: {
          pipelineTrace: { clinical_disposition: 'ER_DAYS' },
        },
      }),
    ];
    const r = resolveTraceForMessage(messages, 'in');
    expect(r.trace?.clinical_disposition).toBe('ER_DAYS');
    expect(r.hint).toContain('resposta do agente');
  });

  it('INBOUND sem resposta do agente a seguir: aguardando', () => {
    const messages = [baseMsg({ id: 'in', direction: 'INBOUND' })];
    const r = resolveTraceForMessage(messages, 'in');
    expect(r.trace).toBeNull();
    expect(r.waitingForAgent).toBe(true);
  });

  it('OUTBOUND enfermagem: hint explicativo', () => {
    const messages = [
      baseMsg({
        id: 'n',
        direction: 'OUTBOUND',
        processedBy: 'NURSING',
      }),
    ];
    const r = resolveTraceForMessage(messages, 'n');
    expect(r.trace).toBeNull();
    expect(r.hint).toContain('enfermagem');
  });
});

describe('sanitizeTraceForAuditPanel', () => {
  it('remove patient_id e tenant_id do objeto raiz', () => {
    const t = sanitizeTraceForAuditPanel({
      pipeline_path: 'main',
      patient_id: 'secret-p',
      tenant_id: 'secret-t',
    } as unknown as import('@/lib/api/messages').OrchestratorPipelineTrace);
    expect(t).not.toBeNull();
    expect((t as unknown as Record<string, unknown>).patient_id).toBeUndefined();
    expect((t as unknown as Record<string, unknown>).tenant_id).toBeUndefined();
    expect(t?.pipeline_path).toBe('main');
  });

  it('aceita null', () => {
    expect(sanitizeTraceForAuditPanel(null)).toBeNull();
  });
});
