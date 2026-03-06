'use client';

import { usePatientSummary, useRefreshPatientSummary } from '@/hooks/use-patient-detail';
import {
  PatientSummaryHighlight,
  PatientSummaryRisk,
  PatientSummaryNextStep,
} from '@/lib/api/patients';
import {
  Info,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Sparkles,
  ShieldAlert,
  ArrowRight,
  Loader2,
} from 'lucide-react';

interface PatientSummaryCardProps {
  patientId: string;
}

const highlightIcons: Record<string, React.ReactNode> = {
  info: <Info className="h-4 w-4 text-blue-500" />,
  warning: <AlertTriangle className="h-4 w-4 text-amber-500" />,
  success: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  clock: <Clock className="h-4 w-4 text-gray-500" />,
};

const severityColors: Record<string, string> = {
  LOW: 'bg-green-100 text-green-800 border-green-200',
  MEDIUM: 'bg-amber-100 text-amber-800 border-amber-200',
  HIGH: 'bg-orange-100 text-orange-800 border-orange-200',
  CRITICAL: 'bg-red-100 text-red-800 border-red-200',
};

const urgencyColors: Record<string, string> = {
  LOW: 'text-gray-500',
  NORMAL: 'text-blue-600',
  HIGH: 'text-orange-600',
  URGENT: 'text-red-600 font-semibold',
};

export function PatientSummaryCard({ patientId }: PatientSummaryCardProps) {
  const { data, isLoading, isError } = usePatientSummary(patientId);
  const refreshSummary = useRefreshPatientSummary();

  if (isLoading) {
    return (
      <div className="rounded-lg border bg-white p-6">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Gerando resumo inteligente...
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-lg border bg-white p-6">
        <p className="text-sm text-gray-500">
          Não foi possível carregar o resumo do paciente.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-500" />
          <h3 className="text-lg font-semibold">Resumo Inteligente</h3>
          {data.used_llm && (
            <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700">
              IA
            </span>
          )}
        </div>
        <button
          onClick={() => refreshSummary(patientId)}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-700"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Atualizar
        </button>
      </div>

      {/* Narrative */}
      <div className="rounded-lg border bg-white p-4">
        <p className="text-sm leading-relaxed text-gray-700">{data.narrative}</p>
      </div>

      {/* Highlights */}
      {data.highlights.length > 0 && (
        <div className="rounded-lg border bg-white p-4">
          <h4 className="mb-3 text-sm font-medium text-gray-900">Destaques Clínicos</h4>
          <div className="grid gap-2 sm:grid-cols-2">
            {data.highlights.map((h: PatientSummaryHighlight, i: number) => (
              <div
                key={i}
                className="flex items-start gap-2 rounded-md border bg-gray-50 p-2.5"
              >
                <span className="mt-0.5">{highlightIcons[h.icon] || highlightIcons.info}</span>
                <span className="text-sm text-gray-700">{h.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Risks */}
      {data.risks.length > 0 && (
        <div className="rounded-lg border bg-white p-4">
          <div className="mb-3 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-orange-500" />
            <h4 className="text-sm font-medium text-gray-900">Riscos Identificados</h4>
          </div>
          <div className="space-y-2">
            {data.risks.map((r: PatientSummaryRisk, i: number) => (
              <div
                key={i}
                className={`flex items-center justify-between rounded-md border p-2.5 ${severityColors[r.severity] || severityColors.MEDIUM}`}
              >
                <span className="text-sm">{r.risk}</span>
                <span className="rounded-full px-2 py-0.5 text-xs font-medium">
                  {r.severity}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Next Steps */}
      {data.next_steps.length > 0 && (
        <div className="rounded-lg border bg-white p-4">
          <div className="mb-3 flex items-center gap-2">
            <ArrowRight className="h-4 w-4 text-blue-500" />
            <h4 className="text-sm font-medium text-gray-900">Próximos Passos</h4>
          </div>
          <div className="space-y-2">
            {data.next_steps.map((s: PatientSummaryNextStep, i: number) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-md border bg-gray-50 p-2.5"
              >
                <span className="text-sm text-gray-700">{s.step}</span>
                <span
                  className={`text-xs ${urgencyColors[s.urgency] || urgencyColors.NORMAL}`}
                >
                  {s.urgency}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
