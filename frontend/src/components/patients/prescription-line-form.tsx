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
  type MedicationCatalogDrug,
  type MedicationCatalogPresentation,
} from '@/lib/api/medication-catalog';
import { useDebounce } from '@/lib/utils/use-debounce';
import type { PrescriptionDraftFromHistory } from '@/lib/utils/clinical-orders-payload';

export type PrescriptionLineFormValues = {
  medicationName: string;
  catalogKey?: string;
  presentationCatalogCode?: string;
  dosage?: string;
  frequency?: string;
  route?: string;
  duration?: string;
  indication?: string;
};

type Props = {
  disabled?: boolean;
  pending?: boolean;
  draft?: PrescriptionDraftFromHistory | null;
  onDraftConsumed?: () => void;
  onSubmit: (values: PrescriptionLineFormValues) => void;
};

export function PrescriptionLineForm({
  disabled,
  pending,
  draft,
  onDraftConsumed,
  onSubmit,
}: Props) {
  const [freeText, setFreeText] = useState(false);
  const [drugQuery, setDrugQuery] = useState('');
  const debouncedDrugQ = useDebounce(drugQuery, 300);
  const [selectedDrug, setSelectedDrug] = useState<MedicationCatalogDrug | null>(null);
  const [presentationCode, setPresentationCode] = useState('');
  const [medName, setMedName] = useState('');
  const [medDose, setMedDose] = useState('');
  const [medFreq, setMedFreq] = useState('');
  const [medRoute, setMedRoute] = useState('');
  const [medDuration, setMedDuration] = useState('');
  const [medIndication, setMedIndication] = useState('');

  useEffect(() => {
    if (!draft) return;
    setMedName(draft.medicationName);
    setMedDose(draft.dosage ?? '');
    setMedFreq(draft.frequency ?? '');
    setMedRoute(draft.route ?? '');
    setMedDuration(draft.duration ?? '');
    setMedIndication(draft.indication ?? '');
    setPresentationCode(draft.presentationCatalogCode ?? '');
    if (draft.catalogKey) {
      setFreeText(false);
      setDrugQuery(draft.medicationName);
      setSelectedDrug(null);
      const catalogKey = draft.catalogKey;
      void medicationCatalogApi
        .search({ q: catalogKey, limit: 20, offset: 0 })
        .then((res) => {
          const drug =
            res.items.find((d) => d.code === catalogKey) ?? res.items[0] ?? null;
          if (drug) {
            setSelectedDrug(drug);
            setDrugQuery(drug.displayName);
          }
        })
        .catch(() => {
          /* catálogo indisponível: usuário pode reselecionar manualmente */
        });
    } else {
      setFreeText(true);
      setSelectedDrug(null);
    }
    onDraftConsumed?.();
  }, [draft, onDraftConsumed]);

  const { data: drugSearch } = useQuery({
    queryKey: ['medication-catalog', debouncedDrugQ],
    queryFn: () =>
      medicationCatalogApi.search({ q: debouncedDrugQ || undefined, limit: 80, offset: 0 }),
    enabled: !freeText,
    staleTime: 60_000,
  });

  const { data: presentations } = useQuery({
    queryKey: ['medication-catalog', selectedDrug?.code, 'presentations'],
    queryFn: () => medicationCatalogApi.listPresentations(selectedDrug!.code, { limit: 50 }),
    enabled: Boolean(selectedDrug?.code) && !freeText,
    staleTime: 60_000,
  });

  const { data: routesData } = useQuery({
    queryKey: ['medication-catalog', 'routes'],
    queryFn: () => medicationCatalogApi.listRoutes(),
    staleTime: 10 * 60_000,
  });

  const selectedDrugMatchesQuery =
    selectedDrug !== null &&
    drugQuery.trim() === selectedDrug.displayName.trim();

  const drugComboboxOptions = useMemo(
    () =>
      (drugSearch?.items ?? []).map((d) => ({
        id: d.code,
        label: d.displayName,
        subtitle: d.genericName !== d.displayName ? d.genericName : undefined,
        data: d,
      })),
    [drugSearch]
  );

  const presentationOptions = useMemo(
    () =>
      (presentations?.items ?? []).map((p: MedicationCatalogPresentation) => ({
        value: p.code,
        label: p.strength ? `${p.label} — ${p.strength}` : p.label,
      })),
    [presentations]
  );

  const routeOptions = useMemo(() => {
    const all = routesData?.routes ?? [];
    const allowed = selectedDrug?.allowedRoutes ?? [];
    const filtered = allowed.length > 0 ? all.filter((r) => allowed.includes(r.code)) : all;
    return filtered.map((r) => ({ value: r.code, label: r.label }));
  }, [routesData, selectedDrug]);

  const handleAdd = () => {
    if (freeText) {
      if (!medName.trim()) return;
      onSubmit({
        medicationName: medName.trim(),
        dosage: medDose.trim() || undefined,
        frequency: medFreq.trim() || undefined,
        route: medRoute.trim() || undefined,
        duration: medDuration.trim() || undefined,
        indication: medIndication.trim() || undefined,
      });
    } else {
      if (!selectedDrug || !selectedDrugMatchesQuery) return;
      onSubmit({
        medicationName: medName.trim() || selectedDrug.displayName,
        catalogKey: selectedDrug.code,
        presentationCatalogCode: presentationCode || undefined,
        dosage: medDose.trim() || undefined,
        frequency: medFreq.trim() || undefined,
        route: medRoute.trim() || undefined,
        duration: medDuration.trim() || undefined,
        indication: medIndication.trim() || undefined,
      });
    }
    setMedName('');
    setMedDose('');
    setMedFreq('');
    setMedRoute('');
    setMedDuration('');
    setMedIndication('');
    setPresentationCode('');
    setSelectedDrug(null);
    setDrugQuery('');
  };

  const canSubmit = freeText ? Boolean(medName.trim()) : selectedDrugMatchesQuery;

  const handleDrugQueryChange = (value: string) => {
    setDrugQuery(value);
    if (selectedDrug && value.trim() !== selectedDrug.displayName.trim()) {
      setSelectedDrug(null);
      setPresentationCode('');
      setMedRoute('');
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
      <div className="sm:col-span-2 flex flex-wrap gap-2 items-center">
        <Button type="button" size="sm" variant={freeText ? 'secondary' : 'outline'} disabled={disabled} onClick={() => setFreeText(false)}>Catálogo</Button>
        <Button type="button" size="sm" variant={freeText ? 'outline' : 'secondary'} disabled={disabled} onClick={() => { setFreeText(true); setSelectedDrug(null); setPresentationCode(''); }}>Outro (texto livre)</Button>
      </div>
      {!freeText ? (
        <>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="rx-drug-search">Medicamento</Label>
            <ExamCatalogCombobox
              options={drugComboboxOptions}
              value={drugQuery}
              onValueChange={handleDrugQueryChange}
              onSelectOption={(opt) => {
                const drug = opt.data;
                setSelectedDrug(drug);
                setDrugQuery(drug.displayName);
                setMedName(drug.displayName);
                setPresentationCode('');
              }}
              placeholder="Pesquisar medicamento..."
              emptyText="Nenhum medicamento no catálogo. Use «Outro»."
              disabled={disabled}
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="rx-presentation">Apresentação</Label>
            <SearchableSelect
              id="rx-presentation"
              options={presentationOptions}
              value={presentationCode}
              onChange={setPresentationCode}
              placeholder={
                selectedDrug
                  ? 'Selecione a apresentação'
                  : 'Escolha o medicamento primeiro'
              }
              disabled={disabled || !selectedDrug}
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="rx-route-catalog">Via</Label>
            <SearchableSelect
              id="rx-route-catalog"
              options={routeOptions}
              value={medRoute}
              onChange={setMedRoute}
              placeholder="Via de administração"
              disabled={disabled || !selectedDrug}
            />
          </div>
        </>
      ) : (
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="rx-med-name">Medicamento</Label>
          <Input
            id="rx-med-name"
            value={medName}
            onChange={(e) => setMedName(e.target.value)}
            placeholder="Nome ou apresentação"
            autoComplete="off"
            disabled={disabled}
          />
        </div>
      )}
      <div className="space-y-1">
        <Label htmlFor="rx-dose">Dose</Label>
        <Input
          id="rx-dose"
          value={medDose}
          onChange={(e) => setMedDose(e.target.value)}
          placeholder="Ex.: 1 comprimido"
          autoComplete="off"
          disabled={disabled}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="rx-freq">Frequência</Label>
        <Input
          id="rx-freq"
          value={medFreq}
          onChange={(e) => setMedFreq(e.target.value)}
          placeholder="Ex.: 12/12 h"
          autoComplete="off"
          disabled={disabled}
        />
      </div>
      {freeText && (
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="rx-route-free">Via</Label>
          <Input
            id="rx-route-free"
            value={medRoute}
            onChange={(e) => setMedRoute(e.target.value)}
            placeholder="Ex.: VO, IV"
            autoComplete="off"
            disabled={disabled}
          />
        </div>
      )}
      <div className="space-y-1 sm:col-span-2">
        <Label htmlFor="rx-duration">Duração (opcional)</Label>
        <Input
          id="rx-duration"
          value={medDuration}
          onChange={(e) => setMedDuration(e.target.value)}
          placeholder="Ex.: 7 dias"
          autoComplete="off"
          disabled={disabled}
        />
      </div>
      <div className="space-y-1 sm:col-span-2">
        <Label htmlFor="rx-indication">Indicação (opcional)</Label>
        <Input
          id="rx-indication"
          value={medIndication}
          onChange={(e) => setMedIndication(e.target.value)}
          placeholder="Ex.: náusea, dor"
          autoComplete="off"
          disabled={disabled}
        />
      </div>
      <div className="sm:col-span-2">
        <Button
          type="button"
          size="sm"
          disabled={pending || disabled || !canSubmit}
          onClick={handleAdd}
        >
          Adicionar à prescrição
        </Button>
      </div>
    </div>
  );
}
