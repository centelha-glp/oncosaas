/**
 * Normaliza linhas geradas para evolução: remove o prefixo "rótulo:" quando há valor,
 * preservando indentação, bullets (•) e linhas-guia que terminam em ":" sem conteúdo.
 */
export function normalizeEvolutionLine(line: string): string {
  const m = /^(\s*)(•\s*)?(.*)$/.exec(line);
  if (!m) {
    return line;
  }
  const indent = m[1];
  const bullet = m[2] ?? '';
  const core = m[3];
  const colonIdx = core.indexOf(':');
  if (colonIdx === -1) {
    return line;
  }
  // Linhas tipo "• Exame (12/05/2026): valor" — manter o rótulo com data entre parênteses.
  if (colonIdx > 0 && core[colonIdx - 1] === ')') {
    return line;
  }
  const value = core.slice(colonIdx + 1).trim();
  if (value === '') {
    return line;
  }
  return `${indent}${bullet}${value}`;
}

/** Aplica {@link normalizeEvolutionLine} a cada linha do texto. */
export function normalizeEvolutionSectionBody(body: string): string {
  if (!body) {
    return body;
  }
  return body
    .split('\n')
    .map((ln) => normalizeEvolutionLine(ln))
    .join('\n');
}
