/**
 * Converte string de data "somente dia" (YYYY-MM-DD) em Date em UTC ao meio-dia,
 * evitindo deslocamento de calendário por fuso ao persistir em timestamptz.
 * Aceita também ISO completo legado e extrai os primeiros 10 caracteres.
 */
const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parsePerformedAtDateOnly(input: string): Date {
  const trimmed = input.trim();
  const head = trimmed.length >= 10 ? trimmed.slice(0, 10) : trimmed;
  const m = head.match(DATE_ONLY_RE);
  if (!m) {
    throw new Error(
      `performedAt must be YYYY-MM-DD, received: ${input.slice(0, 40)}`,
    );
  }
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (
    !Number.isFinite(y) ||
    mo < 1 ||
    mo > 12 ||
    d < 1 ||
    d > 31
  ) {
    throw new Error(`Invalid calendar date in performedAt: ${head}`);
  }
  const dt = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0, 0));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== mo - 1 ||
    dt.getUTCDate() !== d
  ) {
    throw new Error(`Invalid calendar date in performedAt: ${head}`);
  }
  return dt;
}
