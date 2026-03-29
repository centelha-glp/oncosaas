import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formata minutos na melhor unidade legível.
 * Ex: 45 → "45 min", 150 → "2h 30min", 1500 → "1d 1h", 10080 → "7 dias"
 */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) {
    return `${Math.round(minutes)} min`;
  }
  if (minutes < 1440) {
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
  }
  const days = Math.floor(minutes / 1440);
  const remainingHours = Math.round((minutes % 1440) / 60);
  if (remainingHours > 0) {
    return `${days}d ${remainingHours}h`;
  }
  return days === 1 ? '1 dia' : `${days} dias`;
}
