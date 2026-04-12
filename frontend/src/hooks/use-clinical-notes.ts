import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  clinicalNotesApi,
  type ClinicalNoteType,
} from '@/lib/api/clinical-notes';

export function useClinicalNotesList(patientId: string | undefined) {
  return useQuery({
    queryKey: ['clinical-notes', patientId],
    queryFn: () => clinicalNotesApi.list(patientId!, { page: 1, limit: 50 }),
    enabled: !!patientId,
    staleTime: 30_000,
  });
}

export function useClinicalNoteDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['clinical-notes', 'detail', id],
    queryFn: () => clinicalNotesApi.getById(id!),
    enabled: !!id,
    staleTime: 15_000,
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
      sections: Record<string, string>;
    }) =>
      clinicalNotesApi.create(patientId, {
        noteType: payload.noteType,
        navigationStepId: payload.navigationStepId,
        sections: payload.sections,
      }),
    onSuccess: () => {
      invalidate();
    },
  });

  const update = useMutation({
    mutationFn: (args: {
      id: string;
      sections: Record<string, string>;
      changeReason?: string;
      navigationStepId?: string;
    }) =>
      clinicalNotesApi.update(args.id, {
        sections: args.sections,
        changeReason: args.changeReason,
        navigationStepId: args.navigationStepId,
      }),
    onSuccess: (_, v) => {
      invalidate();
      queryClient.invalidateQueries({
        queryKey: ['clinical-notes', 'detail', v.id],
      });
    },
  });

  const sign = useMutation({
    mutationFn: (id: string) => clinicalNotesApi.sign(id),
    onSuccess: (_, id) => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['clinical-notes', 'detail', id] });
    },
  });

  const addendum = useMutation({
    mutationFn: (args: {
      parentId: string;
      sections: Record<string, string>;
    }) =>
      clinicalNotesApi.addendum(args.parentId, { sections: args.sections }),
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
