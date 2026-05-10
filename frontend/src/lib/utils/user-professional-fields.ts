import type { ClinicalSubrole, UserRole } from '@/lib/api/users';

const doctorRoles: UserRole[] = ['ONCOLOGIST', 'DOCTOR'];
const nurseRoles: UserRole[] = ['NURSE', 'NURSE_CHIEF'];

export function isDoctorRole(r: UserRole): boolean {
  return doctorRoles.includes(r);
}

export function isNurseRole(r: UserRole): boolean {
  return nurseRoles.includes(r);
}

/** CRM obrigatório: médicos OU coord./admin com competência médica no prontuário */
export function needsCrm(
  role: UserRole,
  clinicalSubrole: '' | ClinicalSubrole
): boolean {
  return (
    isDoctorRole(role) ||
    ((role === 'COORDINATOR' || role === 'ADMIN') &&
      clinicalSubrole === 'MEDICAL')
  );
}

/** COREN obrigatório: enfermeiros OU coord./admin com competência de enfermagem */
export function needsCoren(
  role: UserRole,
  clinicalSubrole: '' | ClinicalSubrole
): boolean {
  return (
    isNurseRole(role) ||
    ((role === 'COORDINATOR' || role === 'ADMIN') &&
      clinicalSubrole === 'NURSING')
  );
}
