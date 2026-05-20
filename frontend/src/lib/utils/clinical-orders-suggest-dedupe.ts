import type {
  ClinicalExamRequestRow,
  ClinicalPrescriptionLineRow,
} from '@/lib/api/clinical-note-orders';

export function normalizeClinicalOrderNameKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function isDuplicateExamSuggestion(
  displayName: string,
  existing: Pick<ClinicalExamRequestRow, 'displayName'>[]
): boolean {
  const key = normalizeClinicalOrderNameKey(displayName);
  if (!key) return true;
  return existing.some(
    (row) => normalizeClinicalOrderNameKey(row.displayName) === key
  );
}

export function isDuplicatePrescriptionSuggestion(
  medicationName: string,
  existing: Pick<ClinicalPrescriptionLineRow, 'medicationName'>[]
): boolean {
  const key = normalizeClinicalOrderNameKey(medicationName);
  if (!key) return true;
  return existing.some(
    (row) => normalizeClinicalOrderNameKey(row.medicationName) === key
  );
}
