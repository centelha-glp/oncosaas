'use client';

import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth-store';
import { getWebSocketUrl } from '@/lib/utils/api-config';

export const useSocket = (namespace: string = '/') => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const errorToastShown = useRef(false);
  const { token, user } = useAuthStore();

  useEffect(() => {
    if (!token || !user) {
      return;
    }

    const wsUrl = getWebSocketUrl();
    const socketInstance = io(`${wsUrl}${namespace}`, {
      auth: {
        token,
        tenantId: user.tenantId,
      },
      transports: ['websocket', 'polling'],
    });

    socketInstance.on('connect', () => {
      setIsConnected(true);
      // If we had shown a disconnection toast, notify recovery
      if (errorToastShown.current) {
        errorToastShown.current = false;
        toast.success('Conexão em tempo real restabelecida', {
          id: 'socket-reconnected',
        });
      }
    });

    socketInstance.on('disconnect', (reason) => {
      setIsConnected(false);
      // Only show toast for unexpected disconnections (not manual close)
      if (reason !== 'io client disconnect') {
        errorToastShown.current = true;
        toast.warning('Conexão em tempo real interrompida', {
          description: 'Tentando reconectar automaticamente...',
          id: 'socket-disconnected',
        });
      }
    });

    socketInstance.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      if (!errorToastShown.current) {
        errorToastShown.current = true;
        toast.error('Falha na conexão em tempo real', {
          description: 'As atualizações automáticas podem estar indisponíveis.',
          id: 'socket-error',
        });
      }
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.close();
    };
  }, [token, user, namespace]);

  return { socket, isConnected };
};
