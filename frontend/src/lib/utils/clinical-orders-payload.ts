import type { ClinicalExamRequestRow } from '@/lib/api/clinical-note-orders';

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
  dosage?: string;
  frequency?: string;
  route?: string;
  duration?: string;
  indication?: string;
};

export type PrescriptionHistoryRow = {
  medicationName: string;
  catalogKey: string | null;
  presentationCatalogCode: string | null;
  dosage: string | null;
  frequency: string | null;
  route: string | null;
  duration: string | null;
  indication: string | null;
};

export function prescriptionDraftFromHistoryRow(
  row: PrescriptionHistoryRow
): PrescriptionDraftFromHistory {
  return {
    medicationName: row.medicationName,
    catalogKey: row.catalogKey ?? undefined,
    presentationCatalogCode: row.presentationCatalogCode ?? undefined,
    dosage: row.dosage ?? undefined,
    frequency: row.frequency ?? undefined,
    route: row.route ?? undefined,
    duration: row.duration ?? undefined,
    indication: row.indication ?? undefined,
  };
}

export function prescriptionDraftsFromNoteRows(
  rows: PrescriptionHistoryRow[],
  clinicalNoteId: string,
  getNoteId: (row: PrescriptionHistoryRow & { clinicalNoteId?: string }) => string
): PrescriptionDraftFromHistory[] {
  return rows
    .filter((r) => getNoteId(r as PrescriptionHistoryRow & { clinicalNoteId: string }) === clinicalNoteId)
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
