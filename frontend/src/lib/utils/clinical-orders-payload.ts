import type {
  ClinicalExamRequestRow,
  ClinicalExamRequestSuggestion,
  ClinicalPrescriptionLineRow,
  ClinicalPrescriptionLineSuggestion,
  PrescriptionLineBody,
} from '@/lib/api/clinical-note-orders';

export type ExamRequestCreatePayload = {
  displayName: string;
  code?: string;
  examCatalogCode?: string;
};

export function buildExamRequestPayload(args: {
  displayName: string;
  catalogSelection: ExamRequestCreatePayload | null;
}): ExamRequestCreatePayload {
  const trimmed = args.displayName.trim();
  if (args.catalogSelection?.examCatalogCode) {
    return {
      displayName: args.catalogSelection.displayName.trim() || trimmed,
      code: args.catalogSelection.code,
      examCatalogCode: args.catalogSelection.examCatalogCode,
    };
  }
  return { displayName: trimmed };
}

export type PrescriptionDraftFromHistory = {
  medicationName: string;
  catalogKey?: string;
  presentationCatalogCode?: string;
  quantity?: string;
  dosage?: string;
  frequency?: string;
  route?: string;
  duration?: string;
  observation?: string;
};

export type PrescriptionHistoryRow = {
  medicationName: string;
  catalogKey: string | null;
  presentationCatalogCode: string | null;
  quantity?: string | null;
  dosage: string | null;
  frequency: string | null;
  route: string | null;
  duration: string | null;
  indication?: string | null;
  observation?: string | null;
};

function observationFromRow(
  row: Pick<PrescriptionHistoryRow, 'observation' | 'indication'>
): string | undefined {
  return row.observation ?? row.indication ?? undefined;
}

export function prescriptionDraftFromHistoryRow(
  row: PrescriptionHistoryRow
): PrescriptionDraftFromHistory {
  return {
    medicationName: row.medicationName,
    catalogKey: row.catalogKey ?? undefined,
    presentationCatalogCode: row.presentationCatalogCode ?? undefined,
    quantity: row.quantity ?? '1',
    dosage: row.dosage ?? undefined,
    frequency: row.frequency ?? undefined,
    route: row.route ?? undefined,
    duration: row.duration ?? undefined,
    observation: observationFromRow(row),
  };
}

export function prescriptionDraftFromLineRow(
  row: ClinicalPrescriptionLineRow
): PrescriptionDraftFromHistory {
  return prescriptionDraftFromHistoryRow({
    medicationName: row.medicationName,
    catalogKey: row.catalogKey,
    presentationCatalogCode: row.presentationCatalogCode,
    quantity: row.quantity,
    dosage: row.dosage,
    frequency: row.frequency,
    route: row.route,
    duration: row.duration,
    observation: row.observation,
    indication: row.indication,
  });
}

export function prescriptionDraftsFromNoteRows(
  rows: PrescriptionHistoryRow[],
  clinicalNoteId: string,
  getNoteId: (row: PrescriptionHistoryRow & { clinicalNoteId?: string }) => string
): PrescriptionDraftFromHistory[] {
  return rows
    .filter(
      (r) =>
        getNoteId(r as PrescriptionHistoryRow & { clinicalNoteId: string }) ===
        clinicalNoteId
    )
    .map(prescriptionDraftFromHistoryRow);
}

export function examRequestPayloadFromRow(
  row: Pick<ClinicalExamRequestRow, 'displayName' | 'code' | 'examCatalogCode'>
): ExamRequestCreatePayload {
  return buildExamRequestPayload({
    displayName: row.displayName,
    catalogSelection: row.examCatalogCode
      ? {
          displayName: row.displayName,
          code: row.code ?? undefined,
          examCatalogCode: row.examCatalogCode,
        }
      : null,
  });
}

const SUGGEST_PLACEHOLDER = 'a definir';

export function examRequestPayloadFromSuggestion(
  item: ClinicalExamRequestSuggestion
): ExamRequestCreatePayload {
  const displayName = item.display_name.trim();
  const code = item.code?.trim() || item.loinc_code?.trim() || undefined;
  return buildExamRequestPayload({
    displayName,
    catalogSelection: code
      ? { displayName, code, examCatalogCode: code }
      : null,
  });
}

export function prescriptionLineBodyFromSuggestion(
  item: ClinicalPrescriptionLineSuggestion
): PrescriptionLineBody {
  return {
    medicationName: item.medication_name.trim(),
    catalogKey: item.catalog_key?.trim() || undefined,
    quantity: '1',
    dosage: item.dosage?.trim() || SUGGEST_PLACEHOLDER,
    frequency: item.frequency?.trim() || SUGGEST_PLACEHOLDER,
    route: item.route?.trim() || 'VO',
    duration: item.duration?.trim() || SUGGEST_PLACEHOLDER,
    observation: item.indication?.trim() || undefined,
  };
}
