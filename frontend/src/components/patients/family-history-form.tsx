'use client';

import { patientEditFieldId } from '@/lib/utils/patient-form-anchors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2 } from 'lucide-react';
import { FamilyHistory } from '@/lib/api/patients';

interface FamilyHistoryFormProps {
  value?: FamilyHistory[];
  onChange: (familyHistory: FamilyHistory[]) => void;
}

export function FamilyHistoryForm({
  value = [],
  onChange,
}: FamilyHistoryFormProps) {
  const familyHistory = Array.isArray(value) ? value : [];

  const addFamilyMember = () => {
    onChange([...familyHistory, { relationship: '', cancerType: '' }]);
  };

  const updateFamilyMember = (
    index: number,
    field: keyof FamilyHistory,
    fieldValue: FamilyHistory[typeof field]
  ) => {
    const updated = [...familyHistory];
    updated[index] = { ...updated[index], [field]: fieldValue };
    onChange(updated);
  };

  const removeFamilyMember = (index: number) => {
    onChange(familyHistory.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>História Familiar de Câncer</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addFamilyMember}
        >
          <Plus className="h-4 w-4 mr-1" />
          Adicionar
        </Button>
      </div>

      {familyHistory.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {`Nenhum histórico familiar adicionado. Clique em "Adicionar" para incluir.`}
        </p>
      ) : (
        <div className="space-y-3">
          {familyHistory.map((member, index) => (
            <div
              key={index}
              id={patientEditFieldId(`familyHistory.${index}`)}
              className="flex gap-2 items-start p-3 border rounded-lg bg-gray-50"
            >
              <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">Parentesco</Label>
                  <Input
                    placeholder="Ex: mãe, pai, irmão, avó"
                    value={member.relationship}
                    onChange={(e) =>
                      updateFamilyMember(index, 'relationship', e.target.value)
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">Tipo de Câncer</Label>
                  <Input
                    placeholder="Ex: Câncer de Mama, Câncer de Pulmão"
                    value={member.cancerType}
                    onChange={(e) =>
                      updateFamilyMember(index, 'cancerType', e.target.value)
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">Idade no Diagnóstico (anos)</Label>
                  <Input
                    type="number"
                    placeholder="Opcional"
                    value={member.ageAtDiagnosis || ''}
                    onChange={(e) =>
                      updateFamilyMember(
                        index,
                        'ageAtDiagnosis',
                        e.target.value ? parseInt(e.target.value) : undefined
                      )
                    }
                  />
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeFamilyMember(index)}
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
