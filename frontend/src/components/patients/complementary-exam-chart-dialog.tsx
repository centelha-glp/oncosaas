'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ComplementaryExam, ComplementaryExamResult } from '@/lib/api/patients';
import {
  buildComponentNumericChartPoints,
  buildParentNumericChartPoints,
  collectUniqueComponentNames,
  examHasPanelComponents,
  guessComponentUnit,
  normalizeComplementaryResultComponents,
} from '@/lib/utils/complementary-exam-series';

interface ComplementaryExamChartDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exam: ComplementaryExam;
}

const selectSubitemId = 'complementary-exam-chart-subitem';

export function ComplementaryExamChartDialog({
  open,
  onOpenChange,
  exam,
}: ComplementaryExamChartDialogProps): React.ReactElement {
  const needsSubitemPick = examHasPanelComponents(exam);
  const subitemOptions = React.useMemo(
    () => (needsSubitemPick ? collectUniqueComponentNames(exam) : []),
    [exam, needsSubitemPick]
  );

  const [selectedSubitem, setSelectedSubitem] = React.useState('');

  React.useEffect(() => {
    if (open) setSelectedSubitem('');
  }, [open, exam.id]);

  const chartData = React.useMemo(() => {
    if (needsSubitemPick) {
      if (!selectedSubitem.trim()) return [];
      return buildComponentNumericChartPoints(
        exam.results,
        selectedSubitem,
        exam.name
      );
    }
    return buildParentNumericChartPoints(exam.results, exam.name);
  }, [exam.results, exam.name, needsSubitemPick, selectedSubitem]);

  const hasNumericSeries = chartData.length >= 1;
  const chartUnit = needsSubitemPick && selectedSubitem
    ? guessComponentUnit(exam, selectedSubitem) ?? exam.unit
    : exam.unit;

  const showChartBlock =
    !needsSubitemPick || (needsSubitemPick && selectedSubitem.trim().length > 0);

  const emptySeriesMessage = needsSubitemPick
    ? selectedSubitem.trim()
      ? 'Sem pontos numéricos na série para o subitem selecionado (valores ausentes ou só texto em algumas datas).'
      : 'Este painel tem subitens. Selecione um parâmetro abaixo para ver a curva.'
    : 'Sem dados numéricos em série para exibir gráfico. Exibindo apenas linha do tempo de resultados abaixo.';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogClose onClose={() => onOpenChange(false)} />
        <DialogHeader>
          <DialogTitle>Evolução: {exam.name}</DialogTitle>
        </DialogHeader>

        {needsSubitemPick ? (
          <div className="space-y-2 py-1">
            <Label htmlFor={selectSubitemId}>Parâmetro do painel</Label>
            <Select
              value={selectedSubitem || undefined}
              onValueChange={setSelectedSubitem}
            >
              <SelectTrigger id={selectSubitemId} className="w-full max-w-md">
                <SelectValue placeholder="Selecione o subitem para ver o gráfico" />
              </SelectTrigger>
              <SelectContent>
                {subitemOptions.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              O gráfico usa apenas valores numéricos do subitem escolhido, por data
              de realização.
            </p>
          </div>
        ) : null}

        {showChartBlock ? (
          hasNumericSeries ? (
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    tickMargin={8}
                  />
                  <YAxis tick={{ fontSize: 12 }} tickMargin={8} />
                  <Tooltip
                    formatter={(value: number) => [
                      `${value}${chartUnit ? ` ${chartUnit}` : ''}`,
                      'Valor',
                    ]}
                    labelFormatter={(label) => `Data: ${label}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    name="Valor"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4">{emptySeriesMessage}</p>
          )
        ) : null}

        {exam.results.length > 0 && (
          <div className="mt-2 border-t pt-2">
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Resultados por data
            </p>
            <ul className="space-y-1 text-sm max-h-40 overflow-y-auto">
              {[...exam.results]
                .sort(
                  (a, b) =>
                    new Date(b.performedAt).getTime() -
                    new Date(a.performedAt).getTime()
                )
                .map((r) => (
                  <li key={r.id} className="flex justify-between gap-2">
                    <span className="text-muted-foreground">
                      {format(new Date(r.performedAt), 'dd/MM/yyyy', {
                        locale: ptBR,
                      })}
                    </span>
                    <span>
                      {formatResultSummary(r, needsSubitemPick, selectedSubitem)}
                    </span>
                  </li>
                ))}
            </ul>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function formatResultSummary(
  r: ComplementaryExamResult,
  needsSubitem: boolean,
  selectedSubitem: string
): React.ReactNode {
  if (needsSubitem && selectedSubitem.trim()) {
    const c = normalizeComplementaryResultComponents(r.components).find(
      (x) => x.name && x.name.trim().toLowerCase() === selectedSubitem.trim().toLowerCase()
    );
    if (c) {
      const text =
        c.valueNumeric != null
          ? `${c.valueNumeric}${c.unit ? ` ${c.unit}` : ''}`
          : (c.valueText ?? '-');
      return (
        <>
          {text}
          {c.isAbnormal && (
            <span className="text-amber-600 ml-1">(fora ref.)</span>
          )}
        </>
      );
    }
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <>
      {r.valueNumeric != null
        ? `${r.valueNumeric}${r.unit ? ` ${r.unit}` : ''}`
        : (r.valueText ?? '-')}
      {r.isAbnormal && <span className="text-amber-600 ml-1">(fora ref.)</span>}
    </>
  );
}
