'use client';

import { useMemo } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import {
  getEnabledCancerTypeLabels,
  getEnabledCancerTypeKeys,
} from '@/lib/utils/patient-cancer-type';

/**
 * Hook que retorna os tipos de câncer habilitados para o tenant do usuário logado.
 * Usa tenant.settings.enabledCancerTypes; default MVP: ['bladder'].
 */
export function useEnabledCancerTypes() {
  const user = useAuthStore((s) => s.user);
  const enabledTypes = user?.tenant?.settings?.enabledCancerTypes ?? null;

  const labels = useMemo(
    () => getEnabledCancerTypeLabels(enabledTypes),
    [enabledTypes],
  );

  const keys = useMemo(
    () => getEnabledCancerTypeKeys(enabledTypes),
    [enabledTypes],
  );

  return { labels, keys, enabledTypes };
}
