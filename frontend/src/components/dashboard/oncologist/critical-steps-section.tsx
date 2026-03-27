'use client';

import { usePatientsWithCriticalSteps } from '@/hooks/useDashboardMetrics';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarX, AlertTriangle, ChevronRight, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

interface CriticalStepsSectionProps {
  maxResults?: number;
}

export function CriticalStepsSection({
  maxResults = 10,
}: CriticalStepsSectionProps) {
  const router = useRouter();
  const { data: patientsWithSteps, isLoading } = usePatientsWithCriticalSteps({
    maxResults,
  });

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!patientsWithSteps || patientsWithSteps.length === 0) {
    return null; // Não renderizar se não houver pacientes com etapas críticas
  }

  const handlePatientClick = (patientId: string) => {
    router.push(`/patients/${patientId}`);
  };

  const getSeverityColor = (
    daysOverdue: number | null,
    isRequired: boolean
  ) => {
    if (!daysOverdue) return 'border-l-yellow-500 bg-yellow-50';
    if (daysOverdue > 14 && isRequired) return 'border-l-red-500 bg-red-50';
    if (daysOverdue > 7 && isRequired)
      return 'border-l-orange-500 bg-orange-50';
    return 'border-l-yellow-500 bg-yellow-50';
  };

  const getPriorityColor = (category: string | null | undefined) => {
    const cat = category || 'MEDIUM';
    switch (cat) {
      case 'CRITICAL':
        return 'text-red-600';
      case 'HIGH':
        return 'text-orange-600';
      case 'MEDIUM':
        return 'text-yellow-600';
      case 'LOW':
        return 'text-gray-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="bg-white rounded-lg border p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CalendarX className="h-5 w-5 text-red-600" />
          <h2 className="text-xl font-semibold text-gray-900">
            Pacientes com Etapas Críticas
          </h2>
          <span className="ml-2 px-2 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
            {patientsWithSteps.length}
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {patientsWithSteps.map((item) => {
          const step = item.criticalStep;
          const daysOverdue = step.daysOverdue;
          const isOverdue = daysOverdue !== null && daysOverdue > 0;

          return (
            <div
              key={item.patientId}
              className={cn(
                'border-l-4 rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow',
                getSeverityColor(daysOverdue, step.isRequired)
              )}
              onClick={() => handlePatientClick(item.patientId)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold text-gray-900 truncate">
                      {item.patientName}
                    </h3>
                    {item.priorityCategory && (
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded text-xs font-medium',
                          getPriorityColor(item.priorityCategory) ===
                            'text-red-600'
                            ? 'bg-red-100 text-red-700'
                            : getPriorityColor(item.priorityCategory) ===
                                'text-orange-600'
                              ? 'bg-orange-100 text-orange-700'
                              : 'bg-gray-100 text-gray-700'
                        )}
                      >
                        {item.priorityCategory}
                      </span>
                    )}
                    {item.navigationAlertsCount > 0 && (
                      <div className="flex items-center gap-1 text-xs text-red-600">
                        <AlertTriangle className="h-3 w-3" />
                        <span>{item.navigationAlertsCount} alerta(s)</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1 mb-2">
                    <p className="text-sm font-medium text-gray-800">
                      {step.stepName}
                    </p>
                    {step.stepDescription && (
                      <p className="text-xs text-gray-600">
                        {step.stepDescription}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="capitalize">{step.journeyStage}</span>
                      {step.dueDate && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {isOverdue ? (
                            <span className="text-red-600 font-medium">
                              {daysOverdue} {daysOverdue === 1 ? 'dia' : 'dias'}{' '}
                              de atraso
                            </span>
                          ) : (
                            <span>
                              Vence em{' '}
                              {formatDistanceToNow(new Date(step.dueDate), {
                                addSuffix: true,
                                locale: ptBR,
                              })}
                            </span>
                          )}
                        </span>
                      )}
                      {step.isRequired && (
                        <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-xs">
                          Obrigatória
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>{item.cancerType || 'Tipo não informado'}</span>
                    <span>
                      Progresso: {item.completedSteps}/{item.totalSteps} (
                      {item.completionRate}%)
                    </span>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePatientClick(item.patientId);
                  }}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
