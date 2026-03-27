'use client';

import { PatientDetail } from '@/lib/api/patients';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PatientSummaryCard } from './patient-summary-card';
import { JOURNEY_STAGE_LABELS } from '@/lib/utils/journey-stage';

interface PatientOverviewTabProps {
  patient: PatientDetail;
}

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

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-800 border-red-300',
  HIGH: 'bg-orange-100 text-orange-800 border-orange-300',
  MEDIUM: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  LOW: 'bg-blue-100 text-blue-800 border-blue-300',
};

export function PatientOverviewTab({ patient }: PatientOverviewTabProps) {
  return (
    <div className="space-y-6">
      {/* Resumo Inteligente via IA */}
      <PatientSummaryCard patientId={patient.id} />

      {/* Dados Básicos */}
      <Card>
        <CardHeader>
          <CardTitle>Dados Básicos</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Nome
            </label>
            <p className="text-lg font-semibold">{patient.name}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Idade
            </label>
            <p className="text-lg">{calculateAge(patient.birthDate)} anos</p>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              CPF
            </label>
            <p className="text-lg">{patient.cpf || '-'}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Sexo
            </label>
            <p className="text-lg">
              {patient.gender === 'male'
                ? 'Masculino'
                : patient.gender === 'female'
                  ? 'Feminino'
                  : patient.gender || '-'}
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Telefone
            </label>
            <p className="text-lg">{patient.phone}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Email
            </label>
            <p className="text-lg">{patient.email || '-'}</p>
          </div>
        </CardContent>
      </Card>

      {/* Status e Prioridade */}
      <Card>
        <CardHeader>
          <CardTitle>Status e Prioridade</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Estágio da Jornada
              </label>
              <div className="mt-1">
                <Badge variant="outline">
                  {JOURNEY_STAGE_LABELS[patient.currentStage] ||
                    patient.currentStage}
                </Badge>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Prioridade
              </label>
              <div className="mt-1">
                <Badge
                  variant="outline"
                  className={PRIORITY_COLORS[patient.priorityCategory] || ''}
                >
                  {patient.priorityCategory} (Score: {patient.priorityScore})
                </Badge>
              </div>
            </div>
          </div>
          {patient.priorityReason && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Razão da Prioridade
              </label>
              <p className="text-sm mt-1">{patient.priorityReason}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
