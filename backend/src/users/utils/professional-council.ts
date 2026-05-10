import { ClinicalSubrole, UserRole } from '@generated/prisma/client';

export function isDoctorRole(role: UserRole): boolean {
  return role === UserRole.ONCOLOGIST || role === UserRole.DOCTOR;
}

export function isNurseRole(role: UserRole): boolean {
  return role === UserRole.NURSE || role === UserRole.NURSE_CHIEF;
}

export function normalizeUf(uf: string): string {
  return uf.trim().toUpperCase();
}

/** Normaliza número de conselho: trim e remove espaços internos. */
export function normalizeCouncilNumber(value: string): string {
  return value.trim().replace(/\s+/g, '');
}

export type CouncilFields = {
  crmUf: string | null;
  crmNumber: string | null;
  corenUf: string | null;
  corenNumber: string | null;
};

export function emptyCouncilFields(): CouncilFields {
  return {
    crmUf: null,
    crmNumber: null,
    corenUf: null,
    corenNumber: null,
  };
}

function buildCrmFields(input: {
  crmUf?: string | null;
  crmNumber?: string | null;
}): CouncilFields {
  const crmUf =
    input.crmUf !== undefined && input.crmUf !== null
      ? normalizeUf(String(input.crmUf))
      : '';
  const crmNumber =
    input.crmNumber !== undefined && input.crmNumber !== null
      ? normalizeCouncilNumber(String(input.crmNumber))
      : '';
  return {
    crmUf: crmUf || null,
    crmNumber: crmNumber || null,
    corenUf: null,
    corenNumber: null,
  };
}

function buildCorenFields(input: {
  corenUf?: string | null;
  corenNumber?: string | null;
}): CouncilFields {
  const corenUf =
    input.corenUf !== undefined && input.corenUf !== null
      ? normalizeUf(String(input.corenUf))
      : '';
  const corenNumber =
    input.corenNumber !== undefined && input.corenNumber !== null
      ? normalizeCouncilNumber(String(input.corenNumber))
      : '';
  return {
    crmUf: null,
    crmNumber: null,
    corenUf: corenUf || null,
    corenNumber: corenNumber || null,
  };
}

/**
 * Persistência: par de conselho conforme papel e subpapel clínico (coord./admin);
 * apenas um par ativo; demais anulados.
 */
export function councilFieldsForRole(
  role: UserRole,
  input: {
    crmUf?: string | null;
    crmNumber?: string | null;
    corenUf?: string | null;
    corenNumber?: string | null;
  },
  clinicalSubrole?: ClinicalSubrole | null
): CouncilFields {
  if (isDoctorRole(role)) {
    return buildCrmFields(input);
  }
  if (isNurseRole(role)) {
    return buildCorenFields(input);
  }
  if (role === UserRole.COORDINATOR || role === UserRole.ADMIN) {
    if (clinicalSubrole === ClinicalSubrole.MEDICAL) {
      return buildCrmFields(input);
    }
    if (clinicalSubrole === ClinicalSubrole.NURSING) {
      return buildCorenFields(input);
    }
    return emptyCouncilFields();
  }
  return emptyCouncilFields();
}

/** Mensagem de erro de negócio ou null se válido. */
export function councilValidationMessage(
  role: UserRole,
  fields: CouncilFields,
  clinicalSubrole?: ClinicalSubrole | null
): string | null {
  if (isDoctorRole(role)) {
    if (!fields.crmUf || !fields.crmNumber) {
      return 'UF e número do CRM são obrigatórios para oncologistas e médicos.';
    }
    return null;
  }
  if (isNurseRole(role)) {
    if (!fields.corenUf || !fields.corenNumber) {
      return 'UF e número do COREN são obrigatórios para enfermeiros.';
    }
    return null;
  }
  if (role === UserRole.COORDINATOR || role === UserRole.ADMIN) {
    if (clinicalSubrole === ClinicalSubrole.MEDICAL) {
      if (!fields.crmUf || !fields.crmNumber) {
        return 'UF e número do CRM são obrigatórios quando o subpapel clínico é médico.';
      }
      return null;
    }
    if (clinicalSubrole === ClinicalSubrole.NURSING) {
      if (!fields.corenUf || !fields.corenNumber) {
        return 'UF e número do COREN são obrigatórios quando o subpapel clínico é enfermagem.';
      }
      return null;
    }
  }
  return null;
}
