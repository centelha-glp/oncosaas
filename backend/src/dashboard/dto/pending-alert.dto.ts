/**
 * Alerta pendente para drill-down do indicador "Alertas Pendentes".
 */
export interface PendingAlertDto {
  id: string;
  type: string;
  severity: string;
  message: string;
  status: string;
  createdAt: string; // ISO
  patientId: string;
  patient: {
    id: string;
    name: string;
    phone: string | null;
  };
}
