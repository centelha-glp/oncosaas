'use client';

import { cn } from '@/lib/utils';
import { ClipboardList, CheckCircle2 } from 'lucide-react';
import type { QuestionnaireProgress } from '@/lib/api/conversations';

interface QuestionnaireInlineProps {
  progress: QuestionnaireProgress;
  className?: string;
}

const QUESTIONNAIRE_LABELS: Record<string, string> = {
  ESAS: 'ESAS — Avaliação de Sintomas',
  PRO_CTCAE: 'PRO-CTCAE — Efeitos Adversos',
};

const ESAS_ITEMS_PT: Record<string, string> = {
  pain: 'Dor',
  fatigue: 'Cansaço',
  nausea: 'Náusea',
  depression: 'Humor',
  anxiety: 'Ansiedade',
  drowsiness: 'Sonolência',
  appetite: 'Apetite',
  wellbeing: 'Bem-estar geral',
  dyspnea: 'Falta de ar',
};

function getItemLabel(
  item: string | { item: string; attribute: string },
  qType: string
): string {
  if (typeof item === 'string') {
    if (qType === 'ESAS') return ESAS_ITEMS_PT[item] || item;
    return item;
  }
  const attrMap: Record<string, string> = {
    frequency: 'Frequência',
    severity: 'Intensidade',
    interference: 'Interferência',
  };
  return `${item.item} — ${attrMap[item.attribute] || item.attribute}`;
}

export function QuestionnaireInline({
  progress,
  className,
}: QuestionnaireInlineProps) {
  const { type, items, currentIndex, answers } = progress;
  const totalItems = items.length;
  const completedItems = currentIndex;
  const percentComplete = Math.round((completedItems / totalItems) * 100);
  const label = QUESTIONNAIRE_LABELS[type] || type;

  return (
    <div
      className={cn(
        'rounded-lg border border-blue-200 bg-blue-50 p-3',
        className
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        <ClipboardList className="h-4 w-4 text-blue-600" />
        <span className="text-sm font-medium text-blue-800">{label}</span>
        <span className="ml-auto text-xs text-blue-600">
          {completedItems}/{totalItems}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-blue-200">
        <div
          className="h-full rounded-full bg-blue-500 transition-all duration-300"
          style={{ width: `${percentComplete}%` }}
        />
      </div>

      {/* Item list */}
      <div className="space-y-1">
        {items
          .slice(0, Math.min(currentIndex + 3, totalItems))
          .map((item, idx) => {
            const itemKey =
              typeof item === 'string'
                ? item
                : `${item.item}_${item.attribute}`;
            const isDone = idx < currentIndex;
            const isCurrent = idx === currentIndex;
            const label = getItemLabel(item, type);
            const answerValue =
              answers[typeof item === 'string' ? item : itemKey];

            return (
              <div
                key={itemKey}
                className={cn(
                  'flex items-center gap-2 rounded px-2 py-1 text-xs',
                  isCurrent && 'bg-blue-100 font-medium text-blue-800',
                  isDone && 'text-gray-500',
                  !isCurrent && !isDone && 'text-gray-400'
                )}
              >
                {isDone ? (
                  <CheckCircle2 className="h-3 w-3 shrink-0 text-green-500" />
                ) : (
                  <span
                    className={cn(
                      'flex h-3 w-3 shrink-0 items-center justify-center rounded-full border text-[9px]',
                      isCurrent
                        ? 'border-blue-500 bg-blue-500 text-white'
                        : 'border-gray-300'
                    )}
                  >
                    {idx + 1}
                  </span>
                )}
                <span className="truncate">{label}</span>
                {isDone &&
                  answerValue !== null &&
                  answerValue !== undefined && (
                    <span className="ml-auto font-medium text-gray-600">
                      {answerValue}
                    </span>
                  )}
              </div>
            );
          })}

        {totalItems - currentIndex > 3 && (
          <p className="px-2 text-xs text-gray-400">
            +{totalItems - currentIndex - 3} itens restantes
          </p>
        )}
      </div>
    </div>
  );
}
