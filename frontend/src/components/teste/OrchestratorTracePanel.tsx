'use client';

import { useMemo, useState, useEffect } from 'react';
import type {
  Message,
  OrchestratorPipelineSpan,
  OrchestratorPipelineTrace,
  TraceIntentLlmSummary,
  TraceOrchestratorInput,
  TracePackedText,
  TraceSubagentOutput,
  TraceSymptomLlmSummary,
  TraceTokenUsageTotals,
} from '@/lib/api/messages';
import {
  resolveTraceForMessage,
  sanitizeTraceForAuditPanel,
} from '@/lib/utils/orchestrator-trace-for-message';

const SPAN_LABELS: Record<string, string> = {
  intent_classification: 'Classificação de intenção',
  symptom_analysis: 'Análise de sintomas',
  clinical_rules: 'Regras clínicas (Layer 1)',
  protocol_evaluation: 'Avaliação de protocolo',
  rag_context_build: 'Contexto RAG (legado)',
  structured_context_build: 'Contexto clínico estruturado',
  oncology_knowledge_rag: 'Base de conhecimento (corpus)',
  multi_agent_pipeline: 'Pipeline multi-agente (LLM)',
};

function spanLabel(name: string): string {
  return SPAN_LABELS[name] ?? name;
}

function formatLlmPair(provider: unknown, model: unknown): string | null {
  const p = provider != null && String(provider).trim() !== '' ? String(provider) : '';
  const m = model != null && String(model).trim() !== '' ? String(model) : '';
  if (!p && !m) return null;
  if (p && m) return `${p} / ${m}`;
  return p || m;
}

function intentLlmLine(il: TraceIntentLlmSummary | null | undefined): string {
  if (!il || typeof il !== 'object') return '—';
  const src = il.source;
  const pair = formatLlmPair(il.provider, il.model);
  if (src === 'llm' && pair) return pair;
  if (src === 'llm_error') {
    const tail = il.detail ? ` — ${String(il.detail).slice(0, 120)}` : '';
    return pair ? `${pair}${tail}` : `Erro na LLM de intent${tail}`;
  }
  if (src === 'no_llm') return 'Sem chamada LLM (fallback GENERAL)';
  if (src === 'disabled') return 'Classificação LLM desativada na config.';
  return pair ?? (src != null ? String(src) : '—');
}

/** Totais do trace: usa `token_usage_totals` ou soma `token_usage_events`. */
function resolveTokenTotals(trace: OrchestratorPipelineTrace): TraceTokenUsageTotals {
  const t = trace.token_usage_totals;
  if (t && typeof t === 'object') {
    const inp = Number(t.input_tokens ?? 0);
    const out = Number(t.output_tokens ?? 0);
    return {
      input_tokens: inp,
      output_tokens: out,
      total_tokens: Number(t.total_tokens ?? inp + out),
      estimated_cost_usd: Number(t.estimated_cost_usd ?? 0),
      call_count: Number(t.call_count ?? 0),
    };
  }
  const evs = trace.token_usage_events;
  if (Array.isArray(evs) && evs.length > 0) {
    let inp = 0;
    let out = 0;
    let cost = 0;
    for (const e of evs) {
      inp += Number(e.input_tokens ?? 0);
      out += Number(e.output_tokens ?? 0);
      cost += Number(e.cost_usd ?? 0);
    }
    return {
      input_tokens: inp,
      output_tokens: out,
      total_tokens: inp + out,
      estimated_cost_usd: Math.round(cost * 1_000_000) / 1_000_000,
      call_count: evs.length,
    };
  }
  return {
    input_tokens: 0,
    output_tokens: 0,
    total_tokens: 0,
    estimated_cost_usd: 0,
    call_count: 0,
  };
}

function formatUsd(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: n > 0 && n < 0.01 ? 6 : 4,
  }).format(n);
}

function subagentTokenLine(tu: TraceTokenUsageTotals | null | undefined): string | null {
  if (!tu || typeof tu !== 'object') return null;
  const tot = Number(tu.total_tokens ?? 0);
  const calls = Number(tu.call_count ?? 0);
  if (tot === 0 && calls === 0) return null;
  return `${tu.total_tokens ?? 0} tok · ${formatUsd(Number(tu.estimated_cost_usd ?? 0))} · ${calls} chamada(s)`;
}

function TokenUsageSection({ trace }: { trace: OrchestratorPipelineTrace }) {
  const tot = resolveTokenTotals(trace);
  const events = trace.token_usage_events ?? [];
  const hasAny =
    tot.total_tokens > 0 ||
    tot.estimated_cost_usd > 0 ||
    events.length > 0;

  return (
    <section
      className="rounded-md border border-amber-900/45 bg-amber-950/20 px-2 py-2 space-y-1.5"
      aria-label="Consumo de tokens e custo estimado"
    >
      <h3 className="text-[10px] font-semibold text-amber-400/95 uppercase tracking-wide">
        Tokens e custo (estimativa USD)
      </h3>
      <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-[11px]">
        <dt className="text-gray-500 shrink-0">Entrada</dt>
        <dd className="font-mono text-amber-100/95">
          {tot.input_tokens.toLocaleString('pt-BR')} tokens
        </dd>
        <dt className="text-gray-500 shrink-0">Saída</dt>
        <dd className="font-mono text-amber-100/95">
          {tot.output_tokens.toLocaleString('pt-BR')} tokens
        </dd>
        <dt className="text-gray-500 shrink-0">Total</dt>
        <dd className="font-mono text-amber-50">
          {tot.total_tokens.toLocaleString('pt-BR')} tokens
        </dd>
        <dt className="text-gray-500 shrink-0">Custo</dt>
        <dd className="font-mono text-amber-50">{formatUsd(tot.estimated_cost_usd)}</dd>
        <dt className="text-gray-500 shrink-0">Chamadas LLM</dt>
        <dd className="text-gray-300">{tot.call_count}</dd>
      </dl>
      {!hasAny && (
        <p className="text-[10px] text-gray-500 leading-snug">
          Nenhum token contabilizado neste request (sem chaves de API no
          ai-service, só regras/keyword, ou trace gravado antes desta versão).
          Com LLM ativa, os totais aparecem aqui e o detalhe por passo abaixo.
        </p>
      )}
      {events.length > 0 && (
        <details className="rounded bg-black/30 border border-amber-900/30 mt-1">
          <summary className="cursor-pointer px-2 py-1 text-[10px] text-amber-200/90 list-none [&::-webkit-details-marker]:hidden">
            Detalhe por passo ({events.length})
          </summary>
          <ul className="px-2 pb-2 space-y-1.5 border-t border-amber-900/25 pt-2 max-h-48 overflow-y-auto">
            {events.map((ev, i) => (
              <li
                key={`${String(ev.step)}-${i}`}
                className="text-[10px] font-mono text-gray-300 break-all border-b border-gray-800/80 pb-1 last:border-0"
              >
                <span className="text-cyan-400/90">{ev.step ?? '—'}</span>
                {' · '}
                {String(ev.provider ?? '—')} / {String(ev.model ?? '—')}
                <br />
                <span className="text-gray-500">
                  in {Number(ev.input_tokens ?? 0)} · out {Number(ev.output_tokens ?? 0)} ·{' '}
                  {formatUsd(Number(ev.cost_usd ?? 0))}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function symptomLlmLine(sl: TraceSymptomLlmSummary | null | undefined): string {
  if (!sl || typeof sl !== 'object') return '—';
  const pair = formatLlmPair(sl.provider, sl.model);
  if (!pair) return '—';
  if (sl.called === true) return `${pair} (resposta estruturada da LLM)`;
  if (sl.called === false) return `${pair} (chamada sem resultado estruturado)`;
  return pair;
}

function isPackedText(v: unknown): v is TracePackedText {
  return (
    typeof v === 'object' &&
    v !== null &&
    'text' in v &&
    typeof (v as TracePackedText).text === 'string'
  );
}

const PACKED_UI_PREVIEW_CHARS = 900;

function PackedTextPreview({ packed }: { packed: unknown }) {
  const [expandedUi, setExpandedUi] = useState(false);
  const packedOk = isPackedText(packed) ? packed : null;
  const text = packedOk?.text ?? '';
  const truncated = packedOk?.truncated ?? false;
  const totalChars = packedOk?.total_chars;

  useEffect(() => {
    setExpandedUi(false);
  }, [text, truncated, totalChars]);

  if (!packedOk) {
    return <span className="text-gray-500">—</span>;
  }

  const total = typeof totalChars === 'number' ? totalChars : text.length;

  if (!text && total === 0) {
    return <span className="text-gray-500">(vazio)</span>;
  }

  const needsUiCollapse = text.length > PACKED_UI_PREVIEW_CHARS;
  const shownText =
    expandedUi || !needsUiCollapse
      ? text
      : `${text.slice(0, PACKED_UI_PREVIEW_CHARS)}…`;

  return (
    <div className="space-y-1">
      <p className="text-[10px] text-gray-500">
        {truncated ? (
          <span className="text-amber-300/90">
            Texto truncado no trace: mostrando {text.length} de {total}{' '}
            caracteres
          </span>
        ) : (
          <span>{total} caracteres</span>
        )}
      </p>
      <pre
        className="max-h-52 overflow-y-auto rounded border border-gray-700/60 bg-black/35 p-2 text-[10px] text-gray-200 whitespace-pre-wrap break-words font-mono leading-snug"
        tabIndex={0}
      >
        {shownText || '(sem texto)'}
      </pre>
      {needsUiCollapse && (
        <button
          type="button"
          className="text-[10px] text-cyan-400/90 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 rounded"
          onClick={() => setExpandedUi((v) => !v)}
          aria-expanded={expandedUi}
        >
          {expandedUi ? 'Recolher texto' : 'Expandir texto completo'}
        </button>
      )}
    </div>
  );
}

function OrchestratorInputSection({ input }: { input: TraceOrchestratorInput }) {
  return (
    <div className="space-y-3">
      {(input.orchestrator_model != null || input.subagent_model != null) && (
        <p className="text-[10px] text-gray-500">
          Modelo orquestrador:{' '}
          <span className="text-gray-300 font-mono">
            {input.orchestrator_model ?? '—'}
          </span>
          {' · '}
          Modelo subagentes:{' '}
          <span className="text-gray-300 font-mono">
            {input.subagent_model ?? '—'}
          </span>
        </p>
      )}
      <div>
        <p className="text-[10px] font-medium text-cyan-600/90 uppercase mb-1">
          System prompt
        </p>
        <PackedTextPreview packed={input.system_prompt} />
      </div>
      <div>
        <p className="text-[10px] font-medium text-cyan-600/90 uppercase mb-1">
          Mensagens (histórico + user)
        </p>
        <ul className="space-y-2">
          {(input.messages ?? []).map((m, i) => (
            <li
              key={i}
              className="rounded border border-gray-700/50 bg-gray-900/40 p-1.5"
            >
              <span className="text-[10px] uppercase text-violet-400/90">
                {m.role ?? '?'}
              </span>
              <PackedTextPreview packed={m.content} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function SubagentOutputsSection({ items }: { items: TraceSubagentOutput[] }) {
  if (!items.length) {
    return (
      <p className="text-[11px] text-gray-500">
        Nenhum subagente registado neste request (sem tools de routing
        disparadas ou trace antigo).
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {items.map((item, idx) => {
        const subTokLine = subagentTokenLine(item.token_usage);
        return (
          <li
            key={`${item.routing_tool}-${idx}`}
            className="rounded border border-emerald-900/40 bg-emerald-950/15 p-2 space-y-2"
          >
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[11px]">
              <span className="font-mono text-emerald-200/95">{item.routing_tool}</span>
              <span className="text-gray-500">→</span>
              <span className="text-gray-300">{item.agent_name}</span>
              {item.iterations != null && (
                <span className="text-[10px] text-gray-500">
                  {item.iterations} iterações · {item.tool_calls_count ?? 0}{' '}
                  tool calls
                </span>
              )}
            </div>
            {item.tool_names && item.tool_names.length > 0 && (
              <p className="text-[10px] text-gray-500 font-mono break-all">
                Tools: {item.tool_names.join(', ')}
              </p>
            )}
            {item.routing_tool_input && isPackedText(item.routing_tool_input) && (
              <details className="text-[10px]">
                <summary className="cursor-pointer text-gray-500 hover:text-gray-400">
                  Input da tool de routing
                </summary>
                <div className="mt-1">
                  <PackedTextPreview packed={item.routing_tool_input} />
                </div>
              </details>
            )}
            {item.error && (
              <p className="text-[10px] text-red-400/90" role="alert">
                {item.error}
              </p>
            )}
            {subTokLine && (
              <p className="text-[10px] text-amber-200/90 font-mono">
                Tokens (subagente): {subTokLine}
              </p>
            )}
            <div>
              <p className="text-[10px] font-medium text-emerald-600/80 uppercase mb-1">
                Resposta do subagente
              </p>
              <PackedTextPreview packed={item.response} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Indica se o pipeline multi-agente (LLM principal) foi executado neste request. */
function wasMainMultiAgentLlmUsed(trace: OrchestratorPipelineTrace): boolean {
  if (typeof trace.main_multi_agent_llm_used === 'boolean') {
    return trace.main_multi_agent_llm_used;
  }
  const spans = trace.spans ?? [];
  if (spans.some((s) => s.name === 'multi_agent_pipeline')) return true;
  return (trace.llm_calls?.length ?? 0) > 0;
}

function MultiAgentSpanSummary({ data }: { data: Record<string, unknown> }) {
  const it = data.orchestrator_iterations;
  const names = data.orchestrator_tool_names;
  const nTools = data.tool_calls;
  const hasIter = typeof it === 'number';
  const hasNames = Array.isArray(names) && names.length > 0;
  const hasToolCount = typeof nTools === 'number';
  if (!hasIter && !hasNames && !hasToolCount) return null;
  return (
    <div className="mb-2 rounded border border-violet-900/40 bg-violet-950/25 px-2 py-1.5 text-[10px] text-violet-100/95 space-y-1">
      <p className="font-semibold text-violet-300/95 uppercase tracking-wide">
        Orquestrador (multi-agente)
      </p>
      {hasIter && (
        <p>
          Iterações LLM: <span className="font-mono">{String(it)}</span>
        </p>
      )}
      {hasToolCount && (
        <p>
          Total de tool calls (orquestrador + routing):{' '}
          <span className="font-mono">{String(nTools)}</span>
        </p>
      )}
      {hasNames && (
        <div>
          <p className="text-gray-400 mb-0.5">Tools observadas (amostra):</p>
          <p className="font-mono text-gray-300 break-all">
            {(names as string[]).join(', ')}
          </p>
        </div>
      )}
    </div>
  );
}

interface OrchestratorTracePanelProps {
  messages: Message[];
  selectedMessageId: string | null;
}

export function OrchestratorTracePanel({
  messages,
  selectedMessageId,
}: OrchestratorTracePanelProps) {
  const { trace, waitingForAgent, hint } = resolveTraceForMessage(
    messages,
    selectedMessageId
  );
  const displayTrace = useMemo(
    () => (trace ? sanitizeTraceForAuditPanel(trace) : null),
    [trace]
  );

  return (
    <aside
      className="w-[min(28rem,48vw)] shrink-0 bg-gray-900 border-l border-gray-700 flex flex-col text-gray-200"
      aria-label="Auditoria: raciocínio e decisões do agente"
    >
      <div className="p-3 border-b border-gray-700">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          Auditoria do agente
        </h2>
        <p className="text-[11px] text-gray-500 mt-1 leading-snug">
          Raciocínio do orquestrador, subagentes e triagem. Toque numa mensagem no
          chat para associar o trace a essa interação.
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-3 text-xs space-y-3">
        {!selectedMessageId && (
          <p className="text-gray-500">Nenhuma mensagem selecionada.</p>
        )}
        {selectedMessageId && waitingForAgent && (
          <p className="text-amber-400/90" role="status">
            Aguardando resposta do agente para exibir o trace desta mensagem
            do paciente…
          </p>
        )}
        {hint && (
          <p className="text-gray-500 italic border-l-2 border-green-700 pl-2">
            {hint}
          </p>
        )}
        {hint && !trace && !waitingForAgent && (
          <p className="text-gray-500 text-[11px]">
            Resposta do agente sem payload de pipeline armazenado (histórico
            anterior ou fallback).
          </p>
        )}
        {selectedMessageId && !waitingForAgent && !trace && hint === null && (
          <p className="text-gray-500">Sem dados de pipeline nesta mensagem.</p>
        )}
        {displayTrace && (
          <>
            <section
              className="rounded-md border border-green-900/45 bg-green-950/20 px-2 py-2 space-y-1.5"
              aria-label="Decisões clínicas e triagem"
            >
              <h3 className="text-[10px] font-semibold text-green-400/95 uppercase tracking-wide">
                Decisões (triagem)
              </h3>
              <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-[11px]">
                <dt className="text-gray-500 shrink-0">Disposição</dt>
                <dd className="font-mono text-green-200/95 break-all">
                  {displayTrace.clinical_disposition ?? '—'}
                </dd>
                <dt className="text-gray-500 shrink-0">Severidade</dt>
                <dd>{displayTrace.overall_severity ?? '—'}</dd>
                <dt className="text-gray-500 shrink-0">Intent (contrato)</dt>
                <dd>{displayTrace.intent ?? '—'}</dd>
              </dl>
            </section>

            <div
              className={`rounded-md px-2 py-1.5 text-[11px] font-medium ${
                wasMainMultiAgentLlmUsed(displayTrace)
                  ? 'bg-emerald-950/80 text-emerald-200 border border-emerald-700/60'
                  : 'bg-gray-800 text-amber-200/90 border border-amber-800/50'
              }`}
              role="status"
            >
              {wasMainMultiAgentLlmUsed(displayTrace) ? (
                <>
                  LLM multi-agente (orquestrador):{' '}
                  <span className="text-emerald-100">disparada</span>
                  {(displayTrace.llm_calls?.length ?? 0) > 0 && (
                    <span className="block mt-0.5 font-normal text-emerald-300/80">
                      {displayTrace.llm_calls?.length} chamada(s) registada(s) no trace
                      (provedor/modelo na secção abaixo).
                    </span>
                  )}
                </>
              ) : (
                <>
                  LLM multi-agente (orquestrador):{' '}
                  <span className="text-amber-100">não disparada</span>
                  <span className="block mt-0.5 font-normal text-amber-200/70">
                    Sem chaves de API LLM no ai-service, fast-path sem LLM, ou
                    resposta só por regras/fallback. A classificação de intent
                    pode ainda usar LLM curto se houver chaves — veja o span
                    &quot;intent_classification&quot;.
                  </span>
                </>
              )}
            </div>

            <section
              className="rounded-md border border-slate-600/50 bg-slate-950/50 px-2 py-2 space-y-1.5"
              aria-label="Provedor e modelo de LLM por etapa"
            >
              <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                LLM neste request
              </h3>
              <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-[11px]">
                <dt className="text-gray-500 shrink-0">Intent</dt>
                <dd className="text-slate-200 break-words">
                  {intentLlmLine(displayTrace.intent_llm)}
                </dd>
                <dt className="text-gray-500 shrink-0">Sintomas</dt>
                <dd className="text-slate-200 break-words">
                  {symptomLlmLine(displayTrace.symptom_llm)}
                </dd>
                {(displayTrace.llm_calls?.length ?? 0) > 0 && (
                  <>
                    <dt className="text-gray-500 shrink-0">Multi-agente</dt>
                    <dd>
                      <ul className="space-y-0.5 text-slate-200">
                        {(displayTrace.llm_calls ?? []).map(
                          (call: Record<string, unknown>, i: number) => (
                            <li key={i} className="font-mono text-[10px] break-all">
                              {String(call.step ?? '—')} —{' '}
                              {String(call.provider ?? '—')} /{' '}
                              {String(call.model ?? '—')}
                              {call.duration_ms != null && (
                                <span className="text-gray-500">
                                  {' '}
                                  ({Number(call.duration_ms)} ms)
                                </span>
                              )}
                              {call.error != null && String(call.error) !== '' && (
                                <span className="text-red-400/90">
                                  {' '}
                                  erro: {String(call.error).slice(0, 80)}
                                </span>
                              )}
                            </li>
                          )
                        )}
                      </ul>
                    </dd>
                  </>
                )}
              </dl>
            </section>

            <TokenUsageSection trace={displayTrace} />

            {(displayTrace.rag_context_output != null ||
              displayTrace.orchestrator_input != null ||
              (displayTrace.subagent_outputs?.length ?? 0) > 0) && (
              <section
                className="rounded-md border border-cyan-900/40 bg-gray-950/80 px-2 py-2 space-y-2"
                aria-label="Detalhe RAG e multi-agente"
              >
                <h3 className="text-[10px] font-semibold text-cyan-500/90 uppercase tracking-wide">
                  RAG e orquestrador
                </h3>

                <details className="group rounded bg-gray-900/60 border border-gray-700/70">
                  <summary className="cursor-pointer px-2 py-1.5 text-[11px] text-gray-200 font-medium list-none [&::-webkit-details-marker]:hidden">
                    Output do contexto RAG
                  </summary>
                  <div className="px-2 pb-2 border-t border-gray-700/50 pt-2">
                    <PackedTextPreview packed={displayTrace.rag_context_output} />
                  </div>
                </details>

                <details className="group rounded bg-gray-900/60 border border-gray-700/70">
                  <summary className="cursor-pointer px-2 py-1.5 text-[11px] text-gray-200 font-medium list-none [&::-webkit-details-marker]:hidden">
                    Input do orquestrador (multi-agente)
                  </summary>
                  <div className="px-2 pb-2 border-t border-gray-700/50 pt-2">
                    {displayTrace.orchestrator_input ? (
                      <OrchestratorInputSection input={displayTrace.orchestrator_input} />
                    ) : (
                      <p className="text-[11px] text-gray-500">
                        Sem dados (ramo sem multi-agente ou trace gravado antes
                        desta versão).
                      </p>
                    )}
                  </div>
                </details>

                <details
                  className="group rounded bg-gray-900/60 border border-gray-700/70"
                >
                  <summary className="cursor-pointer px-2 py-1.5 text-[11px] text-gray-200 font-medium list-none [&::-webkit-details-marker]:hidden">
                    Output dos subagentes (
                    {displayTrace.subagent_outputs?.length ?? 0})
                  </summary>
                  <div className="px-2 pb-2 border-t border-gray-700/50 pt-2">
                    <SubagentOutputsSection
                      items={displayTrace.subagent_outputs ?? []}
                    />
                  </div>
                </details>
              </section>
            )}

            <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1.5 text-[11px]">
              <dt className="text-gray-500">Caminho</dt>
              <dd className="font-mono text-green-300/90">
                {displayTrace.pipeline_path ?? '—'}
              </dd>
              <dt className="text-gray-500">Intent</dt>
              <dd>{displayTrace.intent ?? '—'}</dd>
              {displayTrace.intent_confidence != null && (
                <>
                  <dt className="text-gray-500">Conf. intent</dt>
                  <dd>{Number(displayTrace.intent_confidence).toFixed(2)}</dd>
                </>
              )}
              <dt className="text-gray-500">Duração total</dt>
              <dd>
                {displayTrace.total_duration_ms != null
                  ? `${displayTrace.total_duration_ms} ms`
                  : '—'}
              </dd>
              <dt className="text-gray-500">Disposição</dt>
              <dd className="break-all">
                {displayTrace.clinical_disposition ?? '—'}
              </dd>
              <dt className="text-gray-500">Severidade</dt>
              <dd>{displayTrace.overall_severity ?? '—'}</dd>
              <dt className="text-gray-500">Sintomas (n)</dt>
              <dd>{displayTrace.symptoms_detected ?? '—'}</dd>
            </dl>

            {displayTrace.error && (
              <p className="text-red-400 text-[11px]" role="alert">
                Erro no trace: {displayTrace.error}
              </p>
            )}

            {displayTrace.spans && displayTrace.spans.length > 0 && (
              <section aria-label="Etapas detalhadas do pipeline">
                <h3 className="text-[10px] font-semibold text-gray-500 uppercase mb-2">
                  Etapas (spans)
                </h3>
                <ul className="space-y-1.5">
                  {displayTrace.spans.map((span: OrchestratorPipelineSpan, i: number) => (
                    <li key={`${span.name}-${i}`}>
                      <details className="group rounded bg-gray-800/80 border border-gray-700/80">
                        <summary className="cursor-pointer list-none px-2 py-1.5 flex justify-between gap-2 [&::-webkit-details-marker]:hidden">
                          <span className="text-gray-200">
                            {spanLabel(span.name)}
                          </span>
                          <span className="text-gray-500 shrink-0 font-mono">
                            {span.duration_ms != null
                              ? `${span.duration_ms} ms`
                              : '—'}
                          </span>
                        </summary>
                        {span.data && Object.keys(span.data).length > 0 && (
                          <div className="px-2 pb-2 border-t border-gray-700/50 pt-1">
                            {span.name === 'multi_agent_pipeline' ? (
                              <MultiAgentSpanSummary
                                data={span.data as Record<string, unknown>}
                              />
                            ) : null}
                            <pre className="text-[10px] text-gray-400 overflow-x-auto whitespace-pre-wrap break-all max-h-40 overflow-y-auto">
                              {JSON.stringify(span.data, null, 0)}
                            </pre>
                          </div>
                        )}
                      </details>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {displayTrace.clinical_rules_fired &&
              displayTrace.clinical_rules_fired.length > 0 && (
                <details className="rounded bg-gray-800/50 border border-gray-700/60">
                  <summary className="cursor-pointer px-2 py-1.5 text-[10px] text-gray-400 uppercase">
                    Regras disparadas ({displayTrace.clinical_rules_fired.length})
                  </summary>
                  <ul className="px-2 pb-2 space-y-0.5 font-mono text-[10px] text-amber-200/80">
                    {displayTrace.clinical_rules_fired.map((id: string) => (
                      <li key={id}>{id}</li>
                    ))}
                  </ul>
                </details>
              )}

            {displayTrace.llm_calls && displayTrace.llm_calls.length > 0 && (
              <details className="rounded bg-gray-800/50 border border-gray-700/60">
                <summary className="cursor-pointer px-2 py-1.5 text-[10px] text-gray-400 uppercase">
                  Chamadas LLM ({displayTrace.llm_calls.length})
                </summary>
                <ul className="px-2 pb-2 space-y-1">
                  {displayTrace.llm_calls.map((call: Record<string, unknown>, i: number) => (
                    <li
                      key={i}
                      className="font-mono text-[10px] text-gray-400 break-all"
                    >
                      {JSON.stringify(call)}
                    </li>
                  ))}
                </ul>
              </details>
            )}

            {displayTrace.subagents_called && displayTrace.subagents_called.length > 0 && (
              <p className="text-[10px] text-gray-500">
                Subagentes:{' '}
                <span className="text-gray-300">
                  {displayTrace.subagents_called.join(', ')}
                </span>
              </p>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
