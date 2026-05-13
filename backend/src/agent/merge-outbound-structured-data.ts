/**
 * Monta o JSON `Message.structuredData` na resposta OUTBOUND do agente
 * (sintomas derivados de decisões + trace do pipeline do ai-service).
 */
export function mergeOutboundStructuredData(
  baseStructured: Record<string, unknown>,
  symptoms: Record<string, number>,
  pipelineTrace?: unknown
): Record<string, unknown> {
  return {
    ...baseStructured,
    ...(Object.keys(symptoms).length > 0 ? { symptoms } : {}),
    ...(pipelineTrace && typeof pipelineTrace === 'object'
      ? { pipelineTrace: pipelineTrace as Record<string, unknown> }
      : {}),
  };
}
