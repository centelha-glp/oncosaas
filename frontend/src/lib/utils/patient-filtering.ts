import { Patient } from '@/lib/api/patients';

export interface PatientFilters {
  searchTerm?: string;
  priorityCategory?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | null;
  cancerType?: string | null;
  /** Quando true, mostra apenas conversas com mensagens não assumidas (não lidas) */
  unreadOnly?: boolean;
  /** IDs de pacientes com mensagens não assumidas (usado quando unreadOnly=true) */
  unreadPatientIds?: Set<string>;
}

/**
 * Filtra pacientes por termo de busca (nome ou CPF parcial)
 * Busca case-insensitive e parcial
 *
 * @param patients - Lista de pacientes
 * @param searchTerm - Termo de busca
 * @returns Lista filtrada de pacientes
 */
export function filterPatientsBySearch(
  patients: Patient[],
  searchTerm: string
): Patient[] {
  if (!searchTerm.trim()) {
    return patients;
  }

  const normalizedSearch = searchTerm.trim().toLowerCase();

  return patients.filter((patient) => {
    // Buscar por nome
    const nameMatch = patient.name.toLowerCase().includes(normalizedSearch);

    // Buscar por CPF (se existir e se termo contém números)
    const normalizedSearchNumbers = normalizedSearch.replace(/\D/g, '');
    const cpfMatch =
      patient.cpf &&
      normalizedSearchNumbers.length > 0 &&
      patient.cpf.replace(/\D/g, '').includes(normalizedSearchNumbers);

    return nameMatch || cpfMatch;
  });
}

/**
 * Filtra pacientes por múltiplos critérios
 *
 * @param patients - Lista de pacientes
 * @param filters - Objeto com filtros a aplicar
 * @returns Lista filtrada de pacientes
 */
export function filterPatients(
  patients: Patient[],
  filters: PatientFilters
): Patient[] {
  let filtered = [...patients];

  // Filtro por termo de busca
  if (filters.searchTerm) {
    filtered = filterPatientsBySearch(filtered, filters.searchTerm);
  }

  // Filtro por categoria de prioridade
  if (filters.priorityCategory) {
    filtered = filtered.filter(
      (patient) => patient.priorityCategory === filters.priorityCategory
    );
  }

  // Filtro por tipo de câncer
  if (filters.cancerType) {
    filtered = filtered.filter((patient) => {
      // Verificar se tem diagnóstico com o tipo de câncer especificado
      if (patient.cancerDiagnoses && patient.cancerDiagnoses.length > 0) {
        return patient.cancerDiagnoses.some((diagnosis) =>
          diagnosis.cancerType
            .toLowerCase()
            .includes(filters.cancerType!.toLowerCase())
        );
      }
      // Fallback para cancerType legado
      return (
        patient.cancerType &&
        patient.cancerType
          .toLowerCase()
          .includes(filters.cancerType!.toLowerCase())
      );
    });
  }

  // Filtro "Não lidas" - apenas conversas com mensagens não assumidas
  if (filters.unreadOnly && filters.unreadPatientIds?.size) {
    filtered = filtered.filter((patient) =>
      filters.unreadPatientIds!.has(patient.id)
    );
  }

  return filtered;
}
