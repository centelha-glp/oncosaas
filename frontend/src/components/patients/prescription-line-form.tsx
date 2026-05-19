'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { ExamCatalogCombobox } from '@/components/shared/exam-catalog-combobox';
import {
  medicationCatalogApi,
  type MedicationCatalogEntry,
} from '@/lib/api/medication-catalog';
import { useDebounce } from '@/lib/utils/use-debounce';
import {
  CONTINUOUS_DURATION,
  isContinuousPrescriptionDuration,
} from '@/lib/utils/prescription-posology';
import type { PrescriptionDraftFromHistory } from '@/lib/utils/clinical-orders-payload';

export type PrescriptionLineFormValues = {
  medicationName: string;
  catalogKey?: string;
  presentationCatalogCode?: string;
  quantity: string;
  dosage: string;
  frequency: string;
  route: string;
  duration: string;
  observation?: string;
};

type Props = {
  disabled?: boolean;
  pending?: boolean;
  draft?: PrescriptionDraftFromHistory | null;
  onDraftConsumed?: () => void;
  submitLabel?: string;
  onCancel?: () => void;
  onSubmit: (values: PrescriptionLineFormValues) => void;
};

function entryOptionId(entry: MedicationCatalogEntry): string {
  return entry.presentationCode ?? entry.drugCode;
}

function resetFormState(setters: {
  setMedQuery: (v: string) => void;
  setSelectedEntry: (v: MedicationCatalogEntry | null) => void;
  setMedQuantity: (v: string) => void;
  setMedDose: (v: string) => void;
  setMedFreq: (v: string) => void;
  setMedRoute: (v: string) => void;
  setDurationContinuous: (v: boolean) => void;
  setDurationText: (v: string) => void;
  setMedObservation: (v: string) => void;
}) {
  setters.setMedQuery('');
  setters.setSelectedEntry(null);
  setters.setMedQuantity('');
  setters.setMedDose('');
  setters.setMedFreq('');
  setters.setMedRoute('');
  setters.setDurationContinuous(false);
  setters.setDurationText('');
  setters.setMedObservation('');
}

export function PrescriptionLineForm({
  disabled,
  pending,
  draft,
  onDraftConsumed,
  submitLabel = 'Adicionar à prescrição',
  onCancel,
  onSubmit,
}: Props) {
  const [medQuery, setMedQuery] = useState('');
  const debouncedMedQ = useDebounce(medQuery, 300);
  const [selectedEntry, setSelectedEntry] =
    useState<MedicationCatalogEntry | null>(null);
  const [medQuantity, setMedQuantity] = useState('');
  const [medDose, setMedDose] = useState('');
  const [medFreq, setMedFreq] = useState('');
  const [medRoute, setMedRoute] = useState('');
  const [durationContinuous, setDurationContinuous] = useState(false);
  const [durationText, setDurationText] = useState('');
  const [medObservation, setMedObservation] = useState('');

  useEffect(() => {
    if (!draft) return;
    setMedQuery(draft.medicationName);
    setMedQuantity(draft.quantity ?? '1');
    setMedDose(draft.dosage ?? '');
    setMedFreq(draft.frequency ?? '');
    setMedRoute(draft.route ?? '');
    const dur = draft.duration ?? '';
    if (dur && isContinuousPrescriptionDuration(dur)) {
      setDurationContinuous(true);
      setDurationText('');
    } else {
      setDurationContinuous(false);
      setDurationText(dur);
    }
    setMedObservation(draft.observation ?? '');
    setSelectedEntry(null);
    if (draft.catalogKey) {
      const catalogKey = draft.catalogKey;
      const presentationCatalogCode = draft.presentationCatalogCode;
      void medicationCatalogApi
        .searchEntries({
          q: presentationCatalogCode ?? catalogKey,
          limit: 40,
        })
        .then((res) => {
          const match =
            res.items.find(
              (e) =>
                e.presentationCode === presentationCatalogCode ||
                (e.drugCode === catalogKey && !presentationCatalogCode)
            ) ?? res.items.find((e) => e.drugCode === catalogKey);
          if (match) {
            setSelectedEntry(match);
            setMedQuery(match.label);
          }
        })
        .catch(() => undefined);
    }
    onDraftConsumed?.();
  }, [draft, onDraftConsumed]);

  const { data: entrySearch } = useQuery({
    queryKey: ['medication-catalog-entries', debouncedMedQ],
    queryFn: () =>
      medicationCatalogApi.searchEntries({
        q: debouncedMedQ || undefined,
        limit: 80,
      }),
    staleTime: 60_000,
  });

  const { data: routesData } = useQuery({
    queryKey: ['medication-catalog', 'routes'],
    queryFn: () => medicationCatalogApi.listRoutes(),
    staleTime: 10 * 60_000,
  });

  const medComboboxOptions = useMemo(
    () =>
      (entrySearch?.items ?? []).map((entry) => ({
        id: entryOptionId(entry),
        label: entry.label,
        subtitle:
          entry.strength && entry.label.includes(entry.displayName)
            ? undefined
            : entry.displayName,
        data: entry,
      })),
    [entrySearch]
  );

  const routeOptions = useMemo(() => {
    const all = routesData?.routes ?? [];
    const allowed = selectedEntry?.allowedRoutes ?? [];
    const filtered =
      allowed.length > 0 ? all.filter((r) => allowed.includes(r.code)) : all;
    return filtered.map((r) => ({ value: r.code, label: r.label }));
  }, [routesData, selectedEntry]);

  const isCatalogSelection =
    selectedEntry != null && medQuery.trim() === selectedEntry.label.trim();

  const resolvedDuration = durationContinuous
    ? CONTINUOUS_DURATION
    : durationText.trim();

  const canSubmit =
    Boolean(medQuery.trim()) &&
    Boolean(medQuantity.trim()) &&
    Boolean(medDose.trim()) &&
    Boolean(medFreq.trim()) &&
    Boolean(medRoute.trim()) &&
    Boolean(resolvedDuration);

  const buildPayload = (): PrescriptionLineFormValues => {
    const shared = {
      quantity: medQuantity.trim(),
      dosage: medDose.trim(),
      frequency: medFreq.trim(),
      route: medRoute.trim(),
      duration: resolvedDuration,
      observation: medObservation.trim() || undefined,
    };
    if (isCatalogSelection && selectedEntry) {
      return {
        medicationName: selectedEntry.label,
        catalogKey: selectedEntry.drugCode,
        presentationCatalogCode: selectedEntry.presentationCode ?? undefined,
        ...shared,
      };
    }
    return {
      medicationName: medQuery.trim(),
      ...shared,
    };
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit(buildPayload());
    resetFormState({
      setMedQuery,
      setSelectedEntry,
      setMedQuantity,
      setMedDose,
      setMedFreq,
      setMedRoute,
      setDurationContinuous,
      setDurationText,
      setMedObservation,
    });
  };

  const handleCancel = () => {
    resetFormState({
      setMedQuery,
      setSelectedEntry,
      setMedQuantity,
      setMedDose,
      setMedFreq,
      setMedRoute,
      setDurationContinuous,
      setDurationText,
      setMedObservation,
    });
    onCancel?.();
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
      <div className="space-y-1 sm:col-span-2">
        <Label htmlFor="rx-med-search">
          Medicamento <span className="text-destructive">*</span>
        </Label>
        <ExamCatalogCombobox
          options={medComboboxOptions}
          value={medQuery}
          onValueChange={(value) => {
            setMedQuery(value);
            if (
              selectedEntry &&
              value.trim() !== selectedEntry.label.trim()
            ) {
              setSelectedEntry(null);
            }
          }}
          onSelectOption={(opt) => {
            const entry = opt.data;
            setSelectedEntry(entry);
            setMedQuery(entry.label);
            if (!medQuantity.trim()) setMedQuantity('1');
          }}
          placeholder="Pesquisar medicamento (nome, concentração) ou digitar livre…"
          emptyText="Nenhuma opção no catálogo. Digite livremente e clique em Adicionar."
          disabled={disabled}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="rx-quantity">
          Quantidade <span className="text-destructive">*</span>
        </Label>
        <Input
          id="rx-quantity"
          value={medQuantity}
          onChange={(e) => setMedQuantity(e.target.value)}
          placeholder="Ex.: 1, 2"
          autoComplete="off"
          disabled={disabled}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="rx-dose">
          Dose (forma) <span className="text-destructive">*</span>
        </Label>
        <Input
          id="rx-dose"
          value={medDose}
          onChange={(e) => setMedDose(e.target.value)}
          placeholder="Ex.: comprimido, jatos"
          autoComplete="off"
          disabled={disabled}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="rx-freq">
          Frequência <span className="text-destructive">*</span>
        </Label>
        <Input
          id="rx-freq"
          value={medFreq}
          onChange={(e) => setMedFreq(e.target.value)}
          placeholder="Ex.: 12/12 horas"
          autoComplete="off"
          disabled={disabled}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="rx-route">
          Via <span className="text-destructive">*</span>
        </Label>
        <SearchableSelect
          id="rx-route"
          options={routeOptions}
          value={medRoute}
          onChange={setMedRoute}
          placeholder="Via de administração"
          disabled={disabled}
          allowCustomValue={!isCatalogSelection}
        />
      </div>
      <div className="space-y-1 sm:col-span-2">
        <Label htmlFor="rx-duration">
          Duração <span className="text-destructive">*</span>
        </Label>
        <div className="flex flex-wrap gap-2 items-center">
          <Input
            id="rx-duration"
            value={durationText}
            onChange={(e) => setDurationText(e.target.value)}
            placeholder="Ex.: 7 dias"
            autoComplete="off"
            disabled={disabled || durationContinuous}
            className="flex-1 min-w-[140px]"
          />
          <Button
            type="button"
            size="sm"
            variant={durationContinuous ? 'secondary' : 'outline'}
            disabled={disabled}
            onClick={() => {
              setDurationContinuous((prev) => {
                if (!prev) setDurationText('');
                return !prev;
              });
            }}
          >
            Contínua
          </Button>
        </div>
      </div>
      <div className="space-y-1 sm:col-span-2">
        <Label htmlFor="rx-observation">Observação (opcional)</Label>
        <Input
          id="rx-observation"
          value={medObservation}
          onChange={(e) => setMedObservation(e.target.value)}
          placeholder="Ex.: tomar com alimentos"
          autoComplete="off"
          disabled={disabled}
        />
      </div>
      <div className="sm:col-span-2 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={pending || disabled || !canSubmit}
          onClick={handleSubmit}
        >
          {submitLabel}
        </Button>
        {onCancel && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={pending || disabled}
            onClick={handleCancel}
          >
            Cancelar
          </Button>
        )}
      </div>
    </div>
  );
}
