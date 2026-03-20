import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { messagesApi, Message, SendMessageDto } from '@/lib/api/messages';

// Default page size for message history; keeps initial load fast.
const MESSAGES_PAGE_SIZE = 100;

export const useMessages = (patientId?: string) => {
  return useQuery({
    queryKey: ['messages', patientId],
    queryFn: () => messagesApi.getAll(patientId, MESSAGES_PAGE_SIZE),
    enabled: !!patientId, // Só fazer requisição se houver patientId
    staleTime: 1 * 60 * 1000, // 1 minuto
  });
};

export const useMessage = (id: string) => {
  return useQuery({
    queryKey: ['messages', 'detail', id],
    queryFn: () => messagesApi.getById(id),
    enabled: !!id,
  });
};

export const useUnassumedMessagesCount = () => {
  return useQuery({
    queryKey: ['messages', 'unassumed', 'count'],
    queryFn: () => messagesApi.getUnassumedCount(),
    staleTime: 30 * 1000, // 30 segundos
    refetchInterval: 30 * 1000, // Atualizar a cada 30 segundos
  });
};

export const useUnassumedPatientIds = () => {
  return useQuery({
    queryKey: ['messages', 'unassumed', 'patientIds'],
    queryFn: () => messagesApi.getUnassumedPatientIds(),
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
  });
};

export const useAssumePatientConversation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (patientId: string) =>
      messagesApi.assumePatientConversation(patientId),
    onSuccess: (_data, patientId) => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      queryClient.invalidateQueries({
        queryKey: ['messages', patientId],
      });
      queryClient.invalidateQueries({
        queryKey: ['messages', 'unassumed', 'count'],
      });
      queryClient.invalidateQueries({
        queryKey: ['messages', 'unassumed', 'patientIds'],
      });
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      queryClient.invalidateQueries({ queryKey: ['interventions'] });
    },
  });
};

export const useAssumeMessage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => messagesApi.assume(id),
    onSuccess: (data, messageId) => {
      // Invalidar queries relacionadas
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      queryClient.invalidateQueries({
        queryKey: ['messages', 'unassumed', 'count'],
      });
      queryClient.invalidateQueries({
        queryKey: ['messages', 'unassumed', 'patientIds'],
      });
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      queryClient.invalidateQueries({ queryKey: ['interventions'] }); // Invalidar intervenções também

      // Atualizar mensagem específica no cache
      queryClient.setQueryData(
        ['messages', data.patientId],
        (old: Message[] | undefined) => {
          if (!old) return [data];
          return old.map((msg) => (msg.id === messageId ? data : msg));
        }
      );
    },
  });
};

export const useSendMessage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SendMessageDto) => messagesApi.send(data),
    onMutate: async (variables) => {
      // Cancelar queries em andamento
      await queryClient.cancelQueries({
        queryKey: ['messages', variables.patientId],
      });

      // Snapshot do estado anterior
      const previousMessages = queryClient.getQueryData<Message[]>([
        'messages',
        variables.patientId,
      ]);

      // Optimistic update - adicionar mensagem temporária
      const optimisticMessage: Message = {
        id: `temp-${Date.now()}`,
        tenantId: '',
        patientId: variables.patientId,
        conversationId: variables.conversationId || null,
        whatsappMessageId: `temp-${Date.now()}`,
        whatsappTimestamp: new Date().toISOString(),
        type: 'TEXT',
        direction: 'OUTBOUND',
        content: variables.content,
        audioUrl: null,
        audioDuration: null,
        transcribedText: null,
        processedBy: 'NURSING',
        structuredData: null,
        criticalSymptomsDetected: [],
        alertTriggered: false,
        assumedBy: null,
        assumedAt: null,
        createdAt: new Date().toISOString(),
      };

      queryClient.setQueryData<Message[]>(
        ['messages', variables.patientId],
        (old) => {
          if (!old) return [optimisticMessage];
          return [...old, optimisticMessage].sort(
            (a, b) =>
              new Date(a.whatsappTimestamp).getTime() -
              new Date(b.whatsappTimestamp).getTime()
          );
        }
      );

      return { previousMessages };
    },
    onError: (err, variables, context) => {
      // Reverter em caso de erro
      if (context?.previousMessages) {
        queryClient.setQueryData(
          ['messages', variables.patientId],
          context.previousMessages
        );
      }
    },
    onSuccess: (data, variables) => {
      // Invalidar para buscar dados atualizados do servidor
      queryClient.invalidateQueries({
        queryKey: ['messages', variables.patientId],
      });
      queryClient.invalidateQueries({
        queryKey: ['messages', 'unassumed', 'count'],
      });
      queryClient.invalidateQueries({ queryKey: ['interventions'] }); // Invalidar intervenções também
    },
  });
};
