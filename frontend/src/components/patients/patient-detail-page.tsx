'use client';

import { usePatientDetail } from '@/hooks/use-patient-detail';
import { PatientDetailTabs } from './patient-detail-tabs';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Edit } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';

interface PatientDetailPageProps {
  patientId: string;
}

const TAB_QUERY_VALUES = [
  'overview',
  'clinical',
  'oncology',
  'treatment',
  'navigation',
  'chart',
] as const;

export function PatientDetailPage({ patientId }: PatientDetailPageProps) {
  const { data: patient, isLoading, error } = usePatientDetail(patientId);
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const defaultTab =
    tabParam && TAB_QUERY_VALUES.includes(tabParam as (typeof TAB_QUERY_VALUES)[number])
      ? (tabParam as (typeof TAB_QUERY_VALUES)[number])
      : undefined;

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center py-12 text-muted-foreground">
          Carregando dados do paciente...
        </div>
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className="p-6">
        <div className="text-destructive">
          Erro ao carregar paciente:{' '}
          {error?.message || 'Paciente não encontrado'}
        </div>
        <Button
          variant="outline"
          onClick={() => router.push('/patients')}
          className="mt-4"
        >
          Voltar para lista
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/patients')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{patient.name}</h1>
            <p className="text-muted-foreground mt-1">
              Detalhes do paciente oncológico
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => router.push(`/patients/${patient.id}/edit`)}
        >
          <Edit className="h-4 w-4 mr-2" />
          Editar
        </Button>
      </div>

      {/* Tabs */}
      <Card>
        <CardContent className="p-6">
          <PatientDetailTabs patient={patient} defaultTab={defaultTab} />
        </CardContent>
      </Card>
    </div>
  );
}
