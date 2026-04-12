import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  conversationsApi,
  type Conversation,
  type AgentDecisionLog,
  type NurseAssistResponse,
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
  nurseAssist: (id: string) =>
    [...conversationKeys.all, 'nurse-assist', id] as const,
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
    staleTime: 60_000,
  });
}

export function useConversation(id: string | null) {
  return useQuery({
    queryKey: conversationKeys.detail(id || ''),
    queryFn: () => conversationsApi.get(id!),
    enabled: !!id,
    staleTime: 60_000,
  });
}

// ─── Pending Decisions ────────────────────────────────────────────────────────

export function usePendingDecisions() {
  return useQuery({
    queryKey: conversationKeys.decisions(),
    queryFn: () => conversationsApi.getPendingDecisions(),
    staleTime: 30_000,
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

// ─── Nurse AI Assistant ──────────────────────────────────────────────────────

export function useNurseAssist(conversationId: string | null) {
  return useQuery<NurseAssistResponse>({
    queryKey: conversationKeys.nurseAssist(conversationId || ''),
    queryFn: () => conversationsApi.getNurseAssist(conversationId!),
    enabled: false,
    staleTime: 0,
    gcTime: 0,
  });
}

export function useRefreshNurseAssist() {
  const queryClient = useQueryClient();
  return (conversationId: string) =>
    queryClient.invalidateQueries({
      queryKey: conversationKeys.nurseAssist(conversationId),
    });
}
