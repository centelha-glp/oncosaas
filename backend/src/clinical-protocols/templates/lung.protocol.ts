export const LUNG_PROTOCOL = {
  cancerType: 'lung',
  name: 'Protocolo de Navegação - Câncer de Pulmão',

  journeyStages: {
    SCREENING: {
      steps: [
        {
          key: 'initial_assessment',
          name: 'Avaliação Inicial',
          daysToComplete: 7,
        },
        {
          key: 'low_dose_ct',
          name: 'TC de Tórax de Baixa Dose',
          daysToComplete: 14,
        },
        {
          key: 'spirometry',
          name: 'Espirometria',
          daysToComplete: 14,
        },
      ],
    },
    DIAGNOSIS: {
      steps: [
        {
          key: 'bronchoscopy',
          name: 'Broncoscopia',
          daysToComplete: 21,
        },
        {
          key: 'ct_guided_biopsy',
          name: 'Biópsia Guiada por TC',
          daysToComplete: 21,
        },
        {
          key: 'pathology_report',
          name: 'Laudo Anatomopatológico',
          daysToComplete: 14,
          dependsOn: 'ct_guided_biopsy',
        },
        {
          key: 'molecular_profile',
          name: 'Perfil Molecular (EGFR, ALK, ROS1, PD-L1)',
          daysToComplete: 21,
          dependsOn: 'pathology_report',
        },
        {
          key: 'pet_ct',
          name: 'PET-CT de Estadiamento',
          daysToComplete: 21,
        },
        {
          key: 'staging_complete',
          name: 'Estadiamento Completo',
          dependsOn: ['pathology_report', 'molecular_profile', 'pet_ct'],
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
          key: 'targeted_therapy',
          name: 'Terapia Alvo / Imunoterapia',
          daysToComplete: 21,
        },
        {
          key: 'chemotherapy',
          name: 'Quimioterapia',
          daysToComplete: 21,
        },
        {
          key: 'radiotherapy',
          name: 'Radioterapia',
          daysToComplete: 30,
        },
        {
          key: 'surgery',
          name: 'Cirurgia (se indicada)',
          daysToComplete: 30,
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
          key: 'ct_surveillance',
          name: 'TC de Vigilância',
          daysToComplete: 180,
        },
        {
          key: 'pulmonary_function',
          name: 'Função Pulmonar',
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
      keyword: 'hemoptise',
      severity: 'CRITICAL',
      action: 'ESCALATE_IMMEDIATELY',
    },
    {
      keyword: 'dispneia grave',
      severity: 'CRITICAL',
      action: 'ESCALATE_IMMEDIATELY',
    },
    {
      keyword: 'febre neutropênica',
      severity: 'CRITICAL',
      action: 'ESCALATE_IMMEDIATELY',
    },
    {
      keyword: 'dor torácica intensa',
      severity: 'HIGH',
      action: 'ALERT_NURSING',
    },
    {
      keyword: 'tosse persistente',
      severity: 'MEDIUM',
      action: 'RECORD_AND_MONITOR',
    },
    {
      keyword: 'fadiga severa',
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
