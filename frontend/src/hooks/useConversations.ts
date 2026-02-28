import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  conversationsApi,
  type Conversation,
  type AgentDecisionLog,
} from '@/lib/api/conversations';

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const conversationKeys = {
  all: ['conversations'] as const,
  lists: () => [...conversationKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) =>
    [...conversationKeys.lists(), filters] as const,
  details: () => [...conversationKeys.all, 'detail'] as const,
  detail: (id: string) => [...conversationKeys.details(), id] as const,
  decisions: () => [...conversationKeys.all, 'decisions'] as const,
};

// ─── Conversations List ────────────────────────────────────────────────────────

export function useConversations(params?: {
  patientId?: string;
  status?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: conversationKeys.list(params || {}),
    queryFn: () => conversationsApi.list(params),
  });
}

export function useConversation(id: string | null) {
  return useQuery({
    queryKey: conversationKeys.detail(id || ''),
    queryFn: () => conversationsApi.get(id!),
    enabled: !!id,
  });
}

// ─── Pending Decisions ────────────────────────────────────────────────────────

export function usePendingDecisions() {
  return useQuery({
    queryKey: conversationKeys.decisions(),
    queryFn: () => conversationsApi.getPendingDecisions(),
    refetchInterval: 30_000, // Poll every 30s
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useEscalateConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => conversationsApi.escalate(id),
    onSuccess: (updated: Conversation) => {
      queryClient.setQueryData(conversationKeys.detail(updated.id), updated);
      queryClient.invalidateQueries({ queryKey: conversationKeys.lists() });
    },
  });
}

export function useCloseConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => conversationsApi.close(id),
    onSuccess: (updated: Conversation) => {
      queryClient.setQueryData(conversationKeys.detail(updated.id), updated);
      queryClient.invalidateQueries({ queryKey: conversationKeys.lists() });
    },
  });
}

export function useApproveDecision() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => conversationsApi.approveDecision(id),
    onSuccess: (_: AgentDecisionLog) => {
      queryClient.invalidateQueries({ queryKey: conversationKeys.decisions() });
    },
  });
}

export function useRejectDecision() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      conversationsApi.rejectDecision(id, reason),
    onSuccess: (_: AgentDecisionLog) => {
      queryClient.invalidateQueries({ queryKey: conversationKeys.decisions() });
    },
  });
}
