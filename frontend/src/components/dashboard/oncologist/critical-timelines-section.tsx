'use client';

import { usePatientsWithCriticalSteps } from '@/hooks/useDashboardMetrics';
import { useMemo } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Timer, AlertTriangle, ChevronRight, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

interface CancerTypeGroup {
  cancerType: string;
  patients: Array<{
    patientId: string;
    patientName: string;
    stepName: string;
    journeyStage: string;
    dueDate: string | null;
    daysOverdue: number | null;
    isRequired: boolean;
    priorityCategory: string | null;
  }>;
  overdueCount: number;
  avgDaysOverdue: number;
}

export function CriticalTimelinesSection() {
  const router = useRouter();
  const { data: patientsWithSteps, isLoading } = usePatientsWithCriticalSteps({
    maxResults: 50,
  });

  const groupedByCancerType = useMemo(() => {
    if (!patientsWithSteps || patientsWithSteps.length === 0) return [];

    const groups: Record<string, CancerTypeGroup> = {};

    for (const item of patientsWithSteps) {
      const key = item.cancerType || 'Não informado';
      if (!groups[key]) {
        groups[key] = {
          cancerType: key,
          patients: [],
          overdueCount: 0,
          avgDaysOverdue: 0,
        };
      }
      groups[key].patients.push({
        patientId: item.patientId,
        patientName: item.patientName,
        stepName: item.criticalStep.stepName,
        journeyStage: item.criticalStep.journeyStage,
        dueDate: item.criticalStep.dueDate,
        daysOverdue: item.criticalStep.daysOverdue,
        isRequired: item.criticalStep.isRequired,
        priorityCategory: item.priorityCategory,
      });
      if (item.criticalStep.daysOverdue && item.criticalStep.daysOverdue > 0) {
        groups[key].overdueCount++;
      }
    }

    for (const group of Object.values(groups)) {
      const overdue = group.patients.filter(
        (p) => p.daysOverdue && p.daysOverdue > 0
      );
      group.avgDaysOverdue =
        overdue.length > 0
          ? Math.round(
              overdue.reduce((sum, p) => sum + (p.daysOverdue || 0), 0) /
                overdue.length
            )
          : 0;
    }

    return Object.values(groups).sort(
      (a, b) => b.overdueCount - a.overdueCount
    );
  }, [patientsWithSteps]);

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (groupedByCancerType.length === 0) {
    return null;
  }

  const getSeverityBadge = (overdueCount: number, total: number) => {
    const ratio = overdueCount / total;
    if (ratio > 0.5)
      return 'bg-red-100 text-red-700 border-red-200';
    if (ratio > 0.25)
      return 'bg-orange-100 text-orange-700 border-orange-200';
    return 'bg-yellow-100 text-yellow-700 border-yellow-200';
  };

  return (
    <div className="bg-white rounded-lg border p-6">
      <div className="flex items-center gap-2 mb-4">
        <Timer className="h-5 w-5 text-blue-600" />
        <h2 className="text-xl font-semibold text-gray-900">
          Prazos Críticos por Tipo de Câncer
        </h2>
      </div>

      <div className="space-y-4">
        {groupedByCancerType.map((group) => (
          <div
            key={group.cancerType}
            className="border rounded-lg overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b">
              <div className="flex items-center gap-3">
                <h3 className="font-semibold text-gray-900">
                  {group.cancerType}
                </h3>
                <span className="flex items-center gap-1 text-sm text-gray-500">
                  <Users className="h-3.5 w-3.5" />
                  {group.patients.length}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {group.overdueCount > 0 && (
                  <span
                    className={cn(
                      'px-2 py-1 rounded-full text-xs font-medium border',
                      getSeverityBadge(
                        group.overdueCount,
                        group.patients.length
                      )
                    )}
                  >
                    {group.overdueCount} atrasado
                    {group.overdueCount !== 1 ? 's' : ''}
                  </span>
                )}
                {group.avgDaysOverdue > 0 && (
                  <span className="text-xs text-gray-500">
                    ~{group.avgDaysOverdue}d atraso médio
                  </span>
                )}
              </div>
            </div>

            <div className="divide-y">
              {group.patients.slice(0, 5).map((patient) => {
                const isOverdue =
                  patient.daysOverdue !== null && patient.daysOverdue > 0;
                return (
                  <div
                    key={patient.patientId}
                    className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() =>
                      router.push(`/dashboard?patient=${patient.patientId}`)
                    }
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {patient.patientName}
                        </span>
                        {isOverdue && (
                          <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-gray-500 truncate">
                        {patient.stepName}{' '}
                        <span className="capitalize">
                          ({patient.journeyStage})
                        </span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-4">
                      {patient.dueDate && (
                        <span
                          className={cn(
                            'text-xs',
                            isOverdue
                              ? 'text-red-600 font-medium'
                              : 'text-gray-500'
                          )}
                        >
                          {isOverdue
                            ? `${patient.daysOverdue}d atraso`
                            : formatDistanceToNow(new Date(patient.dueDate), {
                                addSuffix: true,
                                locale: ptBR,
                              })}
                        </span>
                      )}
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    </div>
                  </div>
                );
              })}
              {group.patients.length > 5 && (
                <div className="px-4 py-2 text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-blue-600"
                    onClick={() => router.push('/dashboard?tab=etapas')}
                  >
                    Ver todos ({group.patients.length})
                  </Button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
