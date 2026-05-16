import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiClientError } from '@/lib/api/client';
import {
  clinicalNotesApi,
  type ClinicalNoteMutationResponse,
  type ClinicalNoteType,
} from '@/lib/api/clinical-notes';

/** Retries só para falha de rede (status 0) ou 5xx — evita tempestade em 404/429. */
function shouldRetryClinicalNoteQuery(
  failureCount: number,
  error: unknown
): boolean {
  if (error instanceof ApiClientError) {
    if (
      error.statusCode === 404 ||
      error.statusCode === 429 ||
      (error.statusCode >= 400 && error.statusCode < 500)
    ) {
      return false;
    }
    if (error.statusCode === 0) return failureCount < 2;
    if (error.statusCode >= 500) return failureCount < 2;
  }
  return failureCount < 1;
}

function shouldRetryClinicalNoteMutation(
  failureCount: number,
  error: unknown
): boolean {
  if (error instanceof ApiClientError) {
    if (
      error.statusCode === 404 ||
      error.statusCode === 429 ||
      (error.statusCode >= 400 && error.statusCode < 500)
    ) {
      return false;
    }
    if (error.statusCode === 0) return failureCount < 2;
    if (error.statusCode >= 500) return failureCount < 2;
  }
  return false;
}

export function useClinicalNotesList(patientId: string | undefined) {
  return useQuery({
    queryKey: ['clinical-notes', patientId],
    queryFn: () => clinicalNotesApi.list(patientId!, { page: 1, limit: 50 }),
    enabled: !!patientId,
    staleTime: 30_000,
    retry: shouldRetryClinicalNoteQuery,
  });
}

/** Evoluções do prontuário vinculadas a uma etapa de navegação (consulta especializada / navegação). */
export function useClinicalNotesForNavigationStep(
  patientId: string | undefined,
  navigationStepId: string | undefined,
  enabled: boolean
) {
  return useQuery({
    queryKey: ['clinical-notes', patientId, 'navigation-step', navigationStepId],
    queryFn: () =>
      clinicalNotesApi.list(patientId!, {
        page: 1,
        limit: 50,
        navigationStepId,
      }),
    enabled: Boolean(patientId && navigationStepId && enabled),
    staleTime: 15_000,
    retry: shouldRetryClinicalNoteQuery,
  });
}

export function useClinicalNoteDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['clinical-notes', 'detail', id],
    queryFn: () => clinicalNotesApi.getById(id!),
    enabled: !!id,
    staleTime: 15_000,
    retry: shouldRetryClinicalNoteQuery,
  });
}

export function useClinicalNoteMutations(patientId: string) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['clinical-notes', patientId] });
  };

  const create = useMutation({
    mutationFn: (payload: {
      noteType: ClinicalNoteType;
      navigationStepId: string;
      contentMarkdown: string;
    }) =>
      clinicalNotesApi.create(patientId, {
        noteType: payload.noteType,
        navigationStepId: payload.navigationStepId,
        contentMarkdown: payload.contentMarkdown,
      }),
    onSuccess: () => {
      invalidate();
    },
  });

  const update = useMutation({
    mutationFn: (args: {
      id: string;
      contentMarkdown: string;
      changeReason?: string;
      navigationStepId?: string;
      /** Quando true, evita invalidar/refetch (ex.: autosave) */
      silent?: boolean;
    }) =>
      clinicalNotesApi.update(args.id, {
        contentMarkdown: args.contentMarkdown,
        changeReason: args.changeReason,
        navigationStepId: args.navigationStepId,
      }),
    retry: shouldRetryClinicalNoteMutation,
    onError: (err, v) => {
      if (!(err instanceof ApiClientError) || err.statusCode !== 404) return;
      queryClient.removeQueries({ queryKey: ['clinical-notes', 'detail', v.id] });
      queryClient.invalidateQueries({ queryKey: ['clinical-notes', patientId] });
    },
    onSuccess: (res, v) => {
      // Atualiza cache do detalhe imediatamente para não depender de refetch.
      queryClient.setQueryData(
        ['clinical-notes', 'detail', v.id],
        (old: unknown) => {
          if (!old || typeof old !== 'object') return old;
          const prev = old as Record<string, unknown>;
          return {
            ...prev,
            contentMarkdown: v.contentMarkdown,
            latestVersionNumber:
              (res as ClinicalNoteMutationResponse | undefined)
                ?.latestVersionNumber ?? prev.latestVersionNumber,
            sectionsContentHash:
              (res as ClinicalNoteMutationResponse | undefined)
                ?.sectionsContentHash ?? prev.sectionsContentHash,
            updatedAt:
              (res as ClinicalNoteMutationResponse | undefined)?.updatedAt ??
              prev.updatedAt,
          };
        }
      );

      // Em autosave, evitar invalidate/refetch para não gerar layout shift/scroll jump.
      if (v.silent) return;

      invalidate();
    },
  });

  const sign = useMutation({
    mutationFn: (id: string) => clinicalNotesApi.sign(id),
    onSuccess: (_, id) => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['clinical-notes', 'detail', id] });
      queryClient.invalidateQueries({
        queryKey: ['clinical-notes', 'detail', id, 'extraction-status'],
      });
    },
  });

  const addendum = useMutation({
    mutationFn: (args: {
      parentId: string;
      contentMarkdown?: string;
    }) =>
      clinicalNotesApi.addendum(args.parentId, {
        contentMarkdown: args.contentMarkdown,
      }),
    onSuccess: () => invalidate(),
  });

  const voidNote = useMutation({
    mutationFn: (args: { id: string; voidReason: string }) =>
      clinicalNotesApi.void(args.id, args.voidReason),
    onSuccess: (_, v) => {
      invalidate();
      queryClient.invalidateQueries({
        queryKey: ['clinical-notes', 'detail', v.id],
      });
    },
  });

  return { create, update, sign, addendum, voidNote };
}

export function useClinicalNoteExtractionStatus(
  noteId: string | undefined,
  enabled: boolean
) {
  return useQuery({
    queryKey: ['clinical-notes', 'detail', noteId, 'extraction-status'],
    queryFn: () => clinicalNotesApi.getExtractionStatus(noteId!),
    enabled: Boolean(noteId && enabled),
    staleTime: 5000,
    retry: shouldRetryClinicalNoteQuery,
    refetchInterval: (q) => {
      const st = q.state.data?.status;
      if (st === 'PENDING') return 4000;
      return false;
    },
  });
}

export function useUndoClinicalNoteExtraction(patientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (noteId: string) => clinicalNotesApi.undoExtraction(noteId),
    onSuccess: (_, noteId) => {
      queryClient.invalidateQueries({ queryKey: ['clinical-notes', patientId] });
      queryClient.invalidateQueries({
        queryKey: ['clinical-notes', 'detail', noteId],
      });
      queryClient.invalidateQueries({
        queryKey: ['clinical-notes', 'detail', noteId, 'extraction-status'],
      });
    },
  });
}
