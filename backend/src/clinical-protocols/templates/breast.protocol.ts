export const BREAST_PROTOCOL = {
  cancerType: 'breast',
  name: 'Protocolo de Navegação - Câncer de Mama',

  journeyStages: {
    SCREENING: {
      steps: [
        {
          key: 'initial_assessment',
          name: 'Avaliação Inicial',
          daysToComplete: 7,
        },
        {
          key: 'mammography',
          name: 'Mamografia',
          daysToComplete: 21,
        },
        {
          key: 'breast_ultrasound',
          name: 'Ultrassom de Mama',
          daysToComplete: 21,
        },
      ],
    },
    DIAGNOSIS: {
      steps: [
        {
          key: 'core_biopsy',
          name: 'Core Biópsia',
          daysToComplete: 14,
        },
        {
          key: 'pathology_report',
          name: 'Laudo Anatomopatológico',
          daysToComplete: 14,
          dependsOn: 'core_biopsy',
        },
        {
          key: 'receptor_status',
          name: 'Receptores Hormonais e HER2',
          daysToComplete: 14,
          dependsOn: 'core_biopsy',
        },
        {
          key: 'staging_ct',
          name: 'TC de Estadiamento',
          daysToComplete: 21,
        },
        {
          key: 'bone_scan',
          name: 'Cintilografia Óssea',
          daysToComplete: 21,
        },
        {
          key: 'staging_complete',
          name: 'Estadiamento Completo',
          dependsOn: ['pathology_report', 'receptor_status', 'staging_ct'],
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
          key: 'neoadjuvant_chemo',
          name: 'Quimioterapia Neoadjuvante',
          daysToComplete: 30,
        },
        {
          key: 'surgery',
          name: 'Cirurgia (Mastectomia ou Conservadora)',
          daysToComplete: 30,
        },
        {
          key: 'radiotherapy',
          name: 'Radioterapia',
          daysToComplete: 30,
          dependsOn: 'surgery',
        },
        {
          key: 'hormonal_therapy',
          name: 'Hormonioterapia',
          daysToComplete: 14,
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
          key: 'annual_mammography',
          name: 'Mamografia Anual',
          daysToComplete: 365,
        },
        {
          key: 'tumor_markers',
          name: 'Marcadores Tumorais (CA 15-3)',
          daysToComplete: 90,
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
      keyword: 'nódulo mamário',
      severity: 'HIGH',
      action: 'ALERT_NURSING',
    },
    {
      keyword: 'dor no peito',
      severity: 'HIGH',
      action: 'ALERT_NURSING',
    },
    {
      keyword: 'febre neutropênica',
      severity: 'CRITICAL',
      action: 'ESCALATE_IMMEDIATELY',
    },
    {
      keyword: 'linfedema grave',
      severity: 'HIGH',
      action: 'ALERT_NURSING',
    },
    {
      keyword: 'neuropatia periférica',
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
