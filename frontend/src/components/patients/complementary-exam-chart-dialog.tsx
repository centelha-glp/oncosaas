'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
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

interface ComplementaryExamChartDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exam: ComplementaryExam;
}

function buildChartData(results: ComplementaryExamResult[]) {
  return results
    .filter((r) => r.valueNumeric != null)
    .map((r) => ({
      date: format(new Date(r.performedAt), 'dd/MM/yyyy', { locale: ptBR }),
      dateSort: new Date(r.performedAt).getTime(),
      value: r.valueNumeric as number,
    }))
    .sort((a, b) => a.dateSort - b.dateSort);
}

export function ComplementaryExamChartDialog({
  open,
  onOpenChange,
  exam,
}: ComplementaryExamChartDialogProps): React.ReactElement {
  const chartData = buildChartData(exam.results);
  const hasNumericSeries = chartData.length >= 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogClose onClose={() => onOpenChange(false)} />
        <DialogHeader>
          <DialogTitle>Evolução: {exam.name}</DialogTitle>
        </DialogHeader>
        {hasNumericSeries ? (
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
                    `${value}${exam.unit ? ` ${exam.unit}` : ''}`,
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
          <p className="text-sm text-muted-foreground py-4">
            Sem dados numéricos em série para exibir gráfico. Exibindo apenas
            linha do tempo de resultados abaixo.
          </p>
        )}
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
                      {r.valueNumeric != null
                        ? `${r.valueNumeric}${r.unit ? ` ${r.unit}` : ''}`
                        : r.valueText ?? '-'}
                      {r.isAbnormal && (
                        <span className="text-amber-600 ml-1">(fora ref.)</span>
                      )}
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
