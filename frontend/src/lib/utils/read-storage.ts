/**
 * Utilitários para marcar conversas como "lidas" (abertas) vs "assumidas".
 * Ler = abrir a conversa (apenas visualizar).
 * Assumir = clicar no botão "Assumir" (ação explícita).
 */

const READ_PATIENT_IDS_KEY = 'ONCONAV-chat-read-patient-ids';

/**
 * Obtém os IDs de pacientes cujas conversas foram lidas (abertas).
 */
export function getReadPatientIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();

  try {
    const stored = localStorage.getItem(READ_PATIENT_IDS_KEY);
    if (!stored) return new Set();

    const ids = JSON.parse(stored) as string[];
    return new Set(ids);
  } catch {
    return new Set();
  }
}

/** Nome do evento disparado quando conversas são marcadas como lidas */
export const READ_PATIENTS_UPDATED_EVENT = 'onconav-read-patients-updated';

/**
 * Marca a conversa de um paciente como lida (foi aberta/visualizada).
 * Não assume a conversa - apenas registra que o profissional visualizou.
 * Dispara evento para outros componentes (ex: navbar) atualizarem.
 */
export function markPatientAsRead(patientId: string): void {
  if (typeof window === 'undefined' || !patientId) return;

  try {
    const current = getReadPatientIds();
    current.add(patientId);
    localStorage.setItem(READ_PATIENT_IDS_KEY, JSON.stringify([...current]));
    window.dispatchEvent(new CustomEvent(READ_PATIENTS_UPDATED_EVENT));
  } catch (error) {
    console.error('Erro ao marcar conversa como lida:', error);
  }
}

/**
 * Retorna os IDs de pacientes com conversas não lidas.
 * Não lida = tem mensagens não assumidas E o profissional não abriu a conversa.
 */
export function getUnreadPatientIds(unassumedPatientIds: string[]): string[] {
  const readIds = getReadPatientIds();
  return unassumedPatientIds.filter((id) => !readIds.has(id));
}
