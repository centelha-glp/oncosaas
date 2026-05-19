/**
 * Segunda linha de defesa: filtro leve de saída ao paciente (espelha regras mínimas do ai-service).
 * Não registra conteúdo da mensagem — apenas rule_id para logs.
 */

const OUTPUT_SAFE_RESPONSE =
  'Não posso fornecer diagnóstico, prescrição com dose ou garantias sobre o tratamento. ' +
  'Posso ajudar a organizar informações e orientar quando buscar a equipe ou o pronto-socorro. ' +
  'Se houver piora importante ou risco imediato, procure o pronto-socorro ou ligue para o SAMU (192).';

const URGENCY_ALLOWLIST: RegExp[] = [
  /\bSAMU\b|\b192\b/i,
  /pronto[\s-]?socorro/i,
  /\bemergência\b|\burgência\b/i,
  /atenção\s+imediata/i,
  /procure\s+o\s+(ps|pronto)/i,
];

const OUTPUT_BLOCK: Array<{ ruleId: string; pattern: RegExp }> = [
  {
    ruleId: 'output_diagnosis_definitive',
    pattern:
      /\b(você\s+tem|o\s+diagnóstico\s+é|confirmo\s+que\s+é|é\s+câncer\s+de)\b/i,
  },
  {
    ruleId: 'output_prescription_dose',
    pattern:
      /\b(tome|tomar|use|aplique)\b.{0,40}\b\d+\s*(mg|ml|g|ui|comprimidos?|cp)\b/i,
  },
  {
    ruleId: 'output_cure_guarantee',
    pattern:
      /\b(vai\s+curar|cura\s+completa|garanto\s+que|certeza\s+de\s+cura|100%\s+de\s+chance)\b/i,
  },
];

export type PatientOutputGuardrailResult = {
  text: string;
  triggered: boolean;
  ruleId?: string;
};

function matchesUrgencyAllowlist(text: string): boolean {
  return URGENCY_ALLOWLIST.some((p) => p.test(text));
}

export function applyPatientOutputGuardrail(text: string): PatientOutputGuardrailResult {
  const raw = (text ?? '').trim();
  if (!raw) {
    return { text: raw, triggered: false };
  }
  if (matchesUrgencyAllowlist(raw)) {
    return { text: raw, triggered: false };
  }
  for (const { ruleId, pattern } of OUTPUT_BLOCK) {
    if (pattern.test(raw)) {
      return {
        text: OUTPUT_SAFE_RESPONSE,
        triggered: true,
        ruleId,
      };
    }
  }
  return { text: raw, triggered: false };
}
