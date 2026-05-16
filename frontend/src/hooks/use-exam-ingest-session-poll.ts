'use client';

import { useQuery } from '@tanstack/react-query';
import { examIngestApi } from '@/lib/api/exam-ingest';

export function useExamIngestSessionPoll(
  patientId: string | undefined,
  sessionId: string | null,
  enabled: boolean
) {
  return useQuery({
    queryKey: ['exam-ingest-session', patientId, sessionId],
    queryFn: () =>
      examIngestApi.getSessionStatus(patientId!, sessionId!),
    enabled: Boolean(patientId && sessionId && enabled),
    refetchInterval: (q) => {
      const d = q.state.data;
      if (!d || d.fileCount > 0) return false;
      return 2500;
    },
  });
}
