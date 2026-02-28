'use client';

import { cn } from '@/lib/utils';
import { AlertTriangle, AlertCircle, Info } from 'lucide-react';

export interface DetectedSymptom {
  name: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  confidence: number;
  action?: string;
}

interface SymptomHighlightProps {
  symptoms: DetectedSymptom[];
  className?: string;
  compact?: boolean;
}

const SEVERITY_CONFIG = {
  CRITICAL: {
    label: 'Crítico',
    icon: AlertCircle,
    chip: 'bg-red-100 text-red-700 border-red-300',
    badge: 'bg-red-600 text-white',
  },
  HIGH: {
    label: 'Alto',
    icon: AlertTriangle,
    chip: 'bg-orange-100 text-orange-700 border-orange-300',
    badge: 'bg-orange-500 text-white',
  },
  MEDIUM: {
    label: 'Médio',
    icon: Info,
    chip: 'bg-yellow-100 text-yellow-700 border-yellow-300',
    badge: 'bg-yellow-500 text-white',
  },
  LOW: {
    label: 'Baixo',
    icon: Info,
    chip: 'bg-blue-100 text-blue-700 border-blue-200',
    badge: 'bg-blue-500 text-white',
  },
} as const;

const SYMPTOM_DISPLAY_NAMES: Record<string, string> = {
  febre_neutropenica: 'Febre / neutropenia',
  dispneia: 'Falta de ar',
  sangramento: 'Sangramento',
  dor_intensa: 'Dor intensa',
  vomito_incoercivel: 'Vômitos incessantes',
  obstrucao_intestinal: 'Obstrução intestinal',
  confusao_mental: 'Confusão mental',
  diarreia_severa: 'Diarreia severa',
  mucosite: 'Mucosite',
  neuropatia: 'Neuropatia',
  fadiga: 'Fadiga intensa',
  nausea: 'Náusea',
};

export function SymptomHighlight({
  symptoms,
  className,
  compact = false,
}: SymptomHighlightProps) {
  if (!symptoms || symptoms.length === 0) return null;

  const sorted = [...symptoms].sort((a, b) => {
    const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    return order[a.severity] - order[b.severity];
  });

  if (compact) {
    const topSymptom = sorted[0];
    const config = SEVERITY_CONFIG[topSymptom.severity];
    const Icon = config.icon;
    const displayName =
      SYMPTOM_DISPLAY_NAMES[topSymptom.name] || topSymptom.name;

    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
          config.chip,
          className
        )}
        title={`Sintoma detectado: ${displayName} (confiança: ${Math.round(topSymptom.confidence * 100)}%)`}
      >
        <Icon className="h-3 w-3" />
        {displayName}
        {symptoms.length > 1 && (
          <span className="ml-0.5 text-xs opacity-70">
            +{symptoms.length - 1}
          </span>
        )}
      </span>
    );
  }

  return (
    <div className={cn('space-y-1.5', className)}>
      <p className="text-xs font-medium text-gray-500">Sintomas detectados:</p>
      <div className="flex flex-wrap gap-1.5">
        {sorted.map((symptom) => {
          const config = SEVERITY_CONFIG[symptom.severity];
          const Icon = config.icon;
          const displayName =
            SYMPTOM_DISPLAY_NAMES[symptom.name] || symptom.name;

          return (
            <span
              key={symptom.name}
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium',
                config.chip
              )}
              title={`Confiança: ${Math.round(symptom.confidence * 100)}%`}
            >
              <Icon className="h-3 w-3" />
              {displayName}
              <span
                className={cn(
                  'ml-1 rounded-full px-1.5 py-px text-[10px] font-semibold',
                  config.badge
                )}
              >
                {config.label}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
