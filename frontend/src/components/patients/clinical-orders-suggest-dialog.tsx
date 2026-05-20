'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type {
  ClinicalExamRequestSuggestion,
  ClinicalOrdersRejectionItem,
  ClinicalPrescriptionLineSuggestion,
  SuggestClinicalOrdersFromEvolutionResponse,
} from '@/lib/api/clinical-note-orders';
import type { ClinicalNoteType } from '@/lib/api/clinical-notes';
import { prescriptionLineBodyFromSuggestion } from '@/lib/utils/clinical-orders-payload';
import {
  isDuplicateExamSuggestion,
  isDuplicatePrescriptionSuggestion,
} from '@/lib/utils/clinical-orders-suggest-dedupe';
import { buildPrescriptionPosology } from '@/lib/utils/prescription-posology';

function examSourceLabel(source: ClinicalExamRequestSuggestion['request_source']): string {
  return source === 'contextual' ? 'Contextual' : 'Explícito';
}

function rxIntentLabel(
  intent: ClinicalPrescriptionLineSuggestion['prescription_intent']
): string {
  switch (intent) {
    case 'DOSE_CHANGE':
      return 'Ajuste de dose';
    case 'SUSPEND':
      return 'Suspender';
    case 'NEW':
    default:
      return 'Novo';
  }
}

function rxIntentVariant(
  intent: ClinicalPrescriptionLineSuggestion['prescription_intent']
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (intent === 'SUSPEND') return 'destructive';
  if (intent === 'DOSE_CHANGE') return 'secondary';
  return 'default';
}

const THERAPY_REVIEW_INDICATION_PREFIX = '[Revisão de terapia]';

function isTherapyReviewIndication(indication: string | null | undefined): boolean {
  return (indication ?? '').trim().startsWith(THERAPY_REVIEW_INDICATION_PREFIX);
}

function RejectionReport({ items }: { items: ClinicalOrdersRejectionItem[] }) {
  return (
    <details className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
      <summary className="cursor-pointer font-medium text-amber-950 dark:text-amber-100">
        {items.length} item(ns) descartado(s) na validação
      </summary>
      <ul className="mt-2 space-y-1 text-muted-foreground">
        {items.map((r, i) => (
          <li key={`${r.domain}-${i}`}>
            <span className="font-medium">{r.domain}:</span> {r.reason}
          </li>
        ))}
      </ul>
    </details>
  );
}

export function ClinicalOrdersSuggestDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  noteType: ClinicalNoteType;
  suggestion: SuggestClinicalOrdersFromEvolutionResponse | null;
  existingExamNames: string[];
  existingMedicationNames: string[];
  applying: boolean;
  onApply: (selected: {
    exams: ClinicalExamRequestSuggestion[];
    prescriptions: ClinicalPrescriptionLineSuggestion[];
  }) => void;
}) {
  const {
    open,
    onOpenChange,
    noteType,
    suggestion,
    existingExamNames,
    existingMedicationNames,
    applying,
    onApply,
  } = props;

  const existingExams = useMemo(
    () => existingExamNames.map((displayName) => ({ displayName })),
    [existingExamNames]
  );
  const existingRx = useMemo(
    () => existingMedicationNames.map((medicationName) => ({ medicationName })),
    [existingMedicationNames]
  );

  const examItems = useMemo(
    () => suggestion?.clinical_exam_requests ?? [],
    [suggestion]
  );
  const rxItems = useMemo(
    () => suggestion?.clinical_prescription_lines ?? [],
    [suggestion]
  );

  const showRxTab = noteType === 'MEDICAL';
  const showExamsTab =
    noteType === 'MEDICAL' ||
    (noteType === 'NURSING' && rxItems.length === 0);

  const [activeTab, setActiveTab] = useState<'exams' | 'prescription'>('exams');
  const [selectedExamKeys, setSelectedExamKeys] = useState<Set<string>>(
    () => new Set()
  );
  const [selectedRxKeys, setSelectedRxKeys] = useState<Set<string>>(
    () => new Set()
  );

  const examRows = useMemo(
    () =>
      examItems.map((item, index) => {
        const key = `exam-${index}-${item.display_name}`;
        const duplicate = isDuplicateExamSuggestion(item.display_name, existingExams);
        return { item, key, duplicate };
      }),
    [examItems, existingExams]
  );

  const rxRows = useMemo(
    () =>
      rxItems.map((item, index) => {
        const key = `rx-${index}-${item.medication_name}`;
        const duplicate = isDuplicatePrescriptionSuggestion(
          item.medication_name,
          existingRx
        );
        return { item, key, duplicate };
      }),
    [rxItems, existingRx]
  );

  useEffect(() => {
    if (!open || !suggestion) return;
    setActiveTab(showExamsTab ? 'exams' : 'prescription');
    setSelectedExamKeys(
      new Set(examRows.filter((r) => !r.duplicate).map((r) => r.key))
    );
    setSelectedRxKeys(
      new Set(rxRows.filter((r) => !r.duplicate).map((r) => r.key))
    );
  }, [open, suggestion, showExamsTab, examRows, rxRows]);

  const selectedExams = examRows
    .filter((r) => selectedExamKeys.has(r.key))
    .map((r) => r.item);
  const selectedRx = rxRows
    .filter((r) => selectedRxKeys.has(r.key))
    .map((r) => r.item);

  const selectableExams = examRows.filter((r) => !r.duplicate);
  const selectableRx = rxRows.filter((r) => !r.duplicate);

  const rejectionReport = suggestion?.rejection_report ?? [];
  const singleTab = !(showExamsTab && showRxTab);

  const canApply =
    (showExamsTab && selectedExams.length > 0) ||
    (showRxTab && selectedRx.length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[min(90vh,720px)] flex flex-col">
        <DialogClose onClose={() => onOpenChange(false)} />
        <DialogHeader>
          <DialogTitle>Sugestões da evolução</DialogTitle>
          <DialogDescription>
            Revise os itens sugeridos pela IA e selecione o que deseja registrar nesta
            evolução.
          </DialogDescription>
        </DialogHeader>

        {!suggestion ? (
          <p className="text-sm text-muted-foreground py-4">Sem sugestões para exibir.</p>
        ) : (
          <>
            {rejectionReport.length > 0 && <RejectionReport items={rejectionReport} />}

            {!showExamsTab && !showRxTab ? (
              <p className="text-sm text-muted-foreground py-2">
                Não há sugestões aplicáveis a este tipo de evolução.
              </p>
            ) : (
            <>
            <Tabs
              value={activeTab}
              onValueChange={(v) => setActiveTab(v as 'exams' | 'prescription')}
              className="flex flex-col min-h-0 flex-1"
            >
              {!singleTab && (
                <TabsList className="w-full justify-start shrink-0">
                  {showExamsTab && (
                    <TabsTrigger value="exams">
                      Exames ({examItems.length})
                    </TabsTrigger>
                  )}
                  {showRxTab && (
                    <TabsTrigger value="prescription">
                      Receita ({rxItems.length})
                    </TabsTrigger>
                  )}
                </TabsList>
              )}

              {showExamsTab && (
                <TabsContent value="exams" className="mt-3 min-h-0 flex-1 overflow-y-auto">
                  {singleTab && (
                    <h4 className="text-sm font-medium mb-2">
                      Exames ({examItems.length})
                    </h4>
                  )}
                  {examItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nenhum exame sugerido.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {examRows.map(({ item, key, duplicate }) => {
                        const code = item.code?.trim() || item.loinc_code?.trim();
                        return (
                          <li
                            key={key}
                            className="flex gap-3 rounded-md border p-3 text-sm"
                          >
                            <Checkbox
                              id={key}
                              checked={selectedExamKeys.has(key)}
                              disabled={duplicate || applying}
                              onCheckedChange={(checked) => {
                                setSelectedExamKeys((prev) => {
                                  const next = new Set(prev);
                                  if (checked) next.add(key);
                                  else next.delete(key);
                                  return next;
                                });
                              }}
                              aria-label={`Selecionar ${item.display_name}`}
                            />
                            <div className="min-w-0 flex-1 space-y-1">
                              <label
                                htmlFor={key}
                                className="font-medium cursor-pointer block"
                              >
                                {item.display_name}
                              </label>
                              <div className="flex flex-wrap gap-2 items-center">
                                <Badge variant="outline">
                                  {examSourceLabel(item.request_source)}
                                </Badge>
                                {code && (
                                  <span className="text-xs text-muted-foreground">
                                    Código: {code}
                                  </span>
                                )}
                                {duplicate && (
                                  <Badge variant="secondary">Já na lista</Badge>
                                )}
                              </div>
                              {item.rationale?.trim() && (
                                <p className="text-xs text-muted-foreground">
                                  {item.rationale.trim()}
                                </p>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </TabsContent>
              )}

              {showRxTab && (
                <TabsContent
                  value="prescription"
                  className="mt-3 min-h-0 flex-1 overflow-y-auto"
                >
                  {singleTab && (
                    <h4 className="text-sm font-medium mb-2">
                      Receita ({rxItems.length})
                    </h4>
                  )}
                  {rxItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nenhum item de receita sugerido.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {rxRows.map(({ item, key, duplicate }) => {
                        const body = prescriptionLineBodyFromSuggestion(item);
                        const posology = buildPrescriptionPosology(body);
                        return (
                          <li
                            key={key}
                            className="flex gap-3 rounded-md border p-3 text-sm"
                          >
                            <Checkbox
                              id={key}
                              checked={selectedRxKeys.has(key)}
                              disabled={duplicate || applying}
                              onCheckedChange={(checked) => {
                                setSelectedRxKeys((prev) => {
                                  const next = new Set(prev);
                                  if (checked) next.add(key);
                                  else next.delete(key);
                                  return next;
                                });
                              }}
                              aria-label={`Selecionar ${item.medication_name}`}
                            />
                            <div className="min-w-0 flex-1 space-y-1">
                              <label
                                htmlFor={key}
                                className="font-medium cursor-pointer block"
                              >
                                {item.medication_name}
                              </label>
                              <div className="flex flex-wrap gap-2 items-center">
                                <Badge variant={rxIntentVariant(item.prescription_intent)}>
                                  {rxIntentLabel(item.prescription_intent)}
                                </Badge>
                                {isTherapyReviewIndication(item.indication) && (
                                  <Badge variant="outline">Sugestão de revisão</Badge>
                                )}
                                {duplicate && (
                                  <Badge variant="secondary">Já na lista</Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">{posology}</p>
                              {item.indication?.trim() && (
                                <p className="text-xs text-muted-foreground">
                                  Obs.: {item.indication.trim()}
                                </p>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </TabsContent>
              )}
            </Tabs>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t shrink-0">
              <div>
                {activeTab === 'exams' && selectableExams.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={applying}
                    onClick={() =>
                      setSelectedExamKeys(new Set(selectableExams.map((r) => r.key)))
                    }
                  >
                    Selecionar todos (exames)
                  </Button>
                )}
                {activeTab === 'prescription' && selectableRx.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={applying}
                    onClick={() =>
                      setSelectedRxKeys(new Set(selectableRx.map((r) => r.key)))
                    }
                  >
                    Selecionar todos (receita)
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => onOpenChange(false)}
                  disabled={applying}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  disabled={!canApply || applying}
                  onClick={() =>
                    onApply({
                      exams: showExamsTab ? selectedExams : [],
                      prescriptions: showRxTab ? selectedRx : [],
                    })
                  }
                >
                  {applying ? 'Aplicando…' : 'Aplicar selecionados'}
                </Button>
              </div>
            </div>
            </>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
