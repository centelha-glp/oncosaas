'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  useObservabilityStats,
  useObservabilityTraces,
  useClearTraces,
} from '@/hooks/useObservability';
import { NavigationBar } from '@/components/shared/navigation-bar';
import { AgentTrace, PipelineSpan } from '@/lib/api/observability';
import {
  Activity,
  AlertTriangle,
  Bot,
  ChevronDown,
  ChevronRight,
  Clock,
  RefreshCw,
  Trash2,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(ms: number | null | undefined): string {
  if (ms == null) return '—';
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

function severityColor(s: string | null): string {
  switch (s) {
    case 'CRITICAL':
      return 'bg-red-100 text-red-700';
    case 'HIGH':
      return 'bg-orange-100 text-orange-700';
    case 'MEDIUM':
      return 'bg-yellow-100 text-yellow-700';
    case 'LOW':
      return 'bg-green-100 text-green-700';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}

function dispositionColor(d: string | null): string {
  switch (d) {
    case 'ER_IMMEDIATE':
      return 'bg-red-600 text-white';
    case 'ER_DAYS':
      return 'bg-orange-500 text-white';
    case 'ADVANCE_CONSULT':
      return 'bg-yellow-500 text-white';
    case 'SCHEDULED_CONSULT':
      return 'bg-blue-500 text-white';
    case 'REMOTE_NURSING':
      return 'bg-green-500 text-white';
    default:
      return 'bg-gray-200 text-gray-600';
  }
}

function pathColor(p: string): string {
  switch (p) {
    case 'emergency':
      return 'bg-red-100 text-red-700';
    case 'questionnaire':
      return 'bg-purple-100 text-purple-700';
    case 'greeting':
      return 'bg-blue-100 text-blue-700';
    case 'appointment_query':
      return 'bg-indigo-100 text-indigo-700';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s atrás`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}min atrás`;
  const h = Math.floor(m / 60);
  return `${h}h atrás`;
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-4">
      <div
        className={cn(
          'rounded-lg p-2.5 flex-shrink-0',
          accent || 'bg-indigo-50'
        )}
      >
        <Icon
          className={cn('h-5 w-5', accent ? 'text-white' : 'text-indigo-600')}
        />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm font-medium text-gray-600">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Distribution Bar ─────────────────────────────────────────────────────────

function DistributionBar({
  title,
  data,
  colorFn,
}: {
  title: string;
  data: Record<string, number>;
  colorFn?: (k: string) => string;
}) {
  const total = Object.values(data).reduce((a, b) => a + b, 0);
  if (total === 0) return null;

  const sorted = Object.entries(data).sort((a, b) => b[1] - a[1]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">{title}</h3>
      <div className="space-y-2">
        {sorted.map(([key, count]) => {
          const pct = Math.round((count / total) * 100);
          return (
            <div key={key} className="flex items-center gap-3">
              <span
                className={cn(
                  'text-xs font-medium px-1.5 py-0.5 rounded w-36 truncate text-center',
                  colorFn ? colorFn(key) : 'bg-gray-100 text-gray-600'
                )}
              >
                {key}
              </span>
              <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-xs text-gray-500 w-16 text-right">
                {count} ({pct}%)
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Span Latency Chart ───────────────────────────────────────────────────────

function SpanLatencyChart({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = Math.max(...entries.map(([, v]) => v), 1);

  if (entries.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">
        Latência média por etapa
      </h3>
      <div className="space-y-2">
        {entries.map(([name, ms]) => {
          const pct = (ms / max) * 100;
          const barColor =
            ms > 5000
              ? 'bg-red-400'
              : ms > 2000
                ? 'bg-orange-400'
                : ms > 500
                  ? 'bg-yellow-400'
                  : 'bg-green-400';

          return (
            <div key={name} className="flex items-center gap-3">
              <span className="text-xs text-gray-600 w-44 truncate">{name}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', barColor)}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-xs text-gray-500 w-16 text-right">
                {fmt(ms)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Trace Row ────────────────────────────────────────────────────────────────

function TraceRow({ trace }: { trace: AgentTrace }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <tr
        className={cn(
          'border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors',
          trace.error && 'bg-red-50'
        )}
        onClick={() => setOpen((v) => !v)}
      >
        <td className="px-4 py-3 text-xs font-mono text-gray-500">
          {trace.trace_id}
        </td>
        <td className="px-4 py-3 text-xs text-gray-500">
          {timeAgo(trace.timestamp)}
        </td>
        <td className="px-4 py-3">
          <span
            className={cn(
              'text-xs font-medium px-2 py-0.5 rounded',
              pathColor(trace.pipeline_path)
            )}
          >
            {trace.pipeline_path}
          </span>
        </td>
        <td className="px-4 py-3 text-xs text-gray-700">
          {trace.intent || '—'}
          {trace.intent_confidence != null && (
            <span className="text-gray-400 ml-1">
              ({Math.round(trace.intent_confidence * 100)}%)
            </span>
          )}
        </td>
        <td className="px-4 py-3">
          {trace.overall_severity && (
            <span
              className={cn(
                'text-xs font-medium px-2 py-0.5 rounded',
                severityColor(trace.overall_severity)
              )}
            >
              {trace.overall_severity}
            </span>
          )}
        </td>
        <td className="px-4 py-3">
          {trace.clinical_disposition && (
            <span
              className={cn(
                'text-xs font-medium px-2 py-0.5 rounded',
                dispositionColor(trace.clinical_disposition)
              )}
            >
              {trace.clinical_disposition}
            </span>
          )}
        </td>
        <td className="px-4 py-3 text-xs font-medium text-gray-700">
          {fmt(trace.total_duration_ms)}
        </td>
        <td className="px-4 py-3">
          {trace.error ? (
            <span className="text-xs text-red-600 font-medium">Erro</span>
          ) : (
            <span className="text-xs text-green-600">OK</span>
          )}
        </td>
        <td className="px-4 py-3 text-gray-400">
          {open ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </td>
      </tr>

      {open && (
        <tr className="bg-gray-50 border-b border-gray-200">
          <td colSpan={9} className="px-4 py-4">
            <TraceDetail trace={trace} />
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Trace Detail ─────────────────────────────────────────────────────────────

function TraceDetail({ trace }: { trace: AgentTrace }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-xs">
      {/* Spans */}
      <div className="lg:col-span-1">
        <p className="font-semibold text-gray-700 mb-2">Pipeline Spans</p>
        <div className="space-y-1">
          {trace.spans.map((span: PipelineSpan, i: number) => (
            <div
              key={i}
              className="flex items-center justify-between bg-white rounded border border-gray-200 px-3 py-1.5"
            >
              <span className="text-gray-700 font-medium">{span.name}</span>
              <span
                className={cn(
                  'font-mono',
                  span.duration_ms && span.duration_ms > 3000
                    ? 'text-red-600'
                    : span.duration_ms && span.duration_ms > 1000
                      ? 'text-orange-500'
                      : 'text-gray-500'
                )}
              >
                {fmt(span.duration_ms)}
              </span>
            </div>
          ))}
          {trace.spans.length === 0 && (
            <p className="text-gray-400 italic">Sem spans</p>
          )}
        </div>
      </div>

      {/* LLM Calls */}
      <div className="lg:col-span-1">
        <p className="font-semibold text-gray-700 mb-2">LLM Calls</p>
        <div className="space-y-1">
          {trace.llm_calls.map((lc, i) => (
            <div
              key={i}
              className={cn(
                'bg-white rounded border px-3 py-1.5',
                lc.error ? 'border-red-200' : 'border-gray-200'
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-700">{lc.step}</span>
                <span className="font-mono text-gray-500">
                  {fmt(lc.duration_ms)}
                </span>
              </div>
              <div className="text-gray-400 mt-0.5">
                {lc.provider}/{lc.model}
              </div>
              {lc.error && (
                <div className="text-red-500 mt-0.5">{lc.error}</div>
              )}
            </div>
          ))}
          {trace.llm_calls.length === 0 && (
            <p className="text-gray-400 italic">Sem chamadas LLM</p>
          )}
        </div>
      </div>

      {/* Metadata */}
      <div className="lg:col-span-1 space-y-3">
        {trace.subagents_called.length > 0 && (
          <div>
            <p className="font-semibold text-gray-700 mb-1">Subagentes</p>
            <div className="flex flex-wrap gap-1">
              {trace.subagents_called.map((sa, i) => (
                <span
                  key={i}
                  className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs"
                >
                  {sa.replace('consultar_agente_', '')}
                </span>
              ))}
            </div>
          </div>
        )}

        {trace.clinical_rules_fired.length > 0 && (
          <div>
            <p className="font-semibold text-gray-700 mb-1">Regras clínicas</p>
            <div className="flex flex-wrap gap-1">
              {trace.clinical_rules_fired.map((r, i) => (
                <span
                  key={i}
                  className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs font-mono"
                >
                  {r}
                </span>
              ))}
            </div>
          </div>
        )}

        {trace.actions_generated.length > 0 && (
          <div>
            <p className="font-semibold text-gray-700 mb-1">Ações geradas</p>
            <div className="flex flex-wrap gap-1">
              {trace.actions_generated.map((a, i) => (
                <span
                  key={i}
                  className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs"
                >
                  {a}
                </span>
              ))}
            </div>
          </div>
        )}

        {trace.error && (
          <div>
            <p className="font-semibold text-red-600 mb-1">Erro</p>
            <pre className="bg-red-50 text-red-700 p-2 rounded text-xs whitespace-pre-wrap break-all">
              {trace.error}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ObservabilityPage() {
  const router = useRouter();
  const [traceLimit, setTraceLimit] = useState(50);

  const {
    data: stats,
    isLoading: loadingStats,
    refetch: refetchStats,
    dataUpdatedAt: statsUpdated,
  } = useObservabilityStats();

  const {
    data: tracesData,
    isLoading: loadingTraces,
    refetch: refetchTraces,
  } = useObservabilityTraces(traceLimit);

  const clearMutation = useClearTraces();

  const traces = tracesData?.traces ?? [];

  function handleRefresh() {
    refetchStats();
    refetchTraces();
  }

  function handleClear() {
    if (confirm('Limpar todos os traces? Isso é irreversível.')) {
      clearMutation.mutate();
    }
  }

  const lastUpdated = statsUpdated
    ? new Date(statsUpdated).toLocaleTimeString('pt-BR')
    : null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <NavigationBar />

      <main className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-screen-2xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Activity className="h-6 w-6 text-indigo-600" />
                Observabilidade — AI Agent
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Pipeline traces em tempo real do orquestrador multi-agente
                {lastUpdated && (
                  <span className="ml-2 text-gray-400">
                    · atualizado às {lastUpdated}
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={loadingStats || loadingTraces}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Atualizar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClear}
                disabled={clearMutation.isPending}
                className="text-red-600 border-red-200 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Limpar
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          {loadingStats ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="bg-white rounded-xl border h-24 animate-pulse"
                />
              ))}
            </div>
          ) : stats ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                label="Total de traces"
                value={String(stats.total_traces)}
                sub="no buffer (máx 500)"
                icon={Activity}
              />
              <StatCard
                label="Latência média"
                value={fmt(stats.avg_duration_ms)}
                sub={`p95: ${fmt(stats.p95_duration_ms)}`}
                icon={Clock}
              />
              <StatCard
                label="Taxa de erro"
                value={`${stats.error_rate_pct}%`}
                sub="traces com exceção"
                icon={AlertTriangle}
                accent={stats.error_rate_pct > 5 ? 'bg-red-500' : undefined}
              />
              <StatCard
                label="Uso de LLM"
                value={`${stats.llm_usage_rate_pct}%`}
                sub={`média LLM: ${fmt(stats.avg_llm_duration_ms)}`}
                icon={Bot}
              />
            </div>
          ) : (
            <div className="bg-white rounded-xl border p-6 text-center text-gray-500">
              Nenhum trace disponível. Execute algumas mensagens no chat para
              ver dados aqui.
            </div>
          )}

          {/* Distribution Charts */}
          {stats && stats.total_traces > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <DistributionBar
                title="Distribuição de intent"
                data={stats.intent_distribution}
              />
              <DistributionBar
                title="Pipeline path"
                data={stats.pipeline_path_distribution}
                colorFn={pathColor}
              />
              <DistributionBar
                title="Severidade dos sintomas"
                data={stats.severity_distribution}
                colorFn={severityColor}
              />
              <DistributionBar
                title="Disposição clínica"
                data={stats.disposition_distribution}
                colorFn={dispositionColor}
              />
            </div>
          )}

          {/* Span Latency */}
          {stats && Object.keys(stats.avg_span_durations_ms).length > 0 && (
            <SpanLatencyChart data={stats.avg_span_durations_ms} />
          )}

          {/* Subagent usage */}
          {stats && Object.keys(stats.subagent_usage).length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Zap className="h-4 w-4 text-purple-500" />
                Uso de Subagentes
              </h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(stats.subagent_usage)
                  .sort((a, b) => b[1] - a[1])
                  .map(([name, count]) => (
                    <div
                      key={name}
                      className="flex items-center gap-2 bg-purple-50 border border-purple-100 rounded-lg px-3 py-2"
                    >
                      <span className="text-xs font-medium text-purple-700">
                        {name.replace('consultar_agente_', '')}
                      </span>
                      <span className="text-xs bg-purple-200 text-purple-800 rounded px-1.5 py-0.5 font-bold">
                        {count}×
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Trace Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <h2 className="font-semibold text-gray-800">
                Traces recentes
                {traces.length > 0 && (
                  <span className="ml-2 text-sm font-normal text-gray-400">
                    ({traces.length} mostrados)
                  </span>
                )}
              </h2>
              <select
                value={traceLimit}
                onChange={(e) => setTraceLimit(Number(e.target.value))}
                className="text-sm border border-gray-200 rounded px-2 py-1"
              >
                <option value={25}>Últimos 25</option>
                <option value={50}>Últimos 50</option>
                <option value={100}>Últimos 100</option>
                <option value={200}>Últimos 200</option>
              </select>
            </div>

            {loadingTraces ? (
              <div className="p-8 text-center text-gray-400">
                Carregando traces...
              </div>
            ) : traces.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                Nenhum trace disponível. Execute mensagens via WhatsApp ou chat
                de teste para popular.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        ID
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Quando
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Path
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Intent
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Severidade
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Disposição
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Duração
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-4 py-3 w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {traces.map((trace) => (
                      <TraceRow key={trace.trace_id} trace={trace} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
