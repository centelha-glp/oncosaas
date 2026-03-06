'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSocket } from './useSocket';
import { Alert } from '@/lib/api/alerts';

/**
 * Hook para escutar atualizações do dashboard em tempo real via WebSocket
 * Invalida queries de métricas e estatísticas quando há mudanças
 */
export const useDashboardSocket = () => {
  const { socket, isConnected } = useSocket('/alerts');
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!socket || !isConnected) return;

    // Escutar novos alertas críticos
    const handleCriticalAlert = (alert: Alert) => {
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'metrics'] });
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['alerts', 'open', 'count'] });
      queryClient.invalidateQueries({ queryKey: ['patients'] });

      // Notificação do navegador (opcional)
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Alerta Crítico', {
          body: `${alert.patient?.name || 'Paciente'}: ${alert.message}`,
          icon: '/favicon.ico',
          tag: alert.id, // Evitar notificações duplicadas
        });
      }
    };

    // Escutar atualizações de alertas
    const handleAlertUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'metrics'] });
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['alerts', 'open', 'count'] });
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    };

    // Escutar novos alertas
    const handleNewAlert = () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'metrics'] });
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['alerts', 'open', 'count'] });
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    };

    // Escutar contagem de alertas abertos
    const handleOpenAlertsCount = () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'metrics'] });
      queryClient.invalidateQueries({ queryKey: ['alerts', 'open', 'count'] });
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    };

    // Registrar listeners
    socket.on('critical_alert', handleCriticalAlert);
    socket.on('alert_updated', handleAlertUpdate);
    socket.on('new_alert', handleNewAlert);
    socket.on('open_alerts_count', handleOpenAlertsCount);

    // Cleanup: remover listeners
    return () => {
      socket.off('critical_alert', handleCriticalAlert);
      socket.off('alert_updated', handleAlertUpdate);
      socket.off('new_alert', handleNewAlert);
      socket.off('open_alerts_count', handleOpenAlertsCount);
    };
  }, [socket, isConnected, queryClient]);

  return {
    isConnected,
  };
};
