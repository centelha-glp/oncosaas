/**
 * Utilitários de prioridade — mapeamento entre valores da API (EN) e exibição (PT)
 */

export type ApiPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type DisplayPriority = 'critico' | 'alto' | 'medio' | 'baixo';

const API_TO_DISPLAY: Record<string, DisplayPriority> = {
  CRITICAL: 'critico',
  HIGH: 'alto',
  MEDIUM: 'medio',
  LOW: 'baixo',
};

const DISPLAY_TO_API: Record<string, ApiPriority> = {
  critico: 'CRITICAL',
  alto: 'HIGH',
  medio: 'MEDIUM',
  baixo: 'LOW',
};

export function mapPriorityToDisplay(priority: string): DisplayPriority {
  const normalized = priority?.toUpperCase();
  return (
    API_TO_DISPLAY[normalized] ??
    (priority?.toLowerCase() as DisplayPriority) ??
    'baixo'
  );
}

export function mapPriorityToApi(display: string): ApiPriority {
  const normalized = display?.toLowerCase();
  return (
    DISPLAY_TO_API[normalized] ??
    (display?.toUpperCase() as ApiPriority) ??
    'LOW'
  );
}

export const PRIORITY_LABELS: Record<DisplayPriority, string> = {
  critico: 'Crítico',
  alto: 'Alto',
  medio: 'Médio',
  baixo: 'Baixo',
};

export const PRIORITY_COLORS: Record<DisplayPriority, string> = {
  critico: 'bg-red-100 text-red-800 border-red-200',
  alto: 'bg-orange-100 text-orange-800 border-orange-200',
  medio: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  baixo: 'bg-green-100 text-green-800 border-green-200',
};
