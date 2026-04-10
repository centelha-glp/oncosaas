export const BLADDER_PROTOCOL = {
  cancerType: 'bladder',
  name: 'Protocolo de Navegação - Câncer de Bexiga',

  journeyStages: {
    SCREENING: {
      steps: [
        {
          key: 'initial_assessment',
          name: 'Avaliação Inicial',
          daysToComplete: 7,
        },
        {
          key: 'urinalysis',
          name: 'Exame de Urina / Citologia',
          daysToComplete: 14,
        },
        {
          key: 'cystoscopy_referral',
          name: 'Encaminhamento Cistoscopia',
          daysToComplete: 21,
        },
      ],
    },
    DIAGNOSIS: {
      steps: [
        { key: 'cystoscopy', name: 'Cistoscopia', daysToComplete: 21 },
        {
          key: 'turbt',
          name: 'RTU de Bexiga (TURBT)',
          daysToComplete: 30,
          dependsOn: 'cystoscopy',
        },
        {
          key: 'pathology_report',
          name: 'Laudo Anatomopatológico',
          daysToComplete: 21,
          dependsOn: 'turbt',
        },
        { key: 'staging_ct', name: 'TC Abdome/Pelve', daysToComplete: 21 },
        {
          key: 'staging_complete',
          name: 'Estadiamento Completo',
          dependsOn: ['pathology_report', 'staging_ct'],
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
          key: 'bcg_intravesical',
          name: 'BCG Intravesical',
          conditional: 'if non-muscle invasive',
        },
        {
          key: 'neoadjuvant_chemo',
          name: 'Quimioterapia Neoadjuvante',
          conditional: 'if muscle invasive',
        },
        {
          key: 'radical_cystectomy',
          name: 'Cistectomia Radical',
          conditional: 'if muscle invasive',
        },
        {
          key: 'immunotherapy',
          name: 'Imunoterapia',
          conditional: 'if indicated (PD-L1+)',
        },
        {
          key: 'transurethral_resection_therapeutic',
          name: 'RTU de Bexiga (terapêutica / re-ressecção)',
          daysToComplete: 42,
          conditional: 'NMIBC — recidiva/resgate (distinta da RTU diagnóstica)',
        },
      ],
    },
    FOLLOW_UP: {
      steps: [
        {
          key: 'follow_up_cystoscopy',
          name: 'Cistoscopia de Seguimento',
          recurring: 'every 3 months for 2 years',
        },
        {
          key: 'follow_up_ct',
          name: 'TC de Seguimento',
          recurring: 'every 6 months for 2 years',
        },
        {
          key: 'follow_up_urine',
          name: 'Citologia Urinária',
          recurring: 'every 6 months',
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
      keyword: 'hematúria intensa',
      severity: 'CRITICAL',
      action: 'ESCALATE_IMMEDIATELY',
    },
    {
      keyword: 'retenção urinária',
      severity: 'CRITICAL',
      action: 'ESCALATE_IMMEDIATELY',
    },
    {
      keyword: 'febre neutropênica',
      severity: 'CRITICAL',
      action: 'ESCALATE_IMMEDIATELY',
    },
    { keyword: 'disúria severa', severity: 'HIGH', action: 'ALERT_NURSING' },
    { keyword: 'infecção urinária', severity: 'HIGH', action: 'ALERT_NURSING' },
    {
      keyword: 'fadiga intensa',
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
