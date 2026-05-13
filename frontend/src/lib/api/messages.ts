import { apiClient } from './client';

export type SuggestionStatus = 'PENDING' | 'ACCEPTED' | 'EDITED' | 'REJECTED';
export type SuggestionAction = 'ACCEPT' | 'REJECT' | 'EDIT';

/** Span do AgentTracer (ai-service) — exibido no simulador /teste */
export interface OrchestratorPipelineSpan {
  name: string;
  duration_ms?: number | null;
  data?: Record<string, unknown>;
}

/** Resumo da LLM usada na classificação de intent (ai-service). */
export interface TraceIntentLlmSummary {
  source?: string | null;
  provider?: string | null;
  model?: string | null;
  detail?: string | null;
}

/** Chamada LLM na análise de sintomas (tools); `called` indica retorno útil. */
export interface TraceSymptomLlmSummary {
  called?: boolean;
  provider?: string | null;
  model?: string | null;
}

/** Texto empacotado pelo ai-service (`pack_trace_text`). */
export interface TracePackedText {
  text: string;
  truncated: boolean;
  total_chars: number;
}

/** Mensagem do orquestrador com conteúdo possivelmente truncado. */
export interface TraceOrchestratorMessage {
  role?: string | null;
  content: TracePackedText;
}

/** Input enviado ao `run_agentic_loop` do orquestrador (system + histórico). */
export interface TraceOrchestratorInput {
  system_prompt: TracePackedText;
  messages: TraceOrchestratorMessage[];
  orchestrator_model?: string | null;
  subagent_model?: string | null;
}

/** Agregado de tokens/custo (vários eventos ou um subagente). */
export interface TraceTokenUsageTotals {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  estimated_cost_usd: number;
  call_count: number;
}

/** Um evento de uso de LLM no trace (intent, sintomas, orquestrador, subagente). */
export interface TraceTokenUsageEvent {
  step?: string;
  provider?: string;
  model?: string;
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  /** Custo estimado deste evento (USD). */
  cost_usd?: number;
  [key: string]: unknown;
}

/** Uma invocação de subagente via tool de routing. */
export interface TraceSubagentOutput {
  routing_tool: string;
  agent_name: string;
  response: TracePackedText;
  iterations?: number;
  tool_calls_count?: number;
  tool_names?: string[];
  error?: string | null;
  routing_tool_input?: TracePackedText;
  /** Agregado deste subagente (quando o ai-service envia). */
  token_usage?: TraceTokenUsageTotals | null;
}

/** Trace serializado em `structuredData.pipelineTrace` nas mensagens OUTBOUND do agente */
export interface OrchestratorPipelineTrace {
  trace_id?: string;
  pipeline_path?: string;
  intent?: string | null;
  intent_confidence?: number | null;
  total_duration_ms?: number | null;
  clinical_disposition?: string | null;
  symptoms_detected?: number;
  overall_severity?: string | null;
  clinical_rules_fired?: string[];
  actions_generated?: string[];
  subagents_called?: string[];
  /** True quando o ai-service executou o ramo multi-agente (LLM orquestrador + tools). */
  main_multi_agent_llm_used?: boolean;
  /** Provedor/modelo da classificação de intent (quando houve chamada ou tentativa com erro). */
  intent_llm?: TraceIntentLlmSummary | null;
  /** Provedor/modelo da análise de sintomas com LLM (quando configurada). */
  symptom_llm?: TraceSymptomLlmSummary | null;
  /** Saída textual do context builder / RAG (truncada no servidor). */
  rag_context_output?: TracePackedText | null;
  /** System prompt + mensagens iniciais do orquestrador multi-agente. */
  orchestrator_input?: TraceOrchestratorInput | null;
  /** Respostas textuais dos subagentes (por chamada de routing). */
  subagent_outputs?: TraceSubagentOutput[];
  /** Lista de chamadas LLM com tokens e custo por passo (snake_case do ai-service). */
  token_usage_events?: TraceTokenUsageEvent[];
  /** Soma de tokens e custo estimado no request. */
  token_usage_totals?: TraceTokenUsageTotals | null;
  spans?: OrchestratorPipelineSpan[];
  llm_calls?: Array<Record<string, unknown>>;
  error?: string | null;
}

export function parsePipelineTrace(
  structuredData: Record<string, unknown> | null | undefined
): OrchestratorPipelineTrace | null {
  if (!structuredData || typeof structuredData !== 'object') return null;
  const raw = structuredData.pipelineTrace;
  if (!raw || typeof raw !== 'object') return null;
  const t = raw as Record<string, unknown>;
  const merged: OrchestratorPipelineTrace = { ...(raw as OrchestratorPipelineTrace) };
  if (merged.intent_llm == null && t.intentLlm != null)
    merged.intent_llm = t.intentLlm as TraceIntentLlmSummary;
  if (merged.symptom_llm == null && t.symptomLlm != null)
    merged.symptom_llm = t.symptomLlm as TraceSymptomLlmSummary;
  if (merged.rag_context_output == null && t.ragContextOutput != null)
    merged.rag_context_output = t.ragContextOutput as TracePackedText;
  if (merged.orchestrator_input == null && t.orchestratorInput != null)
    merged.orchestrator_input = t.orchestratorInput as TraceOrchestratorInput;
  if (
    (merged.subagent_outputs == null || merged.subagent_outputs.length === 0) &&
    Array.isArray(t.subagentOutputs)
  )
    merged.subagent_outputs = t.subagentOutputs as TraceSubagentOutput[];
  if (
    (!merged.subagents_called || merged.subagents_called.length === 0) &&
    Array.isArray(t.subagentsCalled)
  )
    merged.subagents_called = t.subagentsCalled as string[];
  if (merged.token_usage_totals == null && t.tokenUsageTotals != null)
    merged.token_usage_totals = t.tokenUsageTotals as TraceTokenUsageTotals;
  if (merged.token_usage_totals == null && t.token_usage_totals != null)
    merged.token_usage_totals = t.token_usage_totals as TraceTokenUsageTotals;
  if (
    (!merged.token_usage_events || merged.token_usage_events.length === 0) &&
    Array.isArray(t.tokenUsageEvents)
  )
    merged.token_usage_events = t.tokenUsageEvents as TraceTokenUsageEvent[];
  if (
    (!merged.token_usage_events || merged.token_usage_events.length === 0) &&
    Array.isArray(t.token_usage_events)
  )
    merged.token_usage_events = t.token_usage_events as TraceTokenUsageEvent[];
  return merged;
}

export interface Message {
  id: string;
  tenantId: string;
  patientId: string;
  conversationId: string | null;
  whatsappMessageId: string;
  whatsappTimestamp: string;
  type: 'TEXT' | 'AUDIO' | 'IMAGE' | 'DOCUMENT';
  direction: 'INBOUND' | 'OUTBOUND';
  content: string;
  audioUrl: string | null;
  audioDuration: number | null;
  transcribedText: string | null;
  processedBy: 'AGENT' | 'NURSING';
  structuredData: Record<string, unknown> | null;
  criticalSymptomsDetected: string[];
  alertTriggered: boolean;
  suggestedResponse: string | null;
  suggestionStatus: SuggestionStatus | null;
  assumedBy: string | null;
  assumedAt: string | null;
  createdAt: string;
  patient?: {
    id: string;
    name: string;
    phone: string;
  };
}

export interface UpdateSuggestionDto {
  action: SuggestionAction;
  editedText?: string;
}

export interface MessageCount {
  count: number;
}

export interface SendMessageDto {
  patientId: string;
  content: string;
  conversationId?: string;
}

export const messagesApi = {
  async getAll(
    patientId?: string,
    limit?: number,
    offset?: number
  ): Promise<Message[]> {
    const params = new URLSearchParams();
    if (patientId) params.set('patientId', patientId);
    if (limit !== undefined) params.set('limit', String(limit));
    if (offset !== undefined) params.set('offset', String(offset));
    const query = params.toString();
    return apiClient.get<Message[]>(query ? `/messages?${query}` : '/messages');
  },

  async getById(id: string): Promise<Message> {
    return apiClient.get<Message>(`/messages/${id}`);
  },

  async getUnassumedCount(): Promise<MessageCount> {
    return apiClient.get<MessageCount>('/messages/unassumed/count');
  },

  async getUnassumedPatientIds(): Promise<{ patientIds: string[] }> {
    return apiClient.get<{ patientIds: string[] }>(
      '/messages/unassumed/patient-ids'
    );
  },

  async assume(id: string): Promise<Message> {
    return apiClient.patch<Message>(`/messages/${id}/assume`, {});
  },

  /**
   * Assumir todas as mensagens não lidas de um paciente.
   * Marca a conversa como lida ao abrir.
   */
  async assumePatientConversation(
    patientId: string
  ): Promise<{ count: number }> {
    return apiClient.patch<{ count: number }>(
      `/messages/patient/${patientId}/assume`,
      {}
    );
  },

  async updateSuggestion(
    id: string,
    dto: UpdateSuggestionDto
  ): Promise<Message> {
    return apiClient.patch<Message>(`/messages/${id}/suggestion`, dto);
  },

  async send(data: SendMessageDto): Promise<Message> {
    // A3: crypto.randomUUID() is universally unique — avoids the collision that
    // Date.now() would produce when two messages are sent within the same ms,
    // which would cause the backend to discard the second as a duplicate.
    return apiClient.post<Message>('/messages', {
      patientId: data.patientId,
      conversationId: data.conversationId,
      whatsappMessageId: `nursing_${crypto.randomUUID()}`,
      whatsappTimestamp: new Date().toISOString(),
      type: 'TEXT',
      direction: 'OUTBOUND',
      content: data.content,
      processedBy: 'NURSING',
    });
  },
};
