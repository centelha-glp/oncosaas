'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSocket } from './useSocket';
import { Message } from '@/lib/api/messages';

/**
 * Hook para escutar atualizacoes de mensagens em tempo real via WebSocket
 *
 * @param patientId - ID do paciente para escutar mensagens especificas
 */
export const useMessagesSocket = (patientId?: string) => {
  const { socketRef, isConnected } = useSocket('/messages');
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !isConnected || !patientId) return;

    // Inscrever-se para receber mensagens do paciente especifico
    socket.emit('subscribe_patient_messages', { patientId });

    // Escutar novos eventos de mensagem
    const handleNewMessage = (message: Message) => {
      // So processar se a mensagem e do paciente correto
      if (message.patientId !== patientId) return;

      // Atualizar cache do React Query
      queryClient.setQueryData<Message[]>(['messages', patientId], (old) => {
        if (!old) return [message];

        // Evitar duplicatas (verificar se mensagem ja existe)
        if (
          old.some(
            (m) =>
              m.id === message.id ||
              m.whatsappMessageId === message.whatsappMessageId
          )
        ) {
          return old;
        }

        // Adicionar nova mensagem e ordenar por timestamp
        return [...old, message].sort(
          (a, b) =>
            new Date(a.whatsappTimestamp || a.createdAt).getTime() -
            new Date(b.whatsappTimestamp || b.createdAt).getTime()
        );
      });

      // Invalidar contador e lista de pacientes com mensagens não assumidas
      queryClient.invalidateQueries({
        queryKey: ['messages', 'unassumed', 'count'],
      });
      queryClient.invalidateQueries({
        queryKey: ['messages', 'unassumed', 'patientIds'],
      });
    };

    // Escutar quando mensagem e atualizada (assumida, enviada, etc.)
    const handleMessageUpdate = (message: Message) => {
      // So processar se a mensagem e do paciente correto
      if (message.patientId !== patientId) return;

      // Atualizar mensagem especifica no cache
      queryClient.setQueryData<Message[]>(['messages', patientId], (old) => {
        if (!old) return [message];

        const existingIndex = old.findIndex(
          (msg) =>
            msg.id === message.id ||
            msg.whatsappMessageId === message.whatsappMessageId
        );

        if (existingIndex === -1) {
          return [...old, message].sort(
            (a, b) =>
              new Date(a.whatsappTimestamp || a.createdAt).getTime() -
              new Date(b.whatsappTimestamp || b.createdAt).getTime()
          );
        }

        return old.map((msg, index) =>
          index === existingIndex ? message : msg
        );
      });

      // Invalidar contador e lista de pacientes
      queryClient.invalidateQueries({
        queryKey: ['messages', 'unassumed', 'count'],
      });
      queryClient.invalidateQueries({
        queryKey: ['messages', 'unassumed', 'patientIds'],
      });
    };

    // Escutar quando mensagem e enviada (confirmacao)
    const handleMessageSent = (message: Message) => {
      // So processar se a mensagem e do paciente correto
      if (message.patientId !== patientId) return;

      // Atualizar placeholder temporario ou inserir nova mensagem no historico
      queryClient.setQueryData<Message[]>(['messages', patientId], (old) => {
        if (!old) return [message];

        const existingIndex = old.findIndex(
          (msg) =>
            msg.id === message.id ||
            msg.whatsappMessageId === message.whatsappMessageId
        );
        if (existingIndex !== -1) {
          return old.map((msg, index) =>
            index === existingIndex ? message : msg
          );
        }

        const tempIndex = old.findIndex(
          (msg) =>
            msg.id.startsWith('temp-') &&
            msg.direction === 'OUTBOUND' &&
            msg.content === message.content
        );
        if (tempIndex !== -1) {
          return old.map((msg, index) => (index === tempIndex ? message : msg));
        }

        return [...old, message].sort(
          (a, b) =>
            new Date(a.whatsappTimestamp || a.createdAt).getTime() -
            new Date(b.whatsappTimestamp || b.createdAt).getTime()
        );
      });

      // Nao invalidar contador: mensagens OUTBOUND nao afetam o badge
      // (o badge conta conversas com mensagens INBOUND nao assumidas)
    };

    // Registrar listeners
    socket.on('new_message', handleNewMessage);
    socket.on('message_updated', handleMessageUpdate);
    socket.on('message_sent', handleMessageSent);

    // Cleanup: remover listeners e cancelar inscricao
    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('message_updated', handleMessageUpdate);
      socket.off('message_sent', handleMessageSent);
      socket.emit('unsubscribe_patient_messages', { patientId });
    };
    // socketRef is a stable ref — its identity never changes, so it does not belong
    // in the dependency array. isConnected is the correct signal to re-run this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, patientId, queryClient]);

  return {
    isConnected,
  };
};
