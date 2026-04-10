'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2 } from 'lucide-react';
import type {
  PriorHospitalizationItem,
  PriorSurgeryItem,
} from '@/lib/api/patients';

interface PriorClinicalHistoryFormProps {
  priorSurgeries?: PriorSurgeryItem[];
  priorHospitalizations?: PriorHospitalizationItem[];
  onChangeSurgeries: (items: PriorSurgeryItem[]) => void;
  onChangeHospitalizations: (items: PriorHospitalizationItem[]) => void;
}

export function PriorClinicalHistoryForm({
  priorSurgeries = [],
  priorHospitalizations = [],
  onChangeSurgeries,
  onChangeHospitalizations,
}: PriorClinicalHistoryFormProps) {
  const surgeries = Array.isArray(priorSurgeries) ? priorSurgeries : [];
  const hospitalizations = Array.isArray(priorHospitalizations)
    ? priorHospitalizations
    : [];

  const addSurgery = () => {
    onChangeSurgeries([
      ...surgeries,
      { procedureName: '', year: undefined, institution: '', notes: '' },
    ]);
  };

  const updateSurgery = (
    index: number,
    field: keyof PriorSurgeryItem,
    value: PriorSurgeryItem[typeof field]
  ) => {
    const next = [...surgeries];
    next[index] = { ...next[index], [field]: value };
    onChangeSurgeries(next);
  };

  const removeSurgery = (index: number) => {
    onChangeSurgeries(surgeries.filter((_, i) => i !== index));
  };

  const addHospitalization = () => {
    onChangeHospitalizations([
      ...hospitalizations,
      { summary: '', year: undefined, durationDays: undefined, notes: '' },
    ]);
  };

  const updateHospitalization = (
    index: number,
    field: keyof PriorHospitalizationItem,
    value: PriorHospitalizationItem[typeof field]
  ) => {
    const next = [...hospitalizations];
    next[index] = { ...next[index], [field]: value };
    onChangeHospitalizations(next);
  };

  const removeHospitalization = (index: number) => {
    onChangeHospitalizations(hospitalizations.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6 border-t pt-4 mt-2">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Cirurgias prévias (HPP)</Label>
          <Button type="button" variant="outline" size="sm" onClick={addSurgery}>
            <Plus className="h-4 w-4 mr-1" />
            Adicionar
          </Button>
        </div>
        {surgeries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma cirurgia registrada. Use &quot;Adicionar&quot; se aplicável.
          </p>
        ) : (
          <div className="space-y-3">
            {surgeries.map((row, index) => (
              <div
                key={index}
                className="flex gap-2 items-start p-3 border rounded-lg bg-gray-50"
              >
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div className="md:col-span-2">
                    <Label className="text-xs">Procedimento</Label>
                    <Input
                      placeholder="Ex: cistectomia radical, colectomia"
                      value={row.procedureName}
                      onChange={(e) =>
                        updateSurgery(index, 'procedureName', e.target.value)
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Ano (opcional)</Label>
                    <Input
                      type="number"
                      min={1900}
                      max={2100}
                      placeholder="Ex: 2020"
                      value={row.year ?? ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        updateSurgery(
                          index,
                          'year',
                          v === '' ? undefined : parseInt(v, 10)
                        );
                      }}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Instituição (opcional)</Label>
                    <Input
                      placeholder="Hospital / serviço"
                      value={row.institution ?? ''}
                      onChange={(e) =>
                        updateSurgery(index, 'institution', e.target.value)
                      }
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-xs">Observações</Label>
                    <Input
                      placeholder="Detalhes relevantes"
                      value={row.notes ?? ''}
                      onChange={(e) =>
                        updateSurgery(index, 'notes', e.target.value)
                      }
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={() => removeSurgery(index)}
                  aria-label="Remover cirurgia"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Internações prévias (HPP)</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addHospitalization}
          >
            <Plus className="h-4 w-4 mr-1" />
            Adicionar
          </Button>
        </div>
        {hospitalizations.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma internação registrada. Use &quot;Adicionar&quot; se aplicável.
          </p>
        ) : (
          <div className="space-y-3">
            {hospitalizations.map((row, index) => (
              <div
                key={index}
                className="flex gap-2 items-start p-3 border rounded-lg bg-gray-50"
              >
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div className="md:col-span-2">
                    <Label className="text-xs">Resumo / motivo</Label>
                    <Input
                      placeholder="Ex: ITU complicada, sepse, descompensação"
                      value={row.summary}
                      onChange={(e) =>
                        updateHospitalization(index, 'summary', e.target.value)
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Ano (opcional)</Label>
                    <Input
                      type="number"
                      min={1900}
                      max={2100}
                      value={row.year ?? ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        updateHospitalization(
                          index,
                          'year',
                          v === '' ? undefined : parseInt(v, 10)
                        );
                      }}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Duração (dias, opcional)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={3650}
                      value={row.durationDays ?? ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        updateHospitalization(
                          index,
                          'durationDays',
                          v === '' ? undefined : parseInt(v, 10)
                        );
                      }}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-xs">Observações</Label>
                    <Input
                      placeholder="UTI, complicações, etc."
                      value={row.notes ?? ''}
                      onChange={(e) =>
                        updateHospitalization(index, 'notes', e.target.value)
                      }
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={() => removeHospitalization(index)}
                  aria-label="Remover internação"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
