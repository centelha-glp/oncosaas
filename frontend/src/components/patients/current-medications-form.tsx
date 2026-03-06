'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2 } from 'lucide-react';
import { CurrentMedication } from '@/lib/api/patients';

interface CurrentMedicationsFormProps {
  value?: CurrentMedication[];
  onChange: (medications: CurrentMedication[]) => void;
}

export function CurrentMedicationsForm({
  value = [],
  onChange,
}: CurrentMedicationsFormProps) {
  const [medications, setMedications] = useState<CurrentMedication[]>(
    value?.length ? value : []
  );

  useEffect(() => {
    setMedications(Array.isArray(value) ? value : []);
  }, [value]);

  const addMedication = () => {
    const newMedication: CurrentMedication = {
      name: '',
    };
    const updated = [...medications, newMedication];
    setMedications(updated);
    onChange(updated);
  };

  const updateMedication = (
    index: number,
    field: keyof CurrentMedication,
    fieldValue: string
  ) => {
    const updated = [...medications];
    updated[index] = { ...updated[index], [field]: fieldValue };
    setMedications(updated);
    onChange(updated);
  };

  const removeMedication = (index: number) => {
    const updated = medications.filter((_, i) => i !== index);
    setMedications(updated);
    onChange(updated);
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
          {medications.map((medication, index) => (
            <div
              key={index}
              className="flex gap-2 items-start p-3 border rounded-lg bg-gray-50"
            >
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                <div>
                  <Label className="text-xs">Medicamento</Label>
                  <Input
                    placeholder="Ex: Losartana, Metformina"
                    value={medication.name}
                    onChange={(e) =>
                      updateMedication(index, 'name', e.target.value)
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">Dose</Label>
                  <Input
                    placeholder="Ex: 50 mg"
                    value={medication.dosage ?? ''}
                    onChange={(e) =>
                      updateMedication(index, 'dosage', e.target.value)
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">Frequência</Label>
                  <Input
                    placeholder="Ex: 1x/dia, 12/12h"
                    value={medication.frequency ?? ''}
                    onChange={(e) =>
                      updateMedication(index, 'frequency', e.target.value)
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">Indicação</Label>
                  <Input
                    placeholder="Ex: HAS, DM2"
                    value={medication.indication ?? ''}
                    onChange={(e) =>
                      updateMedication(index, 'indication', e.target.value)
                    }
                  />
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeMedication(index)}
                className="mt-6"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
