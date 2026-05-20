'use client';

import React, { useCallback, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { PatientDetail } from '@/lib/api/patients';
import {
  CLINICAL_EVOLUTION_NAVIGATION_STEP_KEY,
  clinicalNotePrimaryPersonName,
  clinicalNoteTypeLabel,
  clinicalNotesApi,
  loadContentMarkdownFromPreviousEvolution,
  mergeMarkdownWithCadastroSuggestion,
  type ClinicalNoteType,
  type ClinicalExtractionProposalSummary,
} from '@/lib/api/clinical-notes';
import type { NavigationStep } from '@/lib/api/oncology-navigation';
import { usePatientNavigationSteps } from '@/hooks/useOncologyNavigation';
import {
  clinicalNoteTypeForNavigationStepKey,
  filterNavigationStepsByEvolutionBaseKey,
  sortNavigationStepsForEvolutionPick,
} from '@/lib/utils/clinical-evolution-navigation';
import { JOURNEY_STAGE_LABELS, type JourneyStage } from '@/lib/utils/journey-stage';
import {
  useClinicalNoteDetail,
  useClinicalNotesList,
  useClinicalNoteMutations,
  useClinicalNoteExtractionStatus,
  useUndoClinicalNoteExtraction,
  useRetryClinicalNoteExtraction,
  useApproveClinicalNoteExtraction,
  useRejectClinicalNoteExtraction,
} from '@/hooks/use-clinical-notes';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { AutoResizeTextarea } from '@/components/ui/auto-resize-textarea';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { ApiClientError } from '@/lib/api/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuthStore } from '@/stores/auth-store';
import { ClinicalNoteOrdersPanel } from '@/components/patients/clinical-note-orders-panel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  canCreateClinicalNoteType,
  canEditDraftClinicalNote,
  canVoidClinicalNote,
} from '@/lib/utils/clinical-note-permissions';
import { useDebounce } from '@/lib/utils/use-debounce';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { QueryErrorRetry } from '@/components/shared/query-error-retry';
import { ClinicalNoteMarkdownBody } from '@/components/patients/clinical-note-markdown-body';
import { PatientExamIngestAssist } from '@/components/patients/patient-exam-ingest-assist';
import { PatientProntuarioLabHistory } from '@/components/patients/patient-prontuario-lab-history';

/** Tempo sem digitar antes de enviar PATCH (salvamento automático do rascunho) */
const CLINICAL_NOTE_AUTOSAVE_MS = 2000;

interface PatientProntuarioTabProps {
  patient: PatientDetail;
}

function journeyStageLabel(stage: string): string {
  const s = stage as JourneyStage;
  return JOURNEY_STAGE_LABELS[s] ?? stage;
}

function extractionStatusLabel(
  status: string | undefined
): string {
  switch (status) {
    case 'PENDING':
      return 'Em processamento';
    case 'AWAITING_REVIEW':
      return 'Aguardando sua aprovação';
    case 'APPLIED':
      return 'Aplicada';
    case 'FAILED':
      return 'Falhou';
    case 'REJECTED':
      return 'Rejeitada';
    case 'ROLLED_BACK':
      return 'Desfeita';
    case 'NONE':
      return '—';
    default:
      return status ?? '—';
  }
}

function proposalSummaryLines(
  summary: ClinicalExtractionProposalSummary
): string[] {
  const lines: string[] = [];
  if (summary.medications > 0) {
    lines.push(
      `${summary.medications} medicamento${summary.medications === 1 ? '' : 's'}`
    );
  }
  if (summary.clinicalExamRequests > 0) {
    lines.push(
      `${summary.clinicalExamRequests} pedido${summary.clinicalExamRequests === 1 ? '' : 's'} de exame`
    );
  }
  if (summary.comorbidities > 0) {
    lines.push(
      `${summary.comorbidities} comorbidade${summary.comorbidities === 1 ? '' : 's'}`
    );
  }
  if (summary.patientPatchFieldCount > 0) {
    lines.push(
      `${summary.patientPatchFieldCount} campo${summary.patientPatchFieldCount === 1 ? '' : 's'} no cadastro`
    );
  }
  if (summary.journeyPatchFieldCount > 0) {
    lines.push(
      `${summary.journeyPatchFieldCount} campo${summary.journeyPatchFieldCount === 1 ? '' : 's'} na jornada`
    );
  }
  if (summary.complementaryExams > 0) {
    lines.push(
      `${summary.complementaryExams} exame${summary.complementaryExams === 1 ? '' : 's'} complementar${summary.complementaryExams === 1 ? '' : 'es'}`
    );
  }
  if (summary.diagnoses > 0) {
    lines.push(
      `${summary.diagnoses} diagnóstico${summary.diagnoses === 1 ? '' : 's'}`
    );
  }
  if (summary.treatments > 0) {
    lines.push(
      `${summary.treatments} tratamento${summary.treatments === 1 ? '' : 's'}`
    );
  }
  if (summary.clinicalPrescriptionLines > 0) {
    lines.push(
      `${summary.clinicalPrescriptionLines} linha${summary.clinicalPrescriptionLines === 1 ? '' : 's'} de prescrição`
    );
  }
  if (lines.length === 0) {
    lines.push('Proposta sem itens estruturados detectados');
  }
  return lines;
}

export function PatientProntuarioTab({
  patient,
}: PatientProntuarioTabProps): React.ReactElement {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const deepLinkNavigationStepId = searchParams.get('navigationStepId');
  const deepLinkHandledRef = useRef<string | null>(null);
  const {
    data: list,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useClinicalNotesList(patient.id);
  const {
    data: navigationSteps = [],
    isLoading: loadingNavigationSteps,
  } = usePatientNavigationSteps(patient.id);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const {
    data: detail,
    isLoading: loadingDetail,
    error: detailQueryError,
  } = useClinicalNoteDetail(selectedId ?? undefined);
  const { create, update, sign, addendum, voidNote } = useClinicalNoteMutations(
    patient.id
  );
  const undoExtraction = useUndoClinicalNoteExtraction(patient.id);
  const retryExtraction = useRetryClinicalNoteExtraction(patient.id);
  const approveExtraction = useApproveClinicalNoteExtraction(patient.id);
  const rejectExtraction = useRejectClinicalNoteExtraction(patient.id);
  const { data: extractionStatus } = useClinicalNoteExtractionStatus(
    selectedId ?? undefined,
    Boolean(detail?.status === 'SIGNED')
  );
  const [draftMarkdown, setDraftMarkdown] = useState('');
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [isResolvingCreateTemplate, setIsResolvingCreateTemplate] =
    useState(false);
  const [evolutionPick, setEvolutionPick] = useState<{
    noteType: ClinicalNoteType;
    candidates: NavigationStep[];
    selectedStepId: string;
  } | null>(null);
  const user = useAuthStore((s) => s.user);
  const isInitializing = useAuthStore((s) => s.isInitializing);
  const role = user?.role;
  const clinicalSubrole = user?.clinicalSubrole;
  const userId = user?.id;

  const needsClinicalAxisForCoordOrAdmin =
    !!user &&
    (user.role === 'ADMIN' || user.role === 'COORDINATOR') &&
    (user.clinicalSubrole == null || user.clinicalSubrole === undefined);

  const canCreateNursing = canCreateClinicalNoteType(
    role,
    clinicalSubrole,
    'NURSING'
  );
  const canCreateMedical = canCreateClinicalNoteType(
    role,
    clinicalSubrole,
    'MEDICAL'
  );
  const canCreateAnyNote = canCreateNursing || canCreateMedical;

  const detailPerms = React.useMemo(() => {
    if (!detail) return null;
    const nt = detail.noteType;
    return {
      canEditDraft: canEditDraftClinicalNote(
        role,
        clinicalSubrole,
        nt,
        userId,
        detail.createdBy.id
      ),
      canSign: canCreateClinicalNoteType(role, clinicalSubrole, nt),
      canAddendum: canCreateClinicalNoteType(role, clinicalSubrole, nt),
      canVoid: canVoidClinicalNote(
        role,
        clinicalSubrole,
        nt,
        detail.status,
        userId,
        detail.createdBy.id
      ),
    };
  }, [detail, role, clinicalSubrole, userId]);

  const draftForAutosave = React.useMemo(
    () => ({ id: selectedId ?? '', contentMarkdown: draftMarkdown }),
    [selectedId, draftMarkdown]
  );
  const debouncedDraftPayload = useDebounce(
    draftForAutosave,
    CLINICAL_NOTE_AUTOSAVE_MS
  );

  const draftBaselineSerialized = React.useRef<string>('');
  /** Após 429 no PATCH, não dispara autosave até passar este instante (backoff exponencial por tentativa). */
  const autosaveRateLimitUntilRef = React.useRef(0);
  const autosaveRateLimitAttemptRef = React.useRef(0);

  React.useEffect(() => {
    setDraftMarkdown('');
    draftBaselineSerialized.current = '';
  }, [selectedId]);

  React.useEffect(() => {
    if (detail?.contentMarkdown === undefined) return;
    setDraftMarkdown(detail.contentMarkdown);
    if (detail.status === 'DRAFT') {
      draftBaselineSerialized.current = detail.contentMarkdown;
    }
  }, [detail?.id, detail?.latestVersionNumber, detail?.status, detail?.contentMarkdown]);

  React.useEffect(() => {
    if (!selectedId || !detailQueryError) return;
    if (!(detailQueryError instanceof ApiClientError)) return;
    if (detailQueryError.statusCode !== 404) return;
    toast.error(
      'Esta evolução não existe mais (dados podem ter sido recriados). A lista será atualizada.',
      { id: 'clinical-note-detail-404' }
    );
    setSelectedId(null);
    void queryClient.invalidateQueries({
      queryKey: ['clinical-notes', patient.id],
    });
    void queryClient.invalidateQueries({ queryKey: ['patient', patient.id] });
  }, [detailQueryError, patient.id, queryClient, selectedId]);

  React.useEffect(() => {
    const noteId = detail?.id;
    const noteStatus = detail?.status;
    if (
      !noteId ||
      noteStatus !== 'DRAFT' ||
      !detailPerms?.canEditDraft
    ) {
      return;
    }
    if (loadingDetail) return;
    if (debouncedDraftPayload.id !== noteId) return;
    if (Date.now() < autosaveRateLimitUntilRef.current) return;

    const serialized = debouncedDraftPayload.contentMarkdown;
    if (serialized === draftBaselineSerialized.current) return;
    if (update.isPending) return;

    update.mutate(
      {
        id: noteId,
        contentMarkdown: debouncedDraftPayload.contentMarkdown,
        silent: true,
      },
      {
        onSuccess: () => {
          draftBaselineSerialized.current = serialized;
          autosaveRateLimitAttemptRef.current = 0;
        },
        onError: (err) => {
          if (err instanceof ApiClientError && err.statusCode === 404) {
            toast.error(
              'Esta evolução não existe mais. Selecione outra na lista ou crie uma nova.',
              { id: 'clinical-note-autosave-404' }
            );
            setSelectedId(null);
            return;
          }
          if (err instanceof ApiClientError && err.statusCode === 429) {
            autosaveRateLimitAttemptRef.current += 1;
            const ms = Math.min(
              15_000 * 2 ** (autosaveRateLimitAttemptRef.current - 1),
              120_000
            );
            autosaveRateLimitUntilRef.current = Date.now() + ms;
            toast.error(
              'Muitas requisições: salvamento automático pausado por um momento.',
              { id: 'clinical-note-autosave-429' }
            );
            return;
          }
          const msg =
            err instanceof ApiClientError
              ? err.message
              : err instanceof Error
                ? err.message
                : 'Erro ao salvar rascunho';
          toast.error(msg, { id: 'clinical-note-autosave' });
        },
      }
    );
  }, [
    debouncedDraftPayload,
    detail?.id,
    detail?.status,
    detailPerms?.canEditDraft,
    loadingDetail,
    update.isPending,
    update.mutate,
  ]);

  const handleSignDraft = async () => {
    if (!detail || detail.status !== 'DRAFT' || !detailPerms?.canSign) return;
    if (
      !window.confirm(
        'Assinar esta evolução? Depois não será mais editável.'
      )
    ) {
      return;
    }
    try {
      const current = draftMarkdown;
      if (current !== draftBaselineSerialized.current) {
        await update.mutateAsync({
          id: detail.id,
          contentMarkdown: draftMarkdown,
        });
        draftBaselineSerialized.current = current;
      }
      await sign.mutateAsync(detail.id);
    } catch (err) {
      if (err instanceof ApiClientError && err.statusCode === 404) {
        toast.error(
          'Esta evolução não existe mais. Selecione outra na lista ou crie uma nova.',
          { id: 'clinical-note-sign-404' }
        );
        setSelectedId(null);
        return;
      }
      const msg =
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Não foi possível assinar.';
      toast.error(msg);
    }
  };

  const clearNavigationStepIdFromUrl = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (!params.has('navigationStepId')) return;
    params.delete('navigationStepId');
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  const openEvolutionForNavigationStep = useCallback(
    async (stepId: string) => {
      const step = navigationSteps.find((s) => s.id === stepId);
      if (!step) {
        toast.error('Etapa de navegação não encontrada para este paciente.');
        return;
      }
      const noteType = clinicalNoteTypeForNavigationStepKey(step.stepKey);
      if (!noteType) {
        toast.error('Esta etapa não permite evolução pelo prontuário.');
        return;
      }
      if (!canCreateClinicalNoteType(role, clinicalSubrole, noteType)) {
        toast.info(
          'Seu perfil não permite criar evolução para esta consulta. Selecione uma evolução existente na lista, se houver.'
        );
        const linked = (list?.data ?? []).filter(
          (n) => n.navigationStepId === stepId
        );
        const draft = linked.find((n) => n.status === 'DRAFT');
        const pick =
          draft ??
          [...linked].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
        if (pick) setSelectedId(pick.id);
        return;
      }

      const linked = (list?.data ?? []).filter(
        (n) => n.navigationStepId === stepId
      );
      const draft = linked.find((n) => n.status === 'DRAFT');
      if (draft) {
        setSelectedId(draft.id);
        return;
      }
      const latest = [...linked].sort((a, b) =>
        b.updatedAt.localeCompare(a.updatedAt)
      )[0];
      if (latest) {
        setSelectedId(latest.id);
        return;
      }

      setIsResolvingCreateTemplate(true);
      try {
        const base = await loadContentMarkdownFromPreviousEvolution(
          noteType,
          list?.data ?? []
        );
        let merged = base;
        try {
          const { contentMarkdown: suggestionMd } =
            await clinicalNotesApi.getSectionSuggestions(patient.id, {
              noteType,
              navigationStepId: stepId,
            });
          merged = mergeMarkdownWithCadastroSuggestion(base, suggestionMd);
        } catch {
          /* cadastro opcional */
        }
        const res = await create.mutateAsync({
          noteType,
          contentMarkdown: merged,
          navigationStepId: stepId,
        });
        setSelectedId(res.id);
      } catch (err) {
        const msg =
          err instanceof ApiClientError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Não foi possível abrir a evolução desta consulta.';
        toast.error(msg);
      } finally {
        setIsResolvingCreateTemplate(false);
      }
    },
    [
      clinicalSubrole,
      create,
      list?.data,
      navigationSteps,
      patient.id,
      role,
    ]
  );

  React.useEffect(() => {
    if (!deepLinkNavigationStepId) return;
    if (deepLinkHandledRef.current === deepLinkNavigationStepId) return;
    if (isLoading || loadingNavigationSteps || isInitializing) return;
    if (error) return;

    const stepId = deepLinkNavigationStepId;
    deepLinkHandledRef.current = stepId;

    void (async () => {
      await openEvolutionForNavigationStep(stepId);
      clearNavigationStepIdFromUrl();
    })();
  }, [
    clearNavigationStepIdFromUrl,
    deepLinkNavigationStepId,
    error,
    isInitializing,
    isLoading,
    loadingNavigationSteps,
    openEvolutionForNavigationStep,
  ]);

  const handleCreateEvolution = async (noteType: ClinicalNoteType) => {
    setIsResolvingCreateTemplate(true);
    try {
      const stepKey = CLINICAL_EVOLUTION_NAVIGATION_STEP_KEY[noteType];
      let candidates = sortNavigationStepsForEvolutionPick(
        filterNavigationStepsByEvolutionBaseKey(navigationSteps, stepKey),
        patient.currentStage
      );

      if (candidates.length === 0) {
        const { id: bootstrappedStepId } =
          await clinicalNotesApi.bootstrapEvolutionNavigationStep(patient.id, {
            noteType,
          });
        await queryClient.invalidateQueries({
          queryKey: ['navigation-steps', patient.id],
        });
        const nowIso = new Date().toISOString();
        candidates = sortNavigationStepsForEvolutionPick(
          [
            {
              id: bootstrappedStepId,
              patientId: patient.id,
              cancerType: patient.cancerType ?? 'other',
              journeyStage: patient.currentStage,
              stepKey,
              stepName:
                noteType === 'MEDICAL'
                  ? 'Consulta especializada'
                  : 'Consulta de navegação oncológica',
              status: 'PENDING',
              isRequired: false,
              isCompleted: false,
              createdAt: nowIso,
              updatedAt: nowIso,
            },
          ],
          patient.currentStage
        );
      }

      const base = await loadContentMarkdownFromPreviousEvolution(
        noteType,
        list?.data ?? []
      );
      let merged = base;
      try {
        const { contentMarkdown: suggestionMd } =
          await clinicalNotesApi.getSectionSuggestions(patient.id, {
            noteType,
            navigationStepId:
              candidates.length === 1 ? candidates[0]!.id : undefined,
          });
        merged = mergeMarkdownWithCadastroSuggestion(base, suggestionMd);
      } catch {
        /* cadastro opcional */
      }

      if (candidates.length > 1) {
        setEvolutionPick({
          noteType,
          candidates,
          selectedStepId: candidates[0]!.id,
        });
        return;
      }

      const res = await create.mutateAsync({
        noteType,
        contentMarkdown: merged,
        navigationStepId: candidates[0]!.id,
      });
      setSelectedId(res.id);
    } catch (err) {
      const msg =
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Não foi possível criar a evolução.';
      toast.error(msg);
    } finally {
      setIsResolvingCreateTemplate(false);
    }
  };

  const confirmEvolutionPick = async () => {
    if (!evolutionPick) return;
    setIsResolvingCreateTemplate(true);
    try {
      const base = await loadContentMarkdownFromPreviousEvolution(
        evolutionPick.noteType,
        list?.data ?? []
      );
      let contentMarkdown = base;
      try {
        const { contentMarkdown: suggestionMd } =
          await clinicalNotesApi.getSectionSuggestions(patient.id, {
            noteType: evolutionPick.noteType,
            navigationStepId: evolutionPick.selectedStepId,
          });
        contentMarkdown = mergeMarkdownWithCadastroSuggestion(
          base,
          suggestionMd
        );
      } catch {
        contentMarkdown = base;
      }

      const res = await create.mutateAsync({
        noteType: evolutionPick.noteType,
        contentMarkdown,
        navigationStepId: evolutionPick.selectedStepId,
      });
      setSelectedId(res.id);
      setEvolutionPick(null);
    } catch (err) {
      const msg =
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Não foi possível criar a evolução.';
      toast.error(msg);
    } finally {
      setIsResolvingCreateTemplate(false);
    }
  };

  const handleAddendum = () => {
    if (!detail) return;
    if (
      !window.confirm(
        'Criar nova evolução (adendo) vinculada a esta nota assinada?'
      )
    ) {
      return;
    }
    addendum.mutate(
      {
        parentId: detail.id,
        contentMarkdown: detail.contentMarkdown,
      },
      {
        onSuccess: (res) => {
          setSelectedId(res.id);
        },
        onError: (err) => {
          const msg =
            err instanceof ApiClientError
              ? err.message
              : err instanceof Error
                ? err.message
                : 'Não foi possível criar o adendo.';
          toast.error(msg);
        },
      }
    );
  };

  const statusBadge = (s: string) => {
    if (s === 'SIGNED')
      return (
        <Badge className="bg-green-100 text-green-900 border-green-300">
          Assinada
        </Badge>
      );
    if (s === 'VOIDED')
      return <Badge variant="destructive">Anulada</Badge>;
    return <Badge variant="secondary">Rascunho</Badge>;
  };

  const isDraftEditable =
    detail?.status === 'DRAFT' && detailPerms?.canEditDraft;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Prontuário</h2>
            <p className="text-sm text-muted-foreground">
              Evolução em texto livre com Markdown. Edição até assinatura; depois
              use nova evolução (adendo).
            </p>
          </div>
          <div className="flex flex-wrap gap-2 justify-end min-h-9 items-center">
            {isInitializing ? (
              <span className="text-sm text-muted-foreground">
                Carregando permissões…
              </span>
            ) : (
              <>
                {canCreateNursing && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={create.isPending || isResolvingCreateTemplate}
                    onClick={() => void handleCreateEvolution('NURSING')}
                  >
                    Evolução — Enfermagem
                  </Button>
                )}
                {canCreateMedical && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={create.isPending || isResolvingCreateTemplate}
                    onClick={() => void handleCreateEvolution('MEDICAL')}
                  >
                    Evolução — Médica
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {!isInitializing && needsClinicalAxisForCoordOrAdmin && (
          <div
            role="status"
            className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100"
          >
            <p className="font-medium">Eixo clínico obrigatório</p>
            <p className="mt-1 text-muted-foreground dark:text-amber-200/90">
              Para criar evoluções, administradores e coordenadores precisam ter o
              eixo <strong>Enfermagem</strong> ou <strong>Médico</strong>{' '}
              definido. Atualize em{' '}
              <Link
                href="/profile"
                className="font-medium text-primary underline underline-offset-2"
              >
                Meu perfil
              </Link>
              {user?.role === 'ADMIN' ? (
                <>
                  {' '}
                  ou em{' '}
                  <Link
                    href="/users"
                    className="font-medium text-primary underline underline-offset-2"
                  >
                    Usuários
                  </Link>{' '}
                  ao editar sua conta.
                </>
              ) : (
                <> ou peça ao administrador da instituição.</>
              )}
            </p>
          </div>
        )}
      </div>

      {error != null && (
        <QueryErrorRetry
          title="Não foi possível carregar as evoluções"
          onRetry={refetch}
          isFetching={isFetching}
          className="max-w-lg"
        />
      )}

      {isLoading && (
        <p className="text-muted-foreground text-sm">Carregando notas...</p>
      )}

      {list && list.data.length === 0 && !isLoading && (
        <p className="text-muted-foreground text-sm">
          {canCreateAnyNote
            ? 'Nenhuma evolução registrada. Crie uma nota conforme seu perfil clínico.'
            : 'Nenhuma evolução registrada. Seu perfil não permite criar evoluções neste prontuário.'}
        </p>
      )}

      {list && list.data.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Lista de evoluções">
          {list.data.map((n) => (
            <li key={n.id}>
              <Button
                type="button"
                variant={selectedId === n.id ? 'default' : 'outline'}
                size="sm"
                className="justify-start h-auto py-2 px-3"
                onClick={() => setSelectedId(n.id)}
              >
                <span className="flex flex-col items-start gap-1">
                  <span className="flex items-center gap-2">
                    {n.noteType === 'NURSING' ? 'Enfermagem' : 'Médico'}
                    {statusBadge(n.status)}
                  </span>
                  <span className="text-xs text-muted-foreground font-normal">
                    {format(new Date(n.createdAt), "dd/MM/yyyy HH:mm", {
                      locale: ptBR,
                    })}
                  </span>
                  {n.navigationStep && (
                    <span className="text-xs text-muted-foreground font-normal max-w-[16rem] truncate block">
                      {n.navigationStep.stepName} ·{' '}
                      {journeyStageLabel(n.navigationStep.journeyStage)}
                    </span>
                  )}
                  {n.status === 'DRAFT' && n.lastEditedBy && (
                    <span className="text-xs text-muted-foreground font-normal max-w-[14rem] truncate">
                      Última edição: {n.lastEditedBy.name}
                    </span>
                  )}
                  {n.status === 'SIGNED' && n.signedBy && (
                    <span className="text-xs text-muted-foreground font-normal max-w-[14rem] truncate">
                      Assinado por: {n.signedBy.name}
                    </span>
                  )}
                </span>
              </Button>
            </li>
          ))}
        </ul>
      )}

      {selectedId && (
        <div className="border rounded-lg p-4 space-y-4">
          {loadingDetail && (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          )}
          {detail && (
            <>
              <div className="flex flex-wrap gap-2 items-center justify-between">
                <div className="flex flex-col gap-1 min-w-0">
                  <p className="text-base font-semibold text-foreground truncate max-w-full">
                    {clinicalNotePrimaryPersonName(detail)}
                  </p>
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className="text-xs text-muted-foreground">
                      {clinicalNoteTypeLabel(detail.noteType)}
                    </span>
                    {detail.navigationStep && (
                      <span className="text-xs text-muted-foreground">
                        · {detail.navigationStep.stepName} (
                        {journeyStageLabel(detail.navigationStep.journeyStage)}
                        )
                      </span>
                    )}
                    {statusBadge(detail.status)}
                    {detail.amendsClinicalNoteId && (
                      <span className="text-xs text-muted-foreground">
                        Adendo vinculado a outra evolução
                      </span>
                    )}
                  </div>
                  {detail.status === 'SIGNED' && detail.signedAt && (
                    <p className="text-xs text-muted-foreground">
                      Assinatura em{' '}
                      {format(
                        new Date(detail.signedAt),
                        "dd/MM/yyyy 'às' HH:mm",
                        { locale: ptBR }
                      )}
                    </p>
                  )}
                  {detail.status === 'SIGNED' && extractionStatus && (
                    <div className="flex flex-col gap-1 mt-1">
                      <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={
                          extractionStatus.status === 'FAILED'
                            ? 'destructive'
                            : extractionStatus.status === 'AWAITING_REVIEW'
                              ? 'default'
                              : 'secondary'
                        }
                        className="text-xs font-normal"
                      >
                        Extração assistida:{' '}
                        {extractionStatusLabel(extractionStatus.status)}
                      </Badge>
                      {extractionStatus.status === 'AWAITING_REVIEW' &&
                        extractionStatus.proposalSummary &&
                        detailPerms?.canSign && (
                          <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm space-y-2 max-w-prose">
                            <p className="font-medium text-foreground">
                              Revise antes de gravar no prontuário
                            </p>
                            <p className="text-xs text-muted-foreground">
                              A IA estruturou a evolução assinada. Nada será
                              salvo até você aprovar. Depois da aprovação, você
                              ainda pode desfazer por até{' '}
                              {extractionStatus.undoWindowDays} dias.
                            </p>
                            <ul className="text-xs list-disc pl-4 space-y-0.5">
                              {proposalSummaryLines(
                                extractionStatus.proposalSummary
                              ).map((line) => (
                                <li key={line}>{line}</li>
                              ))}
                            </ul>
                            <div className="flex flex-wrap gap-2 pt-1">
                              <Button
                                type="button"
                                size="sm"
                                disabled={
                                  approveExtraction.isPending ||
                                  rejectExtraction.isPending
                                }
                                onClick={() => {
                                  approveExtraction.mutate(detail.id, {
                                    onSuccess: () => {
                                      toast.success(
                                        'Extração aprovada e aplicada ao prontuário.'
                                      );
                                    },
                                    onError: (err) => {
                                      const msg =
                                        err instanceof ApiClientError
                                          ? err.message
                                          : 'Não foi possível aprovar.';
                                      toast.error(msg);
                                    },
                                  });
                                }}
                              >
                                Aprovar e aplicar
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={
                                  approveExtraction.isPending ||
                                  rejectExtraction.isPending
                                }
                                onClick={() => {
                                  rejectExtraction.mutate(
                                    { noteId: detail.id },
                                    {
                                      onSuccess: () => {
                                        toast.success(
                                          'Proposta rejeitada. Nenhuma alteração foi aplicada.'
                                        );
                                      },
                                      onError: (err) => {
                                        const msg =
                                          err instanceof ApiClientError
                                            ? err.message
                                            : 'Não foi possível rejeitar.';
                                        toast.error(msg);
                                      },
                                    }
                                  );
                                }}
                              >
                                Rejeitar
                              </Button>
                            </div>
                          </div>
                        )}
                      {extractionStatus.status === 'APPLIED' &&
                        extractionStatus.canUndoUntil &&
                        new Date(extractionStatus.canUndoUntil) > new Date() &&
                        detailPerms?.canSign && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={undoExtraction.isPending}
                            onClick={() => {
                              undoExtraction.mutate(detail.id, {
                                onSuccess: () => {
                                  toast.success('Extração desfeita.');
                                },
                                onError: (err) => {
                                  const msg =
                                    err instanceof ApiClientError
                                      ? err.message
                                      : 'Não foi possível desfazer.';
                                  toast.error(msg);
                                },
                              });
                            }}
                          >
                            Desfazer extração
                          </Button>
                        )}
                      </div>
                      {extractionStatus.status === 'FAILED' &&
                        detailPerms?.canSign && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={retryExtraction.isPending}
                            onClick={() => {
                              retryExtraction.mutate(detail.id, {
                                onSuccess: () => {
                                  toast.success(
                                    'Estruturação reenfileirada. Aguarde alguns instantes.'
                                  );
                                },
                                onError: (err) => {
                                  const msg =
                                    err instanceof ApiClientError
                                      ? err.message
                                      : 'Não foi possível reprocessar.';
                                  toast.error(msg);
                                },
                              });
                            }}
                          >
                            Reprocessar estruturação
                          </Button>
                        )}
                      {(extractionStatus.status === 'FAILED' ||
                        extractionStatus.status === 'REJECTED') &&
                        extractionStatus.errorMessage?.trim() && (
                          <p
                            className={`text-xs max-w-prose ${
                              extractionStatus.status === 'FAILED'
                                ? 'text-destructive'
                                : 'text-muted-foreground'
                            }`}
                          >
                            {extractionStatus.errorMessage.trim()}
                          </p>
                        )}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2 items-stretch sm:items-end">
                  <div className="flex flex-wrap gap-2 justify-end">
                    {detail.status === 'DRAFT' && detailPerms && (
                      <>
                        {detailPerms.canEditDraft && (
                          <Button
                            size="sm"
                            type="button"
                            disabled={update.isPending}
                            onClick={() =>
                              update.mutate(
                                {
                                  id: detail.id,
                                  contentMarkdown: draftMarkdown,
                                },
                                {
                                  onSuccess: () => {
                                    draftBaselineSerialized.current =
                                      draftMarkdown;
                                    autosaveRateLimitAttemptRef.current = 0;
                                  },
                                  onError: (err) => {
                                    if (
                                      err instanceof ApiClientError &&
                                      err.statusCode === 404
                                    ) {
                                      toast.error(
                                        'Esta evolução não existe mais. Selecione outra na lista ou crie uma nova.',
                                        { id: 'clinical-note-save-404' }
                                      );
                                      setSelectedId(null);
                                      return;
                                    }
                                    if (
                                      err instanceof ApiClientError &&
                                      err.statusCode === 429
                                    ) {
                                      autosaveRateLimitAttemptRef.current += 1;
                                      const ms = Math.min(
                                        15_000 *
                                          2 **
                                            (autosaveRateLimitAttemptRef.current -
                                              1),
                                        120_000
                                      );
                                      autosaveRateLimitUntilRef.current =
                                        Date.now() + ms;
                                      toast.error(
                                        'Muitas requisições. Aguarde antes de salvar de novo.',
                                        { id: 'clinical-note-save-429' }
                                      );
                                      return;
                                    }
                                    const msg =
                                      err instanceof ApiClientError
                                        ? err.message
                                        : err instanceof Error
                                          ? err.message
                                          : 'Erro ao salvar';
                                    toast.error(msg);
                                  },
                                }
                              )
                            }
                          >
                            Salvar agora
                          </Button>
                        )}
                        {detailPerms.canSign && (
                          <Button
                            size="sm"
                            type="button"
                            variant="secondary"
                            disabled={sign.isPending || update.isPending}
                            onClick={() => void handleSignDraft()}
                          >
                            Assinar
                          </Button>
                        )}
                      </>
                    )}
                    {detail.status === 'SIGNED' && detailPerms?.canAddendum && (
                      <Button
                        size="sm"
                        type="button"
                        variant="secondary"
                        disabled={addendum.isPending}
                        onClick={() => void handleAddendum()}
                      >
                        Nova evolução (adendo)
                      </Button>
                    )}
                    {detailPerms?.canVoid &&
                      (detail.status === 'DRAFT' ||
                        detail.status === 'SIGNED') && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setVoidOpen(true)}
                        >
                          Anular
                        </Button>
                      )}
                  </div>
                </div>
              </div>

              <Tabs defaultValue="evolution" className="[overflow-anchor:none]">
                <TabsList className="w-full justify-start">
                  <TabsTrigger value="evolution">Evolução</TabsTrigger>
                  <TabsTrigger value="exams">Exames</TabsTrigger>
                  {detail.noteType === 'MEDICAL' && (
                    <TabsTrigger value="prescription">Receita</TabsTrigger>
                  )}
                </TabsList>

                <TabsContent value="evolution">
                  <div className="space-y-2">
                    {isDraftEditable && detailPerms?.canEditDraft && (
                      <PatientExamIngestAssist
                        patientId={patient.id}
                        clinicalNoteId={detail.id}
                        disabled={update.isPending || sign.isPending}
                        onAppendMarkdown={(fragment) =>
                          setDraftMarkdown((prev) =>
                            prev.trim()
                              ? `${prev.trim()}\n\n---\n\n${fragment}`
                              : fragment
                          )
                        }
                      />
                    )}
                    <Label htmlFor="clinical-note-markdown">
                      {isDraftEditable
                        ? 'Evolução clínica (Markdown)'
                        : 'Evolução clínica'}
                    </Label>
                    {isDraftEditable ? (
                      <Textarea
                        id="clinical-note-markdown"
                        value={draftMarkdown}
                        onChange={(e) => setDraftMarkdown(e.target.value)}
                        rows={30}
                        className="font-mono text-sm pb-12 md:pb-16 resize-none overflow-y-auto"
                        spellCheck
                      />
                    ) : (
                      <div
                        className="rounded-md border bg-muted/30 p-4 pb-12 md:pb-16 max-h-[32rem] overflow-y-auto"
                        role="region"
                        aria-label="Conteúdo da evolução"
                      >
                        <ClinicalNoteMarkdownBody markdown={draftMarkdown} />
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="exams">
                  <Tabs defaultValue="orders" className="w-full">
                    <TabsList className="w-full justify-start flex-wrap h-auto gap-1 py-1">
                      <TabsTrigger value="orders">Pedidos desta evolução</TabsTrigger>
                      <TabsTrigger value="lab-history">
                        Histórico laboratorial
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="orders" className="mt-3">
                      <ClinicalNoteOrdersPanel
                        variant="exams"
                        patientId={patient.id}
                        patientName={patient.name}
                        clinicalNoteId={detail.id}
                        noteType={detail.noteType}
                        noteStatus={detail.status}
                        draftMarkdown={draftMarkdown}
                        professionalName={
                          detail.signedBy?.name?.trim() ||
                          detail.createdBy?.name?.trim() ||
                          undefined
                        }
                        canManageExamRequests={canCreateClinicalNoteType(
                          role,
                          clinicalSubrole,
                          detail.noteType
                        )}
                        canManagePrescriptions={false}
                      />
                    </TabsContent>
                    <TabsContent value="lab-history" className="mt-3">
                      <PatientProntuarioLabHistory patient={patient} />
                    </TabsContent>
                  </Tabs>
                </TabsContent>

                <TabsContent value="prescription">
                  {detail.noteType === 'MEDICAL' && (
                    <ClinicalNoteOrdersPanel
                      variant="prescription"
                      patientId={patient.id}
                      patientName={patient.name}
                      clinicalNoteId={detail.id}
                      noteType={detail.noteType}
                      noteStatus={detail.status}
                      draftMarkdown={draftMarkdown}
                      professionalName={
                        detail.signedBy?.name?.trim() ||
                        detail.createdBy?.name?.trim() ||
                        undefined
                      }
                      canManageExamRequests={false}
                      canManagePrescriptions={canCreateClinicalNoteType(
                        role,
                        clinicalSubrole,
                        'MEDICAL'
                      )}
                    />
                  )}
                </TabsContent>
              </Tabs>

              {detail.status === 'VOIDED' && detail.voidReason && (
                <p className="text-sm text-destructive">
                  Motivo da anulação: {detail.voidReason}
                </p>
              )}
            </>
          )}
        </div>
      )}

      <AlertDialog
        open={evolutionPick !== null}
        onOpenChange={(open) => {
          if (!open) setEvolutionPick(null);
        }}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Vincular à etapa de navegação</AlertDialogTitle>
            <AlertDialogDescription>
              Existe mais de uma etapa compatível com este tipo de evolução.
              Selecione a consulta à qual este registro se refere.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {evolutionPick && (
            <div className="space-y-2 py-2">
              <Label htmlFor="evolution-nav-step-select">Etapa de navegação</Label>
              <Select
                value={evolutionPick.selectedStepId}
                onValueChange={(v) =>
                  setEvolutionPick((prev) =>
                    prev ? { ...prev, selectedStepId: v } : null
                  )
                }
              >
                <SelectTrigger id="evolution-nav-step-select">
                  <SelectValue placeholder="Selecione a etapa" />
                </SelectTrigger>
                <SelectContent>
                  {evolutionPick.candidates.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.stepName} · {journeyStageLabel(s.journeyStage)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={create.isPending}>
              Cancelar
            </AlertDialogCancel>
            <Button
              type="button"
              disabled={create.isPending || !evolutionPick}
              onClick={() => void confirmEvolutionPick()}
            >
              {create.isPending ? 'Criando…' : 'Criar evolução'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={voidOpen} onOpenChange={setVoidOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Anular evolução</AlertDialogTitle>
            <AlertDialogDescription>
              Informe o motivo da anulação (registro de auditoria).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AutoResizeTextarea
            value={voidReason}
            onChange={(e) => setVoidReason(e.target.value)}
            placeholder="Motivo"
            minRows={3}
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={voidNote.isPending}>
              Cancelar
            </AlertDialogCancel>
            <Button
              type="button"
              disabled={
                voidNote.isPending || !voidReason.trim() || !selectedId
              }
              onClick={() => {
                if (!selectedId) return;
                voidNote.mutate(
                  { id: selectedId, voidReason: voidReason.trim() },
                  {
                    onSuccess: () => {
                      setVoidOpen(false);
                      setVoidReason('');
                      setSelectedId(null);
                      toast.success('Evolução anulada.');
                    },
                    onError: (err) => {
                      const msg =
                        err instanceof ApiClientError
                          ? err.message
                          : err instanceof Error
                            ? err.message
                            : 'Não foi possível anular a evolução.';
                      toast.error(msg);
                    },
                  }
                );
              }}
            >
              {voidNote.isPending ? 'Anulando…' : 'Confirmar anulação'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
