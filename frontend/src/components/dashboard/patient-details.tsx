'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  User,
  Phone,
  Calendar,
  FileText,
  Activity,
  AlertCircle,
  Mail,
  Pencil,
} from 'lucide-react';
import { Patient } from '@/lib/api/patients';
import { getCancerTypeLabel } from '@/lib/utils/patient-cancer-type';
import { OncologyNavigationPanel } from './oncology-navigation-panel';
import { PatientEditDialog } from '@/components/patients/patient-edit-dialog';
import { Button } from '@/components/ui/button';

interface PatientDetailsProps {
  patient: Patient | null;
  isLoading?: boolean;
}

export function PatientDetails({ patient, isLoading }: PatientDetailsProps) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  if (isLoading) {
    return (
      <div className="bg-white p-4 space-y-4">
        <div className="h-6 bg-gray-200 rounded animate-pulse w-3/4"></div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-4 bg-gray-100 rounded animate-pulse"
            ></div>
          ))}
        </div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="bg-white p-4 text-center text-gray-500">
        <p>Selecione um paciente para ver os detalhes</p>
      </div>
    );
  }

  const getPriorityColor = (category: string) => {
    switch (category?.toUpperCase()) {
      case 'CRITICAL':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'HIGH':
        return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'MEDIUM':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'LOW':
        return 'text-green-600 bg-green-50 border-green-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const calculateAge = (birthDate: string | null) => {
    if (!birthDate) return '—';
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birth.getDate())
    ) {
      age--;
    }
    return age;
  };

  return (
    <div className="bg-white p-4 space-y-4">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <User className="h-5 w-5" />
          Detalhes do Paciente
        </h2>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 gap-1.5"
          onClick={() => setIsEditDialogOpen(true)}
        >
          <Pencil className="h-4 w-4" />
          Editar
        </Button>
      </div>

      {/* Informações Básicas */}
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <User className="h-5 w-5 text-gray-400 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-gray-500">Nome Completo</p>
            <p className="font-semibold">{patient.name}</p>
          </div>
        </div>

        {patient.cpf && (
          <div className="flex items-start gap-3">
            <FileText className="h-5 w-5 text-gray-400 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-gray-500">CPF</p>
              <p className="font-mono text-sm">{patient.cpf}</p>
            </div>
          </div>
        )}

        {patient.phone && (
          <div className="flex items-start gap-3">
            <Phone className="h-5 w-5 text-gray-400 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-gray-500">Telefone</p>
              <p className="font-mono text-sm">{patient.phone}</p>
            </div>
          </div>
        )}

        {patient.birthDate && (
          <div className="flex items-start gap-3">
            <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-gray-500">Data de Nascimento</p>
              <p className="text-sm">
                {format(new Date(patient.birthDate), "dd 'de' MMMM 'de' yyyy", {
                  locale: ptBR,
                })}{' '}
                ({calculateAge(patient.birthDate)} anos)
              </p>
            </div>
          </div>
        )}

        {patient.email && (
          <div className="flex items-start gap-3">
            <Mail className="h-5 w-5 text-gray-400 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-gray-500">Email</p>
              <p className="text-sm">{patient.email}</p>
            </div>
          </div>
        )}
      </div>

      {/* Informações Clínicas */}
      <div className="border-t pt-4 space-y-4">
        <h3 className="font-semibold text-gray-700 flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Informações Clínicas
        </h3>

        {/* Status da Jornada */}
        <div>
          <p className="text-sm text-gray-500">Fase Atual</p>
          <p className="font-semibold capitalize">
            {patient.currentStage === 'SCREENING' && '🔍 Em Rastreio'}
            {patient.currentStage === 'NAVIGATION' && '🧭 Navegação'}
            {patient.currentStage === 'DIAGNOSIS' && '📋 Diagnóstico'}
            {patient.currentStage === 'TREATMENT' && '💊 Tratamento'}
            {patient.currentStage === 'FOLLOW_UP' && '📅 Seguimento'}
            {![
              'SCREENING',
              'NAVIGATION',
              'DIAGNOSIS',
              'TREATMENT',
              'FOLLOW_UP',
            ].includes(patient.currentStage) && patient.currentStage}
          </p>
        </div>

        {/* Informações de Rastreio */}
        {patient.currentStage === 'SCREENING' && patient.journey && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
            <p className="text-sm font-semibold text-blue-900">
              Rastreio em Andamento
            </p>
            {patient.journey.screeningDate && (
              <div>
                <p className="text-xs text-blue-700">Data do Rastreio</p>
                <p className="text-sm text-blue-900">
                  {format(
                    new Date(patient.journey.screeningDate),
                    "dd 'de' MMMM 'de' yyyy",
                    {
                      locale: ptBR,
                    }
                  )}
                </p>
              </div>
            )}
            {patient.journey.screeningResult && (
              <div>
                <p className="text-xs text-blue-700">Resultado</p>
                <p className="text-sm text-blue-900">
                  {patient.journey.screeningResult}
                </p>
              </div>
            )}
            {!patient.journey.screeningDate &&
              !patient.journey.screeningResult && (
                <p className="text-sm text-blue-700">
                  Aguardando início do rastreio
                </p>
              )}
          </div>
        )}

        {/* Múltiplos Diagnósticos */}
        {patient.cancerDiagnoses && patient.cancerDiagnoses.length > 0 ? (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-gray-700">
              Diagnósticos ({patient.cancerDiagnoses.length})
            </p>
            {patient.cancerDiagnoses.map((diagnosis, index) => (
              <div
                key={diagnosis.id}
                className={`border rounded-lg p-3 ${
                  diagnosis.isPrimary
                    ? 'border-indigo-300 bg-indigo-50'
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm">
                        {getCancerTypeLabel(diagnosis.cancerType) ||
                          diagnosis.cancerType}
                      </p>
                      {diagnosis.isPrimary && (
                        <span className="text-xs px-2 py-0.5 bg-indigo-200 text-indigo-800 rounded">
                          Primário
                        </span>
                      )}
                    </div>
                    {diagnosis.icd10Code && (
                      <p className="text-xs text-gray-500 mt-1">
                        ICD-10: {diagnosis.icd10Code}
                      </p>
                    )}
                  </div>
                </div>
                {diagnosis.stage && (
                  <div className="mb-2">
                    <p className="text-xs text-gray-500">Estágio</p>
                    <p className="text-sm font-medium">{diagnosis.stage}</p>
                  </div>
                )}
                <div className="text-xs text-gray-600">
                  <p>
                    Diagnóstico:{' '}
                    {format(new Date(diagnosis.diagnosisDate), 'dd/MM/yyyy', {
                      locale: ptBR,
                    })}
                  </p>
                  {diagnosis.stagingDate && (
                    <p>
                      Estadiamento:{' '}
                      {format(new Date(diagnosis.stagingDate), 'dd/MM/yyyy', {
                        locale: ptBR,
                      })}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : patient.cancerType ? (
          /* Diagnóstico Único (compatibilidade) */
          <>
            <div>
              <p className="text-sm text-gray-500">Tipo de Câncer</p>
              <p className="font-semibold">
                {getCancerTypeLabel(patient.cancerType) || patient.cancerType}
              </p>
            </div>
            {patient.stage && (
              <div>
                <p className="text-sm text-gray-500">Estágio</p>
                <p className="font-semibold">{patient.stage}</p>
              </div>
            )}
            {patient.diagnosisDate && (
              <div>
                <p className="text-sm text-gray-500">Data do Diagnóstico</p>
                <p className="text-sm">
                  {format(
                    new Date(patient.diagnosisDate),
                    "dd 'de' MMMM 'de' yyyy",
                    {
                      locale: ptBR,
                    }
                  )}
                </p>
              </div>
            )}
          </>
        ) : patient.currentStage !== 'SCREENING' ? (
          /* Sem diagnóstico e não está em rastreio */
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-sm text-yellow-800">
              ⚠️ Diagnóstico pendente ou não informado
            </p>
          </div>
        ) : null}

        {patient.currentSpecialty && (
          <div>
            <p className="text-sm text-gray-500">Especialidade Atual</p>
            <p className="text-sm">{patient.currentSpecialty}</p>
          </div>
        )}

        {/* Informações de Tratamento (se disponível) */}
        {patient.journey && patient.journey.treatmentStartDate && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-2">
            <p className="text-sm font-semibold text-green-900">Tratamento</p>
            <div>
              <p className="text-xs text-green-700">Início do Tratamento</p>
              <p className="text-sm text-green-900">
                {format(
                  new Date(patient.journey.treatmentStartDate),
                  "dd 'de' MMMM 'de' yyyy",
                  {
                    locale: ptBR,
                  }
                )}
              </p>
            </div>
            {patient.journey.treatmentProtocol && (
              <div>
                <p className="text-xs text-green-700">Protocolo</p>
                <p className="text-sm text-green-900">
                  {patient.journey.treatmentProtocol}
                </p>
              </div>
            )}
            {patient.journey.currentCycle !== null &&
              patient.journey.totalCycles !== null && (
                <div>
                  <p className="text-xs text-green-700">Ciclo de Tratamento</p>
                  <p className="text-sm text-green-900">
                    {patient.journey.currentCycle} de{' '}
                    {patient.journey.totalCycles}
                  </p>
                </div>
              )}
          </div>
        )}
      </div>

      {/* Score de Prioridade */}
      <div className="border-t pt-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-gray-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            Priorização
          </h3>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Score de Prioridade</span>
            <span className="font-bold text-lg">
              {patient.priorityScore || 0}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Categoria</span>
            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold border ${getPriorityColor(
                patient.priorityCategory || 'MEDIUM'
              )}`}
            >
              {(patient.priorityCategory || 'MEDIUM').toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      {/* Informações Adicionais */}
      {patient.priorityReason && (
        <div className="border-t pt-4">
          <h3 className="font-semibold text-gray-700 mb-2">
            Razão da Priorização
          </h3>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">
            {patient.priorityReason}
          </p>
        </div>
      )}

      {/* Painel de Navegação Oncológica */}
      {(patient.cancerType ||
        (patient.cancerDiagnoses && patient.cancerDiagnoses.length > 0)) && (
        <div id="oncology-navigation-panel" className="border-t pt-4">
          <OncologyNavigationPanel
            patientId={patient.id}
            cancerType={
              patient.cancerDiagnoses && patient.cancerDiagnoses.length > 0
                ? patient.cancerDiagnoses[0].cancerType.toLowerCase()
                : patient.cancerType?.toLowerCase() || null
            }
            currentStage={patient.currentStage}
          />
        </div>
      )}

      <PatientEditDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        patient={patient}
      />
    </div>
  );
}
