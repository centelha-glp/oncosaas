import { normalizeExamLabelKey } from './collapse-redundant-components.util';

export const CANONICAL_GROUP_RENAL_CREAT_ETFG = 'RENAL_CREAT_ETFG';
export const CANONICAL_GROUP_VIT_D_25OH = 'VIT_D_25OH';

const RENAL_CREAT_CODES = new Set(['CREAT', 'CR']);

function isUrinaryCreatinineName(name: string): boolean {
  const n = name.toLowerCase();
  return (
    /creatinina.*urin|urin[aá].*creatinina|clearance|depura[cç][aã]o/.test(n) ||
    /creatinina.*24\s*h|24\s*h.*creatinina|creatinina.*24h|24h.*creatinina/.test(
      n
    )
  );
}

function isUrinaryCreatinineCode(code: string | null | undefined): boolean {
  const c = (code ?? '').trim().toUpperCase();
  return c === 'CREAT-U' || c === 'CREAT-24H';
}

function matchesRenalCreatEtfg(
  type: string,
  name: string,
  code?: string | null
): boolean {
  if (type !== 'LABORATORY') {
    return false;
  }
  if (isUrinaryCreatinineName(name) || isUrinaryCreatinineCode(code)) {
    return false;
  }

  const c = (code ?? '').trim().toUpperCase();
  if (c && RENAL_CREAT_CODES.has(c)) {
    return true;
  }

  const n = name.toLowerCase();
  if (/creatinina/.test(n)) {
    return true;
  }

  return false;
}

function matchesVitD25oh(type: string, name: string): boolean {
  if (type !== 'LABORATORY') {
    return false;
  }
  const n = name.toLowerCase();

  if (/25[\s-]*hidroxi[\s-]*vitamina\s*d|25[\s-]*hidroxi\s*vit\s*d/.test(n)) {
    return true;
  }

  const hasVitD =
    /vitamina\s*d\b|vit\s*d\b/.test(n) || /^vit\s*d\b/.test(n.trim());
  const has25oh =
    /25\s*\(?\s*oh\s*\)?\s*d|25[\s-]*oh|25[\s-]*hidroxi|\(oh\)d/.test(n);

  if (hasVitD && has25oh) {
    return true;
  }

  if (/25[\s-]*hidroxi/.test(n) && /vit/.test(n)) {
    return true;
  }

  return false;
}

/**
 * Identificador estável para agrupar sinónimos clínicos (UI + ingestão).
 * Ordem: regras canónicas → LOINC → nome normalizado.
 */
export function resolveCanonicalExamGroupId(
  type: string,
  name: string,
  code?: string | null,
  loincCode?: string | null
): string {
  if (matchesRenalCreatEtfg(type, name, code)) {
    return `CANON|${CANONICAL_GROUP_RENAL_CREAT_ETFG}`;
  }
  if (matchesVitD25oh(type, name)) {
    return `CANON|${CANONICAL_GROUP_VIT_D_25OH}`;
  }

  const trimmedLoinc =
    loincCode === null || loincCode === undefined
      ? ''
      : String(loincCode).trim();
  if (trimmedLoinc) {
    return `LOINC|${normalizeExamLabelKey(trimmedLoinc)}`;
  }

  return `NAME|${normalizeExamLabelKey(name)}`;
}

export function preferredDisplayNameForGroup(
  canonicalId: string,
  fallbackName: string
): string {
  if (canonicalId === `CANON|${CANONICAL_GROUP_RENAL_CREAT_ETFG}`) {
    return 'Creatinina';
  }
  if (canonicalId === `CANON|${CANONICAL_GROUP_VIT_D_25OH}`) {
    return 'Vitamina D 25-OH';
  }
  return fallbackName;
}
