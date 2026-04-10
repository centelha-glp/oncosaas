'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, AlertTriangle } from 'lucide-react';
import {
  type ComorbidityType,
  type ComorbiditySeverity,
} from '@/lib/api/patients';

/** Linha em edição — tipo/gravidade opcionais até o usuário escolher. */
export type ComorbidityFormRow = {
  name?: string;
  type?: ComorbidityType;
  severity?: ComorbiditySeverity;
  controlled?: boolean;
};

const TYPE_OPTIONS: {
  value: ComorbidityType;
  label: string;
  riskFlags?: string[];
}[] = [
  {
    value: 'DIABETES_TYPE_1',
    label: 'Diabetes Mellitus tipo 1',
    riskFlags: ['Sepse'],
  },
  {
    value: 'DIABETES_TYPE_2',
    label: 'Diabetes Mellitus tipo 2',
    riskFlags: ['Sepse'],
  },
  { value: 'HYPERTENSION', label: 'Hipertensão Arterial', riskFlags: [] },
  {
    value: 'HEART_FAILURE',
    label: 'Insuficiência Cardíaca',
    riskFlags: ['Sepse', 'Reserva pulmonar'],
  },
  {
    value: 'CORONARY_ARTERY_DISEASE',
    label: 'Doença Arterial Coronariana',
    riskFlags: [],
  },
  {
    value: 'ATRIAL_FIBRILLATION',
    label: 'Fibrilação Atrial',
    riskFlags: ['Trombose'],
  },
  { value: 'COPD', label: 'DPOC', riskFlags: ['Reserva pulmonar'] },
  { value: 'ASTHMA', label: 'Asma', riskFlags: ['Reserva pulmonar'] },
  {
    value: 'CHRONIC_KIDNEY_DISEASE',
    label: 'Doença Renal Crônica',
    riskFlags: ['Sepse', 'Clearance renal'],
  },
  { value: 'LIVER_CIRRHOSIS', label: 'Cirrose Hepática', riskFlags: ['Sepse'] },
  { value: 'HIV_AIDS', label: 'HIV/AIDS', riskFlags: ['Sepse'] },
  {
    value: 'AUTOIMMUNE_DISEASE',
    label: 'Doença Autoimune',
    riskFlags: ['Sepse'],
  },
  { value: 'STROKE_HISTORY', label: 'AVC prévio', riskFlags: [] },
  {
    value: 'DEEP_VEIN_THROMBOSIS',
    label: 'TVP prévia',
    riskFlags: ['Trombose'],
  },
  { value: 'PULMONARY_EMBOLISM', label: 'TEP prévio', riskFlags: ['Trombose'] },
  {
    value: 'PERIPHERAL_NEUROPATHY',
    label: 'Neuropatia Periférica',
    riskFlags: [],
  },
  { value: 'OBESITY', label: 'Obesidade', riskFlags: [] },
  { value: 'DEPRESSION', label: 'Depressão', riskFlags: [] },
  {
    value: 'ANXIETY_DISORDER',
    label: 'Transtorno de Ansiedade',
    riskFlags: [],
  },
  { value: 'OTHER', label: 'Outra', riskFlags: [] },
];

const SEVERITY_OPTIONS: { value: ComorbiditySeverity; label: string }[] = [
  { value: 'MILD', label: 'Leve' },
  { value: 'MODERATE', label: 'Moderada' },
  { value: 'SEVERE', label: 'Grave' },
];

const HIGH_RISK_TYPES: ComorbidityType[] = [
  'DIABETES_TYPE_1',
  'DIABETES_TYPE_2',
  'HEART_FAILURE',
  'CHRONIC_KIDNEY_DISEASE',
  'LIVER_CIRRHOSIS',
  'HIV_AIDS',
  'AUTOIMMUNE_DISEASE',
  'ATRIAL_FIBRILLATION',
  'DEEP_VEIN_THROMBOSIS',
  'PULMONARY_EMBOLISM',
  'COPD',
];

interface ComorbiditiesFormProps {
  value?: ComorbidityFormRow[];
  onChange: (comorbidities: ComorbidityFormRow[]) => void;
}

export function ComorbiditiesForm({
  value = [],
  onChange,
}: ComorbiditiesFormProps) {
  const comorbidities = Array.isArray(value) ? value : [];

  const add = () => {
    const updated = [
      ...comorbidities,
      {
        name: '',
        controlled: false,
      },
    ];
    onChange(updated);
  };

  const update = (
    index: number,
    field: keyof ComorbidityFormRow,
    val: unknown
  ) => {
    const updated = [...comorbidities];
    updated[index] = { ...updated[index], [field]: val };
    // Auto-fill name when type is selected and name is still empty
    if (field === 'type' && !updated[index].name) {
      const opt = TYPE_OPTIONS.find((o) => o.value === val);
      if (opt) updated[index].name = opt.label;
    }
    onChange(updated);
  };

  const remove = (index: number) => {
    onChange(comorbidities.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Comorbidades</Label>
        <Button type="button" variant="outline" size="sm" onClick={add}>
          <Plus className="h-4 w-4 mr-1" />
          Adicionar
        </Button>
      </div>

      {comorbidities.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma comorbidade adicionada. Clique em &quot;Adicionar&quot; para
          incluir.
        </p>
      ) : (
        <div className="space-y-3">
          {comorbidities.map((c, index) => {
            const isHighRisk =
              c.type != null &&
              HIGH_RISK_TYPES.includes(c.type as ComorbidityType);
            const typeInfo = TYPE_OPTIONS.find((o) => o.value === c.type);

            return (
              <div
                key={index}
                className={`flex gap-2 items-start p-3 border rounded-lg ${
                  isHighRisk ? 'bg-red-50 border-red-200' : 'bg-gray-50'
                }`}
              >
                <div className="flex-1 space-y-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Tipo *</Label>
                      <SearchableSelect
                        options={TYPE_OPTIONS.map((o) => ({
                          value: o.value,
                          label: o.label,
                        }))}
                        value={c.type ?? ''}
                        onChange={(v) => update(index, 'type', v)}
                        placeholder="Selecione o tipo de comorbidade…"
                        aria-label="Tipo de comorbidade"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Nome / detalhe</Label>
                      <Input
                        placeholder="Ex: DM2 descompensada, IRC grau 3"
                        value={c.name}
                        onChange={(e) => update(index, 'name', e.target.value)}
                      />
                    </div>
                  </div>

                  {isHighRisk &&
                    typeInfo?.riskFlags &&
                    typeInfo.riskFlags.length > 0 && (
                      <div className="flex items-center gap-1 text-red-700 text-xs flex-wrap">
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                        <span>Risco aumentado:</span>
                        {typeInfo.riskFlags.map((flag) => (
                          <Badge
                            key={flag}
                            variant="outline"
                            className="text-xs border-red-400 text-red-700"
                          >
                            {flag}
                          </Badge>
                        ))}
                      </div>
                    )}

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 items-end">
                    <div>
                      <Label className="text-xs">Gravidade</Label>
                      <SearchableSelect
                        options={SEVERITY_OPTIONS.map((o) => ({
                          value: o.value,
                          label: o.label,
                        }))}
                        value={c.severity ?? ''}
                        onChange={(v) => update(index, 'severity', v)}
                        placeholder="Selecione a gravidade…"
                        aria-label="Gravidade da comorbidade"
                      />
                    </div>
                    <div className="flex items-center gap-2 pb-1">
                      <input
                        type="checkbox"
                        id={`controlled-${index}`}
                        checked={c.controlled ?? false}
                        onChange={(e) =>
                          update(index, 'controlled', e.target.checked)
                        }
                        className="h-4 w-4"
                      />
                      <Label
                        htmlFor={`controlled-${index}`}
                        className="text-xs cursor-pointer"
                      >
                        Controlada
                      </Label>
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
