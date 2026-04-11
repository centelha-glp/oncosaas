/** ID estável para scroll/destaque na validação (path RHF com `.` → `--`). */
export function patientEditFieldId(path: string): string {
  return `patient-edit-field-${path.replace(/\./g, '--')}`;
}

/** Faz scroll até o primeiro elemento existente (path completo ou prefixos). */
export function scrollFieldPathIntoView(fieldPath: string): void {
  if (typeof document === 'undefined') return;
  const segments = fieldPath.split('.');
  for (let len = segments.length; len >= 1; len--) {
    const tryPath = segments.slice(0, len).join('.');
    const el = document.getElementById(patientEditFieldId(tryPath));
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
  }
}
