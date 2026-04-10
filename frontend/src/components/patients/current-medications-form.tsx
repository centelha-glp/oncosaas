'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, AlertTriangle } from 'lucide-react';
import {
  MEDICATION_CATALOG,
  MEDICATION_SELECT_OPTIONS,
  getMedicationCatalogEntry,
} from '@/lib/clinical-catalogs/medication-catalog';
import type { MedicationCategory } from '@/lib/api/patients';

const CATEGORY_LABELS: Partial<Record<MedicationCategory, string>> = {
  ANTICOAGULANT: 'Anticoagulante',
  ANTIPLATELET: 'Antiplaquetário',
  CORTICOSTEROID: 'Corticosteroide',
  IMMUNOSUPPRESSANT: 'Imunossupressor',
  NSAID: 'AINE',
  OPIOID_ANALGESIC: 'Opioide',
  NON_OPIOID_ANALGESIC: 'Analgésico não opioide',
  ANTIEMETIC: 'Antiemético',
  ANTIBIOTIC: 'Antibiótico',
  ANTIFUNGAL: 'Antifúngico',
  ANTIVIRAL: 'Antiviral',
  ANTIHYPERTENSIVE: 'Anti-hipertensivo',
  ANTIDIABETIC: 'Antidiabético',
  BISPHOSPHONATE: 'Bisfosfonato',
  GROWTH_FACTOR: 'Fator de crescimento',
  PROTON_PUMP_INHIBITOR: 'IBP',
  LAXATIVE: 'Laxante',
  OTHER: 'Outro',
};

const RISK_CATEGORIES: MedicationCategory[] = [
  'ANTICOAGULANT',
  'ANTIPLATELET',
  'CORTICOSTEROID',
  'IMMUNOSUPPRESSANT',
  'NSAID',
  'OPIOID_ANALGESIC',
];

export type CurrentMedicationFormRow = {
  catalogKey?: string;
  name?: string;
  dosage?: string;
  frequency?: string;
  indication?: string;
};

interface CurrentMedicationsFormProps {
  value?: CurrentMedicationFormRow[];
  onChange: (medications: CurrentMedicationFormRow[]) => void;
}

export function CurrentMedicationsForm({
  value = [],
  onChange,
}: CurrentMedicationsFormProps) {
  const medications = Array.isArray(value) ? value : [];

  const addMedication = () => {
    onChange([
      ...medications,
      { catalogKey: '', name: '', dosage: '', frequency: '', indication: '' },
    ]);
  };

  const update = (
    index: number,
    field: keyof CurrentMedicationFormRow,
    val: string
  ) => {
    const updated = [...medications];
    const row = { ...updated[index], [field]: val };
    if (field === 'catalogKey') {
      const entry = getMedicationCatalogEntry(val);
      if (val && val !== 'OTHER' && entry) {
        row.name = entry.label;
      }
      if (val === 'OTHER') {
        row.name = '';
      }
    }
    updated[index] = row;
    onChange(updated);
  };

  const remove = (index: number) => {
    onChange(medications.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Medicamentos em uso</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addMedication}
        >
          <Plus className="h-4 w-4 mr-1" />
          Adicionar
        </Button>
      </div>

      {medications.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum medicamento adicionado. Clique em &quot;Adicionar&quot; para
          incluir.
        </p>
      ) : (
        <div className="space-y-3">
          {medications.map((med, index) => {
            const resolved = med.catalogKey
              ? getMedicationCatalogEntry(med.catalogKey)
              : null;
            const category = resolved?.category;
            const isRisky =
              category != null && RISK_CATEGORIES.includes(category);

            return (
              <div
                key={index}
                className={`flex gap-2 items-start p-3 border rounded-lg ${
                  isRisky ? 'bg-amber-50 border-amber-200' : 'bg-gray-50'
                }`}
              >
                <div className="flex-1 space-y-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Medicamento (catálogo) *</Label>
                      <SearchableSelect
                        options={MEDICATION_SELECT_OPTIONS}
                        value={med.catalogKey ?? ''}
                        onChange={(v) => update(index, 'catalogKey', v)}
                        placeholder="Buscar medicamento…"
                        aria-label="Medicamento do catálogo"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Categoria clínica</Label>
                      <div className="flex items-center min-h-10">
                        {category ? (
                          <Badge variant="secondary">
                            {CATEGORY_LABELS[category] ?? category}
                          </Badge>
                        ) : med.catalogKey ? (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Escolha no catálogo ou nome livre abaixo
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {(!med.catalogKey || med.catalogKey === 'OTHER') && (
                    <div>
                      <Label className="text-xs">
                        Nome do medicamento
                        {med.catalogKey === 'OTHER' ? ' *' : ' (se não usar catálogo)'}
                      </Label>
                      <Input
                        placeholder="Ex: nome comercial ou princípio ativo"
                        value={med.name ?? ''}
                        onChange={(e) => update(index, 'name', e.target.value)}
                      />
                    </div>
                  )}

                  {med.catalogKey &&
                    med.catalogKey !== 'OTHER' &&
                    resolved && (
                      <p className="text-xs text-muted-foreground">
                        Nome registrado:{' '}
                        <strong>{MEDICATION_CATALOG[med.catalogKey]?.label}</strong>{' '}
                        (definido pelo catálogo no salvamento)
                      </p>
                    )}

                  {isRisky && (
                    <div className="flex items-center gap-1 text-amber-700 text-xs">
                      <AlertTriangle className="h-3 w-3" />
                      <span>Risco clínico relevante para o algoritmo</span>
                      <Badge
                        variant="outline"
                        className="text-xs ml-1 border-amber-400 text-amber-700"
                      >
                        Categoria de risco
                      </Badge>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs">Dose</Label>
                      <Input
                        placeholder="Ex: 50 mg"
                        value={med.dosage ?? ''}
                        onChange={(e) =>
                          update(index, 'dosage', e.target.value)
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Frequência</Label>
                      <Input
                        placeholder="Ex: 1x/dia, 12/12h"
                        value={med.frequency ?? ''}
                        onChange={(e) =>
                          update(index, 'frequency', e.target.value)
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Indicação</Label>
                      <Input
                        placeholder="Ex: HAS, DM2, Dor"
                        value={med.indication ?? ''}
                        onChange={(e) =>
                          update(index, 'indication', e.target.value)
                        }
                      />
                    </div>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(index)}
                  className="mt-6"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
