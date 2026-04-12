/**
 * Dicas curtas por etapa (stepKey) para orientar o preenchimento — todas as etapas
 * recebem pelo menos uma dica heurística quando não houver mapeamento explícito.
 */
export function baseNavigationStepKey(stepKey: string): string {
  return stepKey.replace(/-\d+$/, '');
}

const EXPLICIT: Record<string, string> = {
  cystoscopy:
    'Registre sedação/anestesia, achados descritos no procedimento e envio de material à anatomia patológica, se houver.',
  transurethral_resection:
    'Documente lesões vistas, profundidade da ressecção, presença de músculo no espécime e intercorrências.',
  transurethral_resection_therapeutic:
    'Documente lesões vistas, profundidade da ressecção e plano de indução intravesical ou seguimento.',
  urine_cytology:
    'Inclua data da coleta, método e correlacione com outros exames (imagem, cistoscopia).',
  colonoscopy:
    'Registre preparo, alcance, achados segmentares, biópsias e intercorrências.',
  colonoscopy_with_biopsy:
    'Inclua localização das biópsias e material encaminhado à anatomia patológica.',
  mammography:
    'Indique BI-RADS ou classificação do laudo e recomendação de conduta.',
  breast_ultrasound:
    'Correlacione com mamografia; descreva nódulos segundo laudo (Birads).',
  breast_biopsy:
    'Documente técnica (core, VABB), localização e encaminhamento do material.',
  pathology_report:
    'Transcreva diagnóstico, grau, margens, imunoistoquímica relevante para conduta.',
  fecal_occult_blood:
    'Registre tipo de teste, resultado e encaminhamento se positivo.',
  staging_ct_abdomen:
    'Anote data, contraste e principais achados para estadiamento abdominal/pélvico.',
  staging_ct_thorax:
    'Anote data, contraste e achados pulmonares/mediastinais relevantes.',
  ct_thorax:
    'Indique técnica, data e achados comparados a exames prévios, se existirem.',
  ct_urography:
    'Descreva vias urinárias superiores e achados urológicos relevantes ao estadiamento.',
  genetic_testing:
    'Registre painel realizado, resultado principal e aconselhamento genético, se aplicável.',
  specialist_consultation:
    'Resuma demanda, decisões, encaminhamentos e próximos passos acordados na consulta.',
  navigation_consultation:
    'Descreva necessidades do paciente, barreiras ao cuidado e mediações realizadas.',
  chemotherapy:
    'Esquema, datas de ciclo, toxicidades e adesão; próximo ciclo ou ajuste de dose.',
  radiotherapy:
    'Localização, dose/fracionamento quando conhecido, toxicidades agudas e próxima revisão.',
  radical_cystectomy:
    'Tipo de derivação, achados cirúrgicos relevantes e plano pós-operatório.',
  colectomy:
    'Procedimento, achados intraoperatórios, linfonodos e plano adjuvante.',
  palliative_comfort_care:
    'Sintomas, suporte em uso, rede de apoio e metas de cuidado compartilhadas.',
};

export function getNavigationStepContextHint(stepKeyRaw: string): string | undefined {
  const k = baseNavigationStepKey(stepKeyRaw).toLowerCase();
  if (EXPLICIT[k]) {
    return EXPLICIT[k];
  }
  if (
    k.includes('pathology') ||
    k.includes('biopsy') ||
    k.includes('cytology')
  ) {
    return 'Transcreva o essencial do laudo (diagnóstico, classificação, margens ou material adequado).';
  }
  if (
    k.includes('colonoscopy') ||
    k.includes('cystoscopy') ||
    k.includes('endoscopy') ||
    k.includes('gastroscopy')
  ) {
    return 'Descreva achados do procedimento, complicações e material encaminhado à anatomia, se houver.';
  }
  if (k.includes('ct_') || k.includes('mri') || k.includes('pet') || k.includes('staging')) {
    return 'Indique data do exame, técnica e achados relevantes para decisão terapêutica; compare com estudos prévios.';
  }
  if (
    k.includes('chemotherapy') ||
    k.includes('radiotherapy') ||
    k.includes('bcg') ||
    k.includes('intravesical') ||
    k.includes('immunotherapy') ||
    k.includes('targeted')
  ) {
    return 'Registre linha de tratamento, datas, tolerância e próximos passos acordados com a equipe.';
  }
  if (
    k.includes('surgery') ||
    k.includes('resection') ||
    k.includes('ectomy') ||
    k.includes('colectomy') ||
    k.includes('cystectomy')
  ) {
    return 'Descreva o procedimento, achados relevantes, intercorrências e orientações pós-operatórias.';
  }
  if (k.includes('consultation')) {
    return 'Resuma o motivo do contato, decisões tomadas e encaminhamentos.';
  }
  if (k.includes('cea') || k.includes('psa') || k.includes('marker')) {
    return 'Informe valor, data e tendência em relação a medições anteriores.';
  }
  if (k.includes('cystoscopy') || k.includes('annual') || k.includes('months')) {
    return 'Registre achados do exame de vigilância e comparação com procedimentos anteriores.';
  }
  return 'Complete os campos com dados objetivos (datas, instituição, profissional) e anexe laudos quando disponíveis.';
}
