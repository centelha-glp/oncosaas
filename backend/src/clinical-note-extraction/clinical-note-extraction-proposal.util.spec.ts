import { buildClinicalExtractionProposalSummary } from './clinical-note-extraction-proposal.util';

describe('buildClinicalExtractionProposalSummary', () => {
  it('returns null for empty payload', () => {
    expect(buildClinicalExtractionProposalSummary(null)).toBeNull();
  });

  it('counts domains from structured payload', () => {
    const summary = buildClinicalExtractionProposalSummary({
      extraction_schema_version: '1',
      clinical_exam_requests: [{ display_name: 'Hemograma' }],
      medications: [{ name: 'Dipirona' }, { name: 'Omeprazol' }],
      patient_patch: { stage: 'III' },
    });
    expect(summary).toEqual(
      expect.objectContaining({
        clinicalExamRequests: 1,
        medications: 2,
        patientPatchFieldCount: 1,
      })
    );
  });

  it('accepts proposedPayload shape with extended v3 domains', () => {
    const payload = {
      extraction_schema_version: '2026-05-15-v3',
      degraded: false,
      parse_ok: true,
      llm_available: true,
      rejection_report: [],
      clinical_exam_requests: [],
      medications: [],
      comorbidities: [],
      patient_patch: {},
      journey_patch: {},
      diagnoses: [],
      treatments: [],
      navigation_step_updates: [],
      complementary_exams: [],
      observations: [],
      performance_status_history: [],
      clinical_prescription_lines: [],
      questionnaire_responses: [],
    };
    const summary = buildClinicalExtractionProposalSummary(payload);
    expect(summary).toEqual(
      expect.objectContaining({
        clinicalExamRequests: 0,
        medications: 0,
        diagnoses: 0,
        treatments: 0,
      })
    );
  });
});
