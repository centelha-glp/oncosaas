'use client';

import React, { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronDown, ChevronRight, LineChart as LineChartIcon } from 'lucide-react';
import type {
  ComplementaryExam,
  ComplementaryExamResult,
  PatientDetail,
} from '@/lib/api/patients';
import { Button } from '@/components/ui/button';
import { ComplementaryExamChartDialog } from '@/components/patients/complementary-exam-chart-dialog';
import {
  filterActiveComplementaryResults,
  normalizeComplementaryResultComponents,
} from '@/lib/utils/complementary-exam-series';

interface PatientProntuarioLabHistoryProps {
  patient: PatientDetail;
}

function formatResultMainValue(r: ComplementaryExamResult): string {
  if (r.valueNumeric != null) {
    return String(r.valueNumeric);
  }
  return (r.valueText ?? r.report ?? '-').trim() || '-';
}

export function PatientProntuarioLabHistory({
  patient,
}: PatientProntuarioLabHistoryProps): React.ReactElement {
  const [chartExam, setChartExam] = useState<ComplementaryExam | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  const labExams = useMemo(() => {
    const raw = Array.isArray(patient.complementaryExams)
      ? patient.complementaryExams
      : [];
    return raw
      .filter((e) => e.type === 'LABORATORY')
      .map((e) => ({
        ...e,
        results: filterActiveComplementaryResults(e.results).sort(
          (a, b) =>
            new Date(a.performedAt).getTime() - new Date(b.performedAt).getTime()
        ),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [patient.complementaryExams]);

  const toggleExpanded = (resultId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(resultId)) next.delete(resultId);
      else next.add(resultId);
      return next;
    });
  };

  if (labExams.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhum exame laboratorial cadastrado para este paciente.
      </p>
    );
  }

  return (
    <div className="space-y-8" aria-label="Histórico laboratorial">
      {labExams.map((exam) => (
        <section key={exam.id} className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-foreground">{exam.name}</h4>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 gap-1"
              disabled={exam.results.length === 0}
              onClick={() => setChartExam(exam)}
              aria-label={`Abrir gráfico de evolução do exame ${exam.name}`}
            >
              <LineChartIcon className="h-4 w-4" aria-hidden />
              Gráfico
            </Button>
          </div>
          {exam.referenceRange && (
            <p className="text-xs text-muted-foreground">
              Ref.: {exam.referenceRange}
              {exam.unit ? ` ${exam.unit}` : ''}
            </p>
          )}

          <div className="relative max-h-[min(28rem,70vh)] overflow-auto rounded-md border">
            <table className="w-full min-w-[36rem] caption-bottom text-sm border-collapse">
              <thead className="sticky top-0 z-20 bg-background shadow-[0_1px_0_0_hsl(var(--border))]">
                <tr>
                  <th
                    scope="col"
                    className="sticky left-0 z-30 w-10 border-b bg-background px-2 py-2 text-left font-medium text-muted-foreground shadow-[1px_0_0_0_hsl(var(--border))]"
                  />
                  <th
                    scope="col"
                    className="sticky left-10 z-30 min-w-[7.5rem] border-b bg-background px-2 py-2 text-left font-medium text-muted-foreground shadow-[1px_0_0_0_hsl(var(--border))]"
                  >
                    Data
                  </th>
                  <th
                    scope="col"
                    className="border-b bg-background px-2 py-2 text-left font-medium text-muted-foreground"
                  >
                    Valor principal
                  </th>
                  <th
                    scope="col"
                    className="border-b bg-background px-2 py-2 text-left font-medium text-muted-foreground"
                  >
                    Unid.
                  </th>
                  <th
                    scope="col"
                    className="border-b bg-background px-2 py-2 text-left font-medium text-muted-foreground"
                  >
                    Ref.
                  </th>
                  <th
                    scope="col"
                    className="border-b bg-background px-2 py-2 text-left font-medium text-muted-foreground"
                  >
                    Sinais
                  </th>
                </tr>
              </thead>
              <tbody>
                {exam.results.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-4 text-muted-foreground"
                    >
                      Sem resultados registrados.
                    </td>
                  </tr>
                ) : (
                  exam.results.map((r) => {
                    const comps = normalizeComplementaryResultComponents(
                      r.components
                    );
                    const hasChildren = comps.length > 0;
                    const isOpen = expandedIds.has(r.id);
                    const panelId = `lab-panel-${exam.id}-${r.id}`;
                    return (
                      <React.Fragment key={r.id}>
                        <tr className="border-b border-border/60 odd:bg-muted/20">
                          <td className="sticky left-0 z-10 bg-background px-1 py-1 align-middle shadow-[1px_0_0_0_hsl(var(--border))] odd:bg-muted/30">
                            {hasChildren ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0"
                                aria-expanded={isOpen}
                                aria-controls={panelId}
                                id={`lab-expand-${exam.id}-${r.id}`}
                                onClick={() => toggleExpanded(r.id)}
                                aria-label={
                                  isOpen
                                    ? `Recolher subitens da coleta de ${format(new Date(r.performedAt), 'dd/MM/yyyy', { locale: ptBR })}`
                                    : `Expandir subitens da coleta de ${format(new Date(r.performedAt), 'dd/MM/yyyy', { locale: ptBR })}`
                                }
                              >
                                {isOpen ? (
                                  <ChevronDown className="h-4 w-4" aria-hidden />
                                ) : (
                                  <ChevronRight className="h-4 w-4" aria-hidden />
                                )}
                              </Button>
                            ) : null}
                          </td>
                          <td className="sticky left-10 z-10 whitespace-nowrap border-b border-border/60 bg-background px-2 py-2 text-muted-foreground shadow-[1px_0_0_0_hsl(var(--border))] odd:bg-muted/30">
                            {format(new Date(r.performedAt), 'dd/MM/yyyy', {
                              locale: ptBR,
                            })}
                          </td>
                          <td className="border-b border-border/60 px-2 py-2 font-medium">
                            {formatResultMainValue(r)}
                          </td>
                          <td className="border-b border-border/60 px-2 py-2 text-muted-foreground">
                            {r.unit ?? '—'}
                          </td>
                          <td className="border-b border-border/60 px-2 py-2 text-muted-foreground">
                            {r.referenceRange ?? '—'}
                          </td>
                          <td className="border-b border-border/60 px-2 py-2 text-xs">
                            {(() => {
                              const bits: string[] = [];
                              if (r.criticalHigh) bits.push('Crítico alto');
                              if (r.criticalLow) bits.push('Crítico baixo');
                              if (r.isAbnormal) bits.push('Fora da ref.');
                              if (bits.length === 0) {
                                return <span className="text-muted-foreground">—</span>;
                              }
                              return (
                                <span className="space-x-1">
                                  {bits.map((b) => (
                                    <span
                                      key={b}
                                      className={
                                        b === 'Fora da ref.'
                                          ? 'text-amber-700 dark:text-amber-500'
                                          : 'text-destructive'
                                      }
                                    >
                                      {b}
                                    </span>
                                  ))}
                                </span>
                              );
                            })()}
                          </td>
                        </tr>
                        {hasChildren && isOpen ? (
                          <tr className="bg-muted/15">
                            <td
                              colSpan={6}
                              className="p-0 border-b border-border/60"
                              id={panelId}
                              role="region"
                              aria-labelledby={`lab-expand-${exam.id}-${r.id}`}
                            >
                              <div className="overflow-x-auto px-3 py-2">
                                <table className="w-full min-w-[32rem] text-xs">
                                  <thead>
                                    <tr className="text-left text-muted-foreground">
                                      <th scope="col" className="py-1 pr-2 font-medium">
                                        Subitem
                                      </th>
                                      <th scope="col" className="py-1 pr-2 font-medium">
                                        Valor
                                      </th>
                                      <th scope="col" className="py-1 pr-2 font-medium">
                                        Unid.
                                      </th>
                                      <th scope="col" className="py-1 pr-2 font-medium">
                                        Ref.
                                      </th>
                                      <th scope="col" className="py-1 font-medium">
                                        Sinais
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {comps.map((c, idx) => (
                                      <tr
                                        key={`${r.id}-c-${idx}-${c.name}`}
                                        className="border-t border-border/40"
                                      >
                                        <td className="py-1.5 pr-2 font-medium">
                                          {c.name}
                                        </td>
                                        <td className="py-1.5 pr-2">
                                          {c.valueNumeric != null
                                            ? String(c.valueNumeric)
                                            : (c.valueText ?? '—')}
                                        </td>
                                        <td className="py-1.5 pr-2 text-muted-foreground">
                                          {c.unit ?? '—'}
                                        </td>
                                        <td className="py-1.5 pr-2 text-muted-foreground">
                                          {c.referenceRange ?? '—'}
                                        </td>
                                        <td className="py-1.5">
                                          {c.isAbnormal ? (
                                            <span className="text-amber-700 dark:text-amber-500">
                                              Fora da ref.
                                            </span>
                                          ) : (
                                            '—'
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      {chartExam ? (
        <ComplementaryExamChartDialog
          open
          onOpenChange={(open) => !open && setChartExam(null)}
          exam={chartExam}
        />
      ) : null}
    </div>
  );
}
