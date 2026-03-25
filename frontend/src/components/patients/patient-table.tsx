'use client';

import { Patient } from '@/lib/api/patients';
import { JOURNEY_STAGE_LABELS } from '@/lib/utils/journey-stage';
import { CANCER_TYPE_LABELS } from '@/lib/utils/patient-cancer-type';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Eye, Edit } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface PatientTableProps {
  patients: Patient[];
  onPatientClick?: (patientId: string) => void;
}

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-800 border-red-300',
  HIGH: 'bg-orange-100 text-orange-800 border-orange-300',
  MEDIUM: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  LOW: 'bg-blue-100 text-blue-800 border-blue-300',
};

function calculateAge(birthDate: string): number {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

export function PatientTable({ patients, onPatientClick }: PatientTableProps) {
  const router = useRouter();

  const handleView = (patientId: string) => {
    if (onPatientClick) {
      onPatientClick(patientId);
    } else {
      router.push(`/patients/${patientId}`);
    }
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold">
                Nome
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold">
                Idade
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold">
                Tipo de Câncer
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold">
                Estágio
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold">
                Prioridade
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold">
                Status
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold">
                Última Atualização
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {patients.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  Nenhum paciente encontrado
                </td>
              </tr>
            ) : (
              patients.map((patient) => (
                <tr
                  key={patient.id}
                  className="hover:bg-muted/50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium">{patient.name}</div>
                  </td>
                  <td className="px-4 py-3">
                    {calculateAge(patient.birthDate)} anos
                  </td>
                  <td className="px-4 py-3">
                    {patient.cancerType ? (
                      <Badge variant="outline">
                        {CANCER_TYPE_LABELS[patient.cancerType] ||
                          patient.cancerType}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {patient.stage ? (
                      <Badge variant="outline">{patient.stage}</Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant="outline"
                      className={
                        PRIORITY_COLORS[patient.priorityCategory] || ''
                      }
                    >
                      {patient.priorityCategory}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">
                      {JOURNEY_STAGE_LABELS[patient.currentStage] ||
                        patient.currentStage}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {format(
                      new Date(patient.updatedAt),
                      "dd/MM/yyyy 'às' HH:mm",
                      {
                        locale: ptBR,
                      }
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleView(patient.id)}
                        title="Ver detalhes"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/patients/${patient.id}/edit`);
                        }}
                        title="Editar paciente"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
