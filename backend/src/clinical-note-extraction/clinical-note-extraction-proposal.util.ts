import type { AiClinicalEvolutionStructureResponse } from './clinical-note-extraction.types';

/** Resumo sem texto clínico completo — adequado para UI e logs. */
export type ClinicalExtractionProposalSummary = {
  clinicalExamRequests: number;
  medications: number;
  comorbidities: number;
  patientPatchFieldCount: number;
  journeyPatchFieldCount: number;
  diagnoses: number;
  treatments: number;
  navigationStepUpdates: number;
  complementaryExams: number;
  observations: number;
  performanceStatusHistory: number;
  clinicalPrescriptionLines: number;
  questionnaireResponses: number;
};

export function buildClinicalExtractionProposalSummary(
  payload: AiClinicalEvolutionStructureResponse | null | undefined
): ClinicalExtractionProposalSummary | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  const patientPatch = payload.patient_patch ?? {};
  const journeyPatch = payload.journey_patch ?? {};
  return {
    clinicalExamRequests: payload.clinical_exam_requests?.length ?? 0,
    medications: payload.medications?.length ?? 0,
    comorbidities: payload.comorbidities?.length ?? 0,
    patientPatchFieldCount: Object.keys(patientPatch).filter(
      (k) => (patientPatch as Record<string, unknown>)[k] !== undefined
    ).length,
    journeyPatchFieldCount: Object.keys(journeyPatch).filter(
      (k) => (journeyPatch as Record<string, unknown>)[k] !== undefined
    ).length,
    diagnoses: payload.diagnoses?.length ?? 0,
    treatments: payload.treatments?.length ?? 0,
    navigationStepUpdates: payload.navigation_step_updates?.length ?? 0,
    complementaryExams: payload.complementary_exams?.length ?? 0,
    observations: payload.observations?.length ?? 0,
    performanceStatusHistory: payload.performance_status_history?.length ?? 0,
    clinicalPrescriptionLines: payload.clinical_prescription_lines?.length ?? 0,
    questionnaireResponses: payload.questionnaire_responses?.length ?? 0,
  };
}
