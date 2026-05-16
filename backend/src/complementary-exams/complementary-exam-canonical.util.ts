import {
  buildComplementaryExamMatchKey,
  preferredDisplayNameForIdentity,
  resolveExamIdentity,
} from './complementary-exam-identity.util';

export const CANONICAL_GROUP_RENAL_CREAT_ETFG = 'RENAL_CREAT_ETFG';
export const CANONICAL_GROUP_VIT_D_25OH = 'VIT_D_25OH';

/** @deprecated Use resolveExamIdentity — mantido para testes legados. */
export function resolveCanonicalExamGroupId(
  type: string,
  name: string,
  code?: string | null,
  loincCode?: string | null,
): string {
  const identity = resolveExamIdentity(type, name, code, loincCode);
  const prefix = `${type.trim().toUpperCase()}|`;
  return identity.groupKey.startsWith(prefix)
    ? identity.groupKey.slice(prefix.length)
    : identity.groupKey;
}

export function preferredDisplayNameForGroup(
  canonicalId: string,
  fallbackName: string,
): string {
  const renal = `CANON|${CANONICAL_GROUP_RENAL_CREAT_ETFG}`;
  const vit = `CANON|${CANONICAL_GROUP_VIT_D_25OH}`;
  if (canonicalId === renal) {return 'Creatinina';}
  if (canonicalId === vit) {return 'Vitamina D 25-OH';}
  if (canonicalId.startsWith('CATALOG|')) {
    const code = canonicalId.slice('CATALOG|'.length);
    if (code === 'UREIA') {return 'Ureia';}
    if (code === 'HIV') {return 'HIV';}
  }
  return fallbackName;
}

export {
  buildComplementaryExamMatchKey,
  resolveExamIdentity,
  preferredDisplayNameForIdentity,
};
