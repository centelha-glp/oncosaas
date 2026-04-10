'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2 } from 'lucide-react';
import {
  ALLERGY_SUBSTANCE_CATALOG,
  ALLERGY_SUBSTANCE_SELECT_OPTIONS,
} from '@/lib/clinical-catalogs/allergy-substance.catalog';

export type SmokingStatus = 'never' | 'former' | 'current' | 'unknown';

export interface SmokingProfileForm {
  status?: SmokingStatus;
  packYears?: number;
  yearsQuit?: number;
  notes?: string;
}

export type AlcoholStatus =
  | 'never'
  | 'occasional'
  | 'moderate'
  | 'heavy'
  | 'unknown';

export interface AlcoholProfileForm {
  status?: AlcoholStatus;
  drinksPerWeek?: number;
  notes?: string;
}

export interface OccupationalExposureEntryForm {
  agent?: string;
  yearsApprox?: number;
  notes?: string;
}

export interface AllergyEntryForm {
  substanceKey?: string;
  customLabel?: string;
  reactionNotes?: string;
}

interface StructuredClinicalRisksFormProps {
  smokingProfile?: SmokingProfileForm | null;
  alcoholProfile?: AlcoholProfileForm | null;
  occupationalExposureEntries?: OccupationalExposureEntryForm[] | null;
  allergyEntries?: AllergyEntryForm[] | null;
  /** Texto livre complementar (legado / observações gerais). */
  allergyNotes?: string | null;
  onSmokingProfileChange: (v: SmokingProfileForm | undefined) => void;
  onAlcoholProfileChange: (v: AlcoholProfileForm | undefined) => void;
  onOccupationalEntriesChange: (v: OccupationalExposureEntryForm[]) => void;
  onAllergyEntriesChange: (v: AllergyEntryForm[]) => void;
  onAllergyNotesChange: (v: string) => void;
}

export function StructuredClinicalRisksForm({
  smokingProfile,
  alcoholProfile,
  occupationalExposureEntries,
  allergyEntries,
  allergyNotes,
  onSmokingProfileChange,
  onAlcoholProfileChange,
  onOccupationalEntriesChange,
  onAllergyEntriesChange,
  onAllergyNotesChange,
}: StructuredClinicalRisksFormProps) {
  const smoking = smokingProfile ?? {};
  const alcohol = alcoholProfile ?? {};
  const occEntries = occupationalExposureEntries ?? [];
  const allergies = allergyEntries ?? [];
  const allergyNotesSafe = allergyNotes ?? '';

  const patchSmoking = (partial: Partial<SmokingProfileForm>) => {
    onSmokingProfileChange({ ...smoking, ...partial });
  };

  const patchAlcohol = (partial: Partial<AlcoholProfileForm>) => {
    onAlcoholProfileChange({ ...alcohol, ...partial });
  };

  const addOcc = () => {
    onOccupationalEntriesChange([
      ...occEntries,
      { agent: '', yearsApprox: undefined, notes: '' },
    ]);
  };

  const updateOcc = (
    index: number,
    field: keyof OccupationalExposureEntryForm,
    val: unknown
  ) => {
    const next = [...occEntries];
    next[index] = { ...next[index], [field]: val };
    onOccupationalEntriesChange(next);
  };

  const removeOcc = (index: number) => {
    onOccupationalEntriesChange(
      occEntries.filter((_, i) => i !== index)
    );
  };

  const addAllergy = () => {
    onAllergyEntriesChange([
      ...allergies,
      { substanceKey: '', customLabel: '', reactionNotes: '' },
    ]);
  };

  const updateAllergy = (
    index: number,
    field: keyof AllergyEntryForm,
    val: string
  ) => {
    const next = [...allergies];
    next[index] = { ...next[index], [field]: val };
    if (field === 'substanceKey' && val !== 'OTHER') {
      next[index].customLabel = '';
    }
    onAllergyEntriesChange(next);
  };

  const removeAllergy = (index: number) => {
    onAllergyEntriesChange(allergies.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6 border rounded-lg p-4 bg-muted/30">
      <div>
        <h4 className="text-sm font-semibold mb-2">Tabagismo</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Situação</Label>
            <Select
              value={smoking.status ?? ''}
              onValueChange={(v) =>
                patchSmoking({
                  status: v ? (v as SmokingStatus) : undefined,
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="never">Nunca fumou</SelectItem>
                <SelectItem value="former">Ex-fumante</SelectItem>
                <SelectItem value="current">Fumante atual</SelectItem>
                <SelectItem value="unknown">Não informado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Carga tabágica (anos-maço)</Label>
            <Input
              type="number"
              min={0}
              step={0.1}
              placeholder="Opcional"
              value={
                smoking.packYears === undefined
                  ? ''
                  : String(smoking.packYears)
              }
              onChange={(e) => {
                const raw = e.target.value;
                patchSmoking({
                  packYears: raw === '' ? undefined : Number(raw),
                });
              }}
            />
          </div>
          <div>
            <Label className="text-xs">Tempo sem fumar (anos)</Label>
            <Input
              type="number"
              min={0}
              placeholder="Se ex-fumante"
              value={
                smoking.yearsQuit === undefined
                  ? ''
                  : String(smoking.yearsQuit)
              }
              onChange={(e) => {
                const raw = e.target.value;
                patchSmoking({
                  yearsQuit: raw === '' ? undefined : Number(raw),
                });
              }}
            />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">Notas</Label>
            <Input
              value={smoking.notes ?? ''}
              onChange={(e) => patchSmoking({ notes: e.target.value })}
              placeholder="Observações sobre tabagismo"
            />
          </div>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold mb-2">Álcool</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Padrão</Label>
            <Select
              value={alcohol.status ?? ''}
              onValueChange={(v) =>
                patchAlcohol({
                  status: v ? (v as AlcoholStatus) : undefined,
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="never">Nunca</SelectItem>
                <SelectItem value="occasional">Ocasional</SelectItem>
                <SelectItem value="moderate">Moderado</SelectItem>
                <SelectItem value="heavy">Pesado</SelectItem>
                <SelectItem value="unknown">Não informado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Doses por semana (aprox.)</Label>
            <Input
              type="number"
              min={0}
              placeholder="Opcional"
              value={
                alcohol.drinksPerWeek === undefined
                  ? ''
                  : String(alcohol.drinksPerWeek)
              }
              onChange={(e) => {
                const raw = e.target.value;
                patchAlcohol({
                  drinksPerWeek: raw === '' ? undefined : Number(raw),
                });
              }}
            />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">Notas</Label>
            <Input
              value={alcohol.notes ?? ''}
              onChange={(e) => patchAlcohol({ notes: e.target.value })}
              placeholder="Observações sobre etilismo"
            />
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold">Exposições ocupacionais</h4>
          <Button type="button" variant="outline" size="sm" onClick={addOcc}>
            <Plus className="h-4 w-4 mr-1" />
            Adicionar
          </Button>
        </div>
        {occEntries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma exposição registrada.
          </p>
        ) : (
          <div className="space-y-2">
            {occEntries.map((row, index) => (
              <div
                key={index}
                className="flex flex-wrap gap-2 items-end p-2 border rounded-md bg-background"
              >
                <div className="flex-1 min-w-[140px]">
                  <Label className="text-xs">Agente / contexto</Label>
                  <Input
                    value={row.agent ?? ''}
                    onChange={(e) =>
                      updateOcc(index, 'agent', e.target.value)
                    }
                    placeholder="Ex: amianto, benzeno"
                  />
                </div>
                <div className="w-28">
                  <Label className="text-xs">Anos (aprox.)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={
                      row.yearsApprox === undefined
                        ? ''
                        : String(row.yearsApprox)
                    }
                    onChange={(e) => {
                      const raw = e.target.value;
                      updateOcc(
                        index,
                        'yearsApprox',
                        raw === '' ? undefined : Number(raw)
                      );
                    }}
                  />
                </div>
                <div className="flex-1 min-w-[160px]">
                  <Label className="text-xs">Notas</Label>
                  <Input
                    value={row.notes ?? ''}
                    onChange={(e) =>
                      updateOcc(index, 'notes', e.target.value)
                    }
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeOcc(index)}
                  aria-label="Remover exposição"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold">Alergias (catálogo)</h4>
          <Button type="button" variant="outline" size="sm" onClick={addAllergy}>
            <Plus className="h-4 w-4 mr-1" />
            Adicionar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Selecione a substância; a categoria é atribuída automaticamente. Use
          &quot;Outra&quot; para especificar texto livre.
        </p>
        {allergies.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma alergia listada. Adicione ou informe apenas observações
            abaixo.
          </p>
        ) : (
          <div className="space-y-3">
            {allergies.map((row, index) => {
              const cat =
                row.substanceKey &&
                ALLERGY_SUBSTANCE_CATALOG[row.substanceKey]?.category;
              return (
                <div
                  key={index}
                  className="p-3 border rounded-lg space-y-2 bg-background"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Substância *</Label>
                      <SearchableSelect
                        options={ALLERGY_SUBSTANCE_SELECT_OPTIONS}
                        value={row.substanceKey}
                        onChange={(v) =>
                          updateAllergy(index, 'substanceKey', v)
                        }
                        placeholder="Buscar no catálogo…"
                        aria-label="Substância alergênica"
                      />
                    </div>
                    {cat && (
                      <div className="flex items-end">
                        <Badge variant="secondary" className="mb-1">
                          Categoria: {categoryLabelPt(cat)}
                        </Badge>
                      </div>
                    )}
                  </div>
                  {row.substanceKey === 'OTHER' && (
                    <div>
                      <Label className="text-xs">Especificar *</Label>
                      <Input
                        value={row.customLabel ?? ''}
                        onChange={(e) =>
                          updateAllergy(index, 'customLabel', e.target.value)
                        }
                        placeholder="Nome da substância ou reação"
                      />
                    </div>
                  )}
                  <div>
                    <Label className="text-xs">Reação / observações</Label>
                    <Input
                      value={row.reactionNotes ?? ''}
                      onChange={(e) =>
                        updateAllergy(index, 'reactionNotes', e.target.value)
                      }
                      placeholder="Ex: anafilaxia, exantema"
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeAllergy(index)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4">
          <Label className="text-xs">
            Observações adicionais sobre alergias (opcional)
          </Label>
          <Textarea
            value={allergyNotesSafe}
            onChange={(e) => onAllergyNotesChange(e.target.value)}
            placeholder="Notas gerais, intolerâncias ou detalhes não listados acima"
            rows={3}
            className="mt-1 resize-y min-h-[4rem]"
          />
        </div>
      </div>
    </div>
  );
}

function categoryLabelPt(c: string): string {
  const m: Record<string, string> = {
    MEDICATION: 'Medicamento',
    CONTRAST: 'Contraste',
    LATEX: 'Látex',
    FOOD_OR_ENVIRONMENT: 'Alimento/ambiente',
    OTHER: 'Outro',
  };
  return m[c] ?? c;
}
