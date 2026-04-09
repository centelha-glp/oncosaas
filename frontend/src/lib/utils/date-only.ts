/** Data local do dispositivo no formato YYYY-MM-DD (para defaults de formulário). */
export function todayLocalYyyyMmDd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Envia ao backend como date-only (evita toISOString() que desloca o dia). */
export function toPerformedAtApiPayload(dateYyyyMmDd: string): string {
  return dateYyyyMmDd.trim().slice(0, 10);
}
