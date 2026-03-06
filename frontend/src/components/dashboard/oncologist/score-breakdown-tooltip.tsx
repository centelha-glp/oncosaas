'use client';

import { Patient } from '@/lib/api/patients';
import { Info } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface ScoreBreakdownTooltipProps {
  patient: Patient;
}

export function ScoreBreakdownTooltip({ patient }: ScoreBreakdownTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Por enquanto, usar dados disponíveis para criar breakdown estimado
  // TODO: Quando backend retornar breakdown detalhado, usar esses dados
  const breakdown = {
    baseScore: 0,
    factors: [] as Array<{ label: string; value: number; description: string }>,
  };

  // Estimar fatores baseados em dados disponíveis
  if (patient.priorityScore) {
    const score = patient.priorityScore;

    // Fator: Estágio do câncer (mais avançado = maior score)
    if (patient.stage) {
      const stageScores: Record<string, number> = {
        I: 10,
        II: 20,
        III: 35,
        IV: 50,
      };
      const stageScore = stageScores[patient.stage] || 0;
      if (stageScore > 0) {
        breakdown.factors.push({
          label: 'Estágio do Câncer',
          value: stageScore,
          description: `Estágio ${patient.stage}`,
        });
      }
    }

    // Fator: Alertas pendentes
    const alertsCount = patient.pendingAlertsCount ?? patient._count?.alerts ?? 0;
    if (alertsCount > 0) {
      const alertsScore = Math.min(alertsCount * 5, 30);
      breakdown.factors.push({
        label: 'Alertas Pendentes',
        value: alertsScore,
        description: `${alertsCount} alerta(s) ativo(s)`,
      });
    }

    // Fator: Tempo sem resposta (se disponível)
    if (patient.lastInteraction) {
      const daysSinceInteraction = Math.floor(
        (new Date().getTime() - new Date(patient.lastInteraction).getTime()) /
          (1000 * 60 * 60 * 24)
      );
      if (daysSinceInteraction > 3) {
        const noResponseScore = Math.min((daysSinceInteraction - 3) * 2, 20);
        breakdown.factors.push({
          label: 'Tempo sem Resposta',
          value: noResponseScore,
          description: `${daysSinceInteraction} dias sem interação`,
        });
      }
    }

    // Fator: Prioridade base (restante)
    const totalFactorScore = breakdown.factors.reduce(
      (sum, f) => sum + f.value,
      0
    );
    const baseScore = Math.max(0, score - totalFactorScore);
    if (baseScore > 0) {
      breakdown.baseScore = baseScore;
    }
  }

  const totalScore =
    breakdown.baseScore +
    breakdown.factors.reduce((sum, f) => sum + f.value, 0);

  return (
    <div className="relative inline-block">
      <button
        className="inline-flex items-center"
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        onClick={() => setIsOpen(!isOpen)}
      >
        <Info className="h-4 w-4 text-gray-400 hover:text-gray-600 transition-colors" />
      </button>

      {isOpen && (
        <div
          className={cn(
            'absolute z-50 w-80 p-4 bg-white border border-gray-200 rounded-lg shadow-xl',
            'bottom-full left-1/2 transform -translate-x-1/2 mb-2'
          )}
          onMouseEnter={() => setIsOpen(true)}
          onMouseLeave={() => setIsOpen(false)}
        >
          <div className="space-y-3">
            <div>
              <h4 className="font-semibold text-sm text-gray-900 mb-2">
                Breakdown do Score de Prioridade
              </h4>
              <p className="text-xs text-gray-600 mb-3">
                Score total:{' '}
                <span className="font-bold">{patient.priorityScore}/100</span>
              </p>
            </div>

            {breakdown.factors.length > 0 ? (
              <div className="space-y-2">
                {breakdown.factors.map((factor, index) => (
                  <div
                    key={index}
                    className="flex items-start justify-between gap-2"
                  >
                    <div className="flex-1">
                      <p className="text-xs font-medium text-gray-700">
                        {factor.label}
                      </p>
                      <p className="text-xs text-gray-500">
                        {factor.description}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-blue-600">
                      +{factor.value}
                    </span>
                  </div>
                ))}
                {breakdown.baseScore > 0 && (
                  <div className="flex items-start justify-between gap-2 pt-2 border-t">
                    <div className="flex-1">
                      <p className="text-xs font-medium text-gray-700">
                        Score Base
                      </p>
                      <p className="text-xs text-gray-500">
                        Fatores adicionais (sintomas, comorbidades, etc.)
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-gray-600">
                      +{breakdown.baseScore}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs text-gray-500">
                <p>Breakdown detalhado não disponível.</p>
                <p className="mt-1">
                  {patient.priorityReason && (
                    <span>Razão: {patient.priorityReason}</span>
                  )}
                </p>
              </div>
            )}

            {patient.priorityReason && breakdown.factors.length > 0 && (
              <div className="pt-2 border-t">
                <p className="text-xs text-gray-500">
                  <span className="font-medium">Razão adicional:</span>{' '}
                  {patient.priorityReason}
                </p>
              </div>
            )}
          </div>

          {/* Seta do tooltip */}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-px">
            <div className="w-3 h-3 bg-white border-r border-b border-gray-200 transform rotate-45"></div>
          </div>
        </div>
      )}
    </div>
  );
}
