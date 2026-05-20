export type MedicationCatalogEntryDto = {
  drugCode: string;
  presentationCode: string | null;
  label: string;
  displayName: string;
  strength: string | null;
  allowedRoutes: string[];
};

export function buildMedicationCatalogEntryLabel(
  displayName: string,
  strength: string | null | undefined,
  form: string | null | undefined
): string {
  const segments = [displayName];
  if (strength?.trim()) {
    segments.push(strength.trim());
  }
  if (form?.trim()) {
    segments.push(`(${form.trim()})`);
  }
  return segments.join(' — ');
}

export function mapPresentationToEntry(presentation: {
  code: string;
  label: string;
  strength: string | null;
  form: string | null;
  drug: { code: string; displayName: string; allowedRoutes: string[] };
}): MedicationCatalogEntryDto {
  const { drug } = presentation;
  return {
    drugCode: drug.code,
    presentationCode: presentation.code,
    displayName: drug.displayName,
    strength: presentation.strength,
    allowedRoutes: drug.allowedRoutes,
    label: buildMedicationCatalogEntryLabel(
      drug.displayName,
      presentation.strength,
      presentation.form
    ),
  };
}
