/**
 * Protocolo genérico para tipos de câncer sem protocolo específico.
 * Serve como fallback para tipos não mapeados.
 */
export const OTHER_PROTOCOL = {
  cancerType: 'other',
  name: 'Protocolo de Navegação - Outros Tipos de Câncer',

  journeyStages: {
    SCREENING: {
      steps: [
        {
          key: 'initial_assessment',
          name: 'Avaliação Inicial',
          daysToComplete: 7,
        },
        {
          key: 'specialist_referral',
          name: 'Encaminhamento para Especialista',
          daysToComplete: 21,
        },
      ],
    },
    DIAGNOSIS: {
      steps: [
        {
          key: 'imaging_study',
          name: 'Exame de Imagem',
          daysToComplete: 21,
        },
        {
          key: 'biopsy',
          name: 'Biópsia',
          daysToComplete: 21,
        },
        {
          key: 'pathology_report',
          name: 'Laudo Anatomopatológico',
          daysToComplete: 14,
          dependsOn: 'biopsy',
        },
        {
          key: 'staging_complete',
          name: 'Estadiamento Completo',
          dependsOn: ['pathology_report', 'imaging_study'],
        },
      ],
    },
    TREATMENT: {
      steps: [
        {
          key: 'mdt_discussion',
          name: 'Discussão Multidisciplinar',
          daysToComplete: 14,
        },
        {
          key: 'treatment_plan',
          name: 'Plano de Tratamento',
          daysToComplete: 7,
          dependsOn: 'mdt_discussion',
        },
        {
          key: 'treatment_start',
          name: 'Início do Tratamento',
          daysToComplete: 30,
          dependsOn: 'treatment_plan',
        },
      ],
    },
    FOLLOW_UP: {
      steps: [
        {
          key: 'first_follow_up',
          name: '1ª Consulta de Seguimento',
          daysToComplete: 90,
        },
        {
          key: 'surveillance_imaging',
          name: 'Imagem de Vigilância',
          daysToComplete: 180,
        },
      ],
    },
  },

  checkInRules: {
    SCREENING: { frequency: 'weekly', questionnaire: null },
    DIAGNOSIS: { frequency: 'twice_weekly', questionnaire: null },
    TREATMENT: { frequency: 'daily', questionnaire: 'ESAS' },
    FOLLOW_UP: { frequency: 'weekly', questionnaire: 'PRO_CTCAE' },
  },

  criticalSymptoms: [
    {
      keyword: 'febre neutropênica',
      severity: 'CRITICAL',
      action: 'ESCALATE_IMMEDIATELY',
    },
    {
      keyword: 'sangramento intenso',
      severity: 'CRITICAL',
      action: 'ESCALATE_IMMEDIATELY',
    },
    {
      keyword: 'dor intensa',
      severity: 'HIGH',
      action: 'ALERT_NURSING',
    },
    {
      keyword: 'náusea severa',
      severity: 'MEDIUM',
      action: 'RECORD_AND_MONITOR',
    },
    {
      keyword: 'fadiga extrema',
      severity: 'MEDIUM',
      action: 'RECORD_AND_MONITOR',
    },
  ],

  riskAdjustment: {
    increaseFrequency: [
      { condition: 'priorityCategory === "CRITICAL"', multiplier: 2 },
      { condition: 'lastSymptomSeverity >= 7', multiplier: 1.5 },
      { condition: 'missedCheckIns >= 2', multiplier: 1.5 },
    ],
  },
};
