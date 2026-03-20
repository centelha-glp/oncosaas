'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Bot,
  AlertTriangle,
  MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  useApproveDecision,
  useRejectDecision,
} from '@/hooks/useConversations';
import type { AgentDecisionLog } from '@/lib/api/conversations';

interface DecisionLogPanelProps {
  decisions: AgentDecisionLog[];
  showPendingOnly?: boolean;
  className?: string;
  onDecisionSelect?: (decision: AgentDecisionLog) => void;
}

const DECISION_TYPE_LABELS: Record<string, string> = {
  SYMPTOM_DETECTED: 'Sintoma detectado',
  RESPONSE_GENERATED: 'Resposta gerada',
  ALERT_CREATED: 'Alerta criado',
  CRITICAL_ESCALATION: 'Escalação crítica',
  QUESTIONNAIRE_SCORED: 'Questionário pontuado',
  CHECK_IN_SCHEDULED: 'Check-in agendado',
  APPLY_QUESTIONNAIRE: 'Questionário iniciado',
};

function DecisionItem({
  decision,
  onSelect,
}: {
  decision: AgentDecisionLog;
  onSelect?: (decision: AgentDecisionLog) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const approve = useApproveDecision();
  const reject = useRejectDecision();

  const isPending =
    decision.requiresApproval && !decision.approvedAt && !decision.rejected;
  const isApproved = decision.approvedAt && !decision.rejected;
  const isRejected = decision.rejected;

  const typeLabel =
    DECISION_TYPE_LABELS[decision.decisionType] || decision.decisionType;
  const confidence = decision.confidence
    ? `${Math.round(decision.confidence * 100)}%`
    : null;

  return (
    <div
      className={cn(
        'rounded-lg border p-3',
        isPending && 'border-amber-200 bg-amber-50',
        isApproved && 'border-green-200 bg-green-50',
        isRejected && 'border-red-100 bg-red-50',
        !isPending && !isApproved && !isRejected && 'border-gray-100 bg-gray-50'
      )}
    >
      <div className="flex items-start gap-2">
        <Bot className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-800">
              {typeLabel}
            </span>
            {confidence && (
              <span className="text-xs text-gray-400">({confidence})</span>
            )}
            {isPending && (
              <span className="ml-auto flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                <Clock className="h-3 w-3" />
                Aguarda aprovação
              </span>
            )}
            {isApproved && (
              <span className="ml-auto flex items-center gap-1 text-[10px] text-green-600">
                <CheckCircle2 className="h-3 w-3" />
                Aprovado
              </span>
            )}
            {isRejected && (
              <span className="ml-auto flex items-center gap-1 text-[10px] text-red-600">
                <XCircle className="h-3 w-3" />
                Rejeitado
              </span>
            )}
          </div>

          <p className="mt-0.5 text-xs text-gray-600 line-clamp-2">
            {decision.reasoning}
          </p>

          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-1 flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
          >
            {expanded ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
            {expanded ? 'Menos detalhes' : 'Mais detalhes'}
          </button>

          {expanded && (
            <div className="mt-2 rounded border border-gray-200 bg-white p-2 text-xs">
              <p className="font-medium text-gray-600">Ação executada:</p>
              <pre className="mt-1 overflow-auto text-gray-500">
                {JSON.stringify(decision.outputAction, null, 2)}
              </pre>
            </div>
          )}

          {isPending && (
            <div className="mt-2 flex flex-wrap gap-2">
              {!showRejectInput ? (
                <>
                  <Button
                    size="sm"
                    className="h-7 bg-green-600 text-xs hover:bg-green-700"
                    onClick={() => approve.mutate(decision.id)}
                    disabled={approve.isPending}
                  >
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    Aprovar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 border-red-300 text-xs text-red-600 hover:bg-red-50"
                    onClick={() => setShowRejectInput(true)}
                  >
                    <XCircle className="mr-1 h-3 w-3" />
                    Rejeitar
                  </Button>
                </>
              ) : (
                <div className="flex w-full flex-col gap-1.5">
                  <input
                    type="text"
                    placeholder="Motivo da rejeição..."
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    className="h-7 w-full rounded border border-gray-300 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-400"
                    autoFocus
                  />
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      className="h-6 bg-red-600 text-xs hover:bg-red-700"
                      onClick={() => {
                        reject.mutate({
                          id: decision.id,
                          reason: rejectReason,
                        });
                        setShowRejectInput(false);
                      }}
                      disabled={reject.isPending || !rejectReason.trim()}
                    >
                      Confirmar rejeição
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-xs"
                      onClick={() => {
                        setShowRejectInput(false);
                        setRejectReason('');
                      }}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {onSelect && decision.patientId && (
            <Button
              size="sm"
              variant="ghost"
              className="mt-2 h-7 text-xs text-indigo-600 hover:bg-indigo-50"
              onClick={() => onSelect(decision)}
            >
              <MessageSquare className="mr-1 h-3 w-3" />
              Ver conversa
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function DecisionLogPanel({
  decisions,
  showPendingOnly = false,
  className,
  onDecisionSelect,
}: DecisionLogPanelProps) {
  const filtered = showPendingOnly
    ? decisions.filter(
        (d) => d.requiresApproval && !d.approvedAt && !d.rejected
      )
    : decisions;

  const pendingCount = decisions.filter(
    (d) => d.requiresApproval && !d.approvedAt && !d.rejected
  ).length;

  if (filtered.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center gap-2 py-6 text-center',
          className
        )}
      >
        <Bot className="h-8 w-8 text-gray-300" />
        <p className="text-sm text-gray-400">
          {showPendingOnly
            ? 'Nenhuma decisão aguarda aprovação'
            : 'Nenhuma decisão registrada'}
        </p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      {pendingCount > 0 && !showPendingOnly && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <span className="text-sm font-medium text-amber-700">
            {pendingCount} decisão{pendingCount > 1 ? 'ões' : ''} aguardando
            aprovação
          </span>
        </div>
      )}

      {filtered.map((decision) => (
        <DecisionItem
          key={decision.id}
          decision={decision}
          onSelect={onDecisionSelect}
        />
      ))}
    </div>
  );
}
