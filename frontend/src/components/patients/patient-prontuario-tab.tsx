'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { PatientDetail } from '@/lib/api/patients';
import {
  CLINICAL_EVOLUTION_NAVIGATION_STEP_KEY,
  CLINICAL_NOTE_SECTION_KEYS,
  cloneClinicalNoteSections,
  clinicalNotePrimaryPersonName,
  clinicalNoteTypeLabel,
  clinicalNotesApi,
  emptyClinicalSections,
  loadSectionsFromPreviousEvolution,
  mergeClinicalSectionsWithCadastroSuggestions,
  serializeClinicalNoteSections,
  type ClinicalNoteSectionKey,
  type ClinicalNoteType,
} from '@/lib/api/clinical-notes';
import type { NavigationStep } from '@/lib/api/oncology-navigation';
import { usePatientNavigationSteps } from '@/hooks/useOncologyNavigation';
import { JOURNEY_STAGE_LABELS, type JourneyStage } from '@/lib/utils/journey-stage';
import {
  useClinicalNoteDetail,
  useClinicalNotesList,
  useClinicalNoteMutations,
} from '@/hooks/use-clinical-notes';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
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

/** Tempo sem digitar antes de enviar PATCH (salvamento automático do rascunho) */
const CLINICAL_NOTE_AUTOSAVE_MS = 1000;

const SECTION_LABELS: Record<ClinicalNoteSectionKey, string> = {
  identificacao: 'Identificação',
  hda: 'HDA',
  hpp: 'HPP',
  comorbidades: 'Comorbidades',
  medicacoesEmUso: 'Medicações em uso',
  alergias: 'Alergias',
  subjetivo: 'Subjetivo',
  exameFisico: 'Exame físico',
  examesComplementares: 'Exames complementares',
  analise: 'Análise',
  conduta: 'Conduta',
  tratamentos: 'Tratamentos',
  navegacao: 'Navegação oncológica',
  planos: 'Planos',
};

interface PatientProntuarioTabProps {
  patient: PatientDetail;
}

function journeyStageLabel(stage: string): string {
  const s = stage as JourneyStage;
  return JOURNEY_STAGE_LABELS[s] ?? stage;
}

export function PatientProntuarioTab({
  patient,
}: PatientProntuarioTabProps): React.ReactElement {
  const {
    data: list,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useClinicalNotesList(patient.id);
  const { data: navigationSteps = [] } = usePatientNavigationSteps(patient.id);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: detail, isLoading: loadingDetail } = useClinicalNoteDetail(
    selectedId ?? undefined
  );
  const { create, update, sign, addendum, voidNote } = useClinicalNoteMutations(
    patient.id
  );
  const [draftSections, setDraftSections] = useState<Record<string, string>>(
    {}
  );
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [isResolvingCreateTemplate, setIsResolvingCreateTemplate] =
    useState(false);
  const [evolutionPick, setEvolutionPick] = useState<{
    noteType: ClinicalNoteType;
    sections: Record<string, string>;
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

  const debouncedDraftPayload = useDebounce(
    { id: selectedId ?? '', sections: draftSections },
    CLINICAL_NOTE_AUTOSAVE_MS
  );

  const draftBaselineSerialized = React.useRef<string>('');

  React.useEffect(() => {
    setDraftSections(emptyClinicalSections());
    draftBaselineSerialized.current = '';
  }, [selectedId]);

  React.useEffect(() => {
    if (!detail?.sections) return;
    setDraftSections({ ...detail.sections });
    if (detail.status === 'DRAFT') {
      draftBaselineSerialized.current = serializeClinicalNoteSections(
        detail.sections
      );
    }
  }, [detail?.id, detail?.latestVersionNumber, detail?.status]);

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

    const serialized = serializeClinicalNoteSections(
      debouncedDraftPayload.sections
    );
    if (serialized === draftBaselineSerialized.current) return;
    if (update.isPending) return;

    update.mutate(
      { id: noteId, sections: debouncedDraftPayload.sections },
      {
        onSuccess: () => {
          draftBaselineSerialized.current = serialized;
        },
        onError: (err) => {
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
      const current = serializeClinicalNoteSections(draftSections);
      if (current !== draftBaselineSerialized.current) {
        await update.mutateAsync({
          id: detail.id,
          sections: draftSections,
        });
        draftBaselineSerialized.current = current;
      }
      await sign.mutateAsync(detail.id);
    } catch (err) {
      const msg =
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Não foi possível assinar.';
      toast.error(msg);
    }
  };

  const handleCreateEvolution = async (noteType: ClinicalNoteType) => {
    setIsResolvingCreateTemplate(true);
    try {
      const stepKey = CLINICAL_EVOLUTION_NAVIGATION_STEP_KEY[noteType];
      const candidates = navigationSteps.filter((s) => s.stepKey === stepKey);

      if (candidates.length === 0) {
        toast.error(
          'Não há etapa de navegação correspondente no paciente. Abra Navegação oncológica no menu e garanta as etapas "Consulta especializada" (evolução médica) ou "Consulta de navegação oncológica" (evolução de enfermagem).'
        );
        return;
      }

      const sections = await loadSectionsFromPreviousEvolution(
        noteType,
        list?.data ?? []
      );
      let merged = sections;
      try {
        const suggestions = await clinicalNotesApi.getSectionSuggestions(
          patient.id,
          {
            noteType,
            navigationStepId:
              candidates.length === 1 ? candidates[0]!.id : undefined,
          }
        );
        merged = mergeClinicalSectionsWithCadastroSuggestions(
          sections,
          suggestions
        );
      } catch {
        /* cadastro opcional; evolução segue só com texto da evolução anterior */
      }

      if (candidates.length > 1) {
        setEvolutionPick({
          noteType,
          sections: merged,
          candidates,
          selectedStepId: candidates[0]!.id,
        });
        return;
      }

      const res = await create.mutateAsync({
        noteType,
        sections: merged,
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
      const base = await loadSectionsFromPreviousEvolution(
        evolutionPick.noteType,
        list?.data ?? []
      );
      let sections = evolutionPick.sections;
      try {
        const suggestions = await clinicalNotesApi.getSectionSuggestions(
          patient.id,
          {
            noteType: evolutionPick.noteType,
            navigationStepId: evolutionPick.selectedStepId,
          }
        );
        sections = mergeClinicalSectionsWithCadastroSuggestions(
          base,
          suggestions
        );
      } catch {
        sections = evolutionPick.sections;
      }

      const res = await create.mutateAsync({
        noteType: evolutionPick.noteType,
        sections,
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
        sections: cloneClinicalNoteSections(detail.sections),
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

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Prontuário</h2>
            <p className="text-sm text-muted-foreground">
              Edição até assinatura; depois use nova evolução (adendo).
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
                    href="/dashboard/users"
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

      {error && (
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
                                sections: draftSections,
                              },
                              {
                                onSuccess: () => {
                                  draftBaselineSerialized.current =
                                    serializeClinicalNoteSections(
                                      draftSections
                                    );
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
                  {detail.status === 'DRAFT' && detailPerms?.canEditDraft && (
                    <p className="text-xs text-muted-foreground text-right max-w-md sm:max-w-lg">
                      {update.isPending
                        ? 'Salvando rascunho…'
                        : 'Salvamento automático cerca de 1 s após parar de digitar.'}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {CLINICAL_NOTE_SECTION_KEYS.map((key) => (
                  <div key={key} className="space-y-1">
                    <Label htmlFor={`sec-${key}`}>{SECTION_LABELS[key]}</Label>
                    <Textarea
                      id={`sec-${key}`}
                      value={draftSections[key] ?? ''}
                      readOnly={
                        detail.status !== 'DRAFT' ||
                        !detailPerms?.canEditDraft
                      }
                      onChange={(e) =>
                        setDraftSections((prev) => ({
                          ...prev,
                          [key]: e.target.value,
                        }))
                      }
                      rows={3}
                      className="text-sm"
                    />
                  </div>
                ))}
              </div>

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
          <Textarea
            value={voidReason}
            onChange={(e) => setVoidReason(e.target.value)}
            placeholder="Motivo"
            rows={3}
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
