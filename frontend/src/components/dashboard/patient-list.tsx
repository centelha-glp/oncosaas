'use client';

import { useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import { getCancerTypeLabel } from '@/lib/utils/patient-cancer-type';

interface Patient {
  id: string;
  name: string;
  cancerType: string;
  stage: string;
  priorityScore: number;
  priorityCategory: 'critico' | 'alto' | 'medio' | 'baixo';
  lastInteraction?: string;
  alertCount: number;
}

interface PatientListProps {
  patients: Patient[];
  onPatientClick: (patientId: string) => void;
  onTakeOver?: (patientId: string) => void;
  selectedPatientId?: string | null;
  hideActionButtons?: boolean;
}

export function PatientList({
  patients,
  onPatientClick,
  selectedPatientId,
}: PatientListProps) {
  // Refs para cada card de paciente (para scroll automático)
  const patientRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Scroll automático quando paciente é selecionado externamente
  useEffect(() => {
    if (selectedPatientId && patientRefs.current[selectedPatientId]) {
      // Pequeno delay para garantir que o DOM foi atualizado
      const timeoutId = setTimeout(() => {
        patientRefs.current[selectedPatientId]?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest', // Não força scroll completo, apenas o necessário
        });
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [selectedPatientId]);

  const getPriorityColor = (category: string) => {
    switch (category) {
      case 'critico':
        return 'border-l-4 border-l-red-500 bg-red-50';
      case 'alto':
        return 'border-l-4 border-l-orange-500 bg-orange-50';
      case 'medio':
        return 'border-l-4 border-l-yellow-400 bg-yellow-50';
      default:
        return 'border-l-4 border-l-green-500 bg-green-50';
    }
  };

  const getPriorityDot = (category: string) => {
    switch (category) {
      case 'critico':
        return 'bg-red-500';
      case 'alto':
        return 'bg-orange-500';
      case 'medio':
        return 'bg-yellow-400';
      default:
        return 'bg-green-500';
    }
  };

  return (
    <div className="space-y-3">
      {patients.map((patient) => (
        <div
          key={patient.id}
          ref={(el) => {
            patientRefs.current[patient.id] = el;
          }}
          className={`px-3 py-2.5 rounded-lg border ${getPriorityColor(patient.priorityCategory)} cursor-pointer hover:shadow-md transition-all relative overflow-hidden ${
            selectedPatientId === patient.id
              ? 'ring-2 ring-indigo-500 ring-offset-1 shadow-md'
              : ''
          }`}
          onClick={() => onPatientClick(patient.id)}
        >
          <div className="flex items-center gap-2.5">
            {/* Indicador de prioridade */}
            <span
              className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${getPriorityDot(patient.priorityCategory)}`}
            />

            {/* Conteúdo principal */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="font-semibold text-sm truncate">
                  {patient.name}
                </h3>
                {patient.alertCount > 0 && (
                  <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-semibold border border-red-300 flex-shrink-0">
                    <AlertTriangle className="h-2.5 w-2.5" />
                    {patient.alertCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-muted-foreground truncate">
                  {patient.cancerType
                    ? getCancerTypeLabel(patient.cancerType)
                    : ''}
                  {patient.stage ? ` · ${patient.stage}` : ''}
                </span>
                {patient.lastInteraction && (
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    {patient.lastInteraction}
                  </span>
                )}
              </div>
            </div>

            {/* Score badge */}
            <span className="text-xs font-semibold text-gray-500 flex-shrink-0">
              {patient.priorityScore}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
