'use client';

import { useEffect, useState } from 'react';
import { useSocket } from './useSocket';
import { Alert } from '@/lib/api/alerts';

export const useAlertsSocket = () => {
  const { socketRef, isConnected } = useSocket('/alerts');
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !isConnected) return;

    const handleCriticalAlert = (alert: Alert) => {
      setAlerts((prev) => [alert, ...prev]);

      // Notificação do navegador (opcional)
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Alerta Crítico', {
          body: alert.message,
          icon: '/favicon.ico',
        });
      }
    };

    socket.on('critical_alert', handleCriticalAlert);

    return () => {
      socket.off('critical_alert', handleCriticalAlert);
    };
    // socketRef is a stable ref — its identity never changes, so it does not belong
    // in the dependency array. isConnected is the correct signal to re-run this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected]);

  return { alerts, isConnected };
};
