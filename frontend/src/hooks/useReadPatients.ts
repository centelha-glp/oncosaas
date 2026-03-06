'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  getReadPatientIds,
  markPatientAsRead as markStorage,
  READ_PATIENTS_UPDATED_EVENT,
} from '@/lib/utils/read-storage';

/**
 * Hook para gerenciar conversas "lidas" (abertas) vs "assumidas".
 * Ler = abrir a conversa (apenas visualizar).
 * Assumir = clicar no botão "Assumir".
 * Usa evento customizado para sincronizar navbar e chat.
 */
export function useReadPatients() {
  const [readPatientIds, setReadPatientIds] = useState<Set<string>>(
    () => (typeof window !== 'undefined' ? getReadPatientIds() : new Set())
  );

  const markAsRead = useCallback((patientId: string) => {
    if (!patientId) return;
    markStorage(patientId);
    setReadPatientIds((prev) => {
      const next = new Set(prev);
      next.add(patientId);
      return next;
    });
  }, []);

  // Sincronizar com localStorage na montagem e quando outro componente atualizar
  useEffect(() => {
    setReadPatientIds(getReadPatientIds());

    const handler = () => setReadPatientIds(getReadPatientIds());
    window.addEventListener(READ_PATIENTS_UPDATED_EVENT, handler);
    return () => window.removeEventListener(READ_PATIENTS_UPDATED_EVENT, handler);
  }, []);

  return { readPatientIds, markAsRead };
}
