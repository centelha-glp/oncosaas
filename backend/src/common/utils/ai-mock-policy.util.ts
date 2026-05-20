/**
 * Alinhado ao ai-service (`mock_policy.py`): mock de IA só em dev ou com flag explícita.
 */
export function isAiMockResponsesAllowed(): boolean {
  const flag = (process.env.AI_ALLOW_MOCK_RESPONSES ?? '').trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(flag)) {
    return true;
  }
  const env = (process.env.NODE_ENV ?? process.env.ENVIRONMENT ?? 'development')
    .trim()
    .toLowerCase();
  return env !== 'production' && env !== 'staging';
}
