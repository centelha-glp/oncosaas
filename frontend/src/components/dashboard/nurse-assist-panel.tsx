'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Sparkles,
  Copy,
  Check,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import type {
  NurseAssistResponse,
  SuggestedReply,
  SuggestedAction,
} from '@/lib/api/conversations';

interface NurseAssistPanelProps {
  data: NurseAssistResponse | null;
  isLoading: boolean;
  onRequest: () => void;
  onUseSuggestion: (text: string) => void;
}

const PRIORITY_STYLES: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-700 border-red-300',
  HIGH: 'bg-orange-100 text-orange-700 border-orange-300',
  MEDIUM: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  LOW: 'bg-green-100 text-green-700 border-green-300',
};

function SuggestionCard({
  reply,
  onUse,
}: {
  reply: SuggestedReply;
  onUse: (text: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(reply.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border rounded-lg p-2.5 bg-white hover:border-indigo-300 transition-colors">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold text-indigo-600">
          {reply.label}
        </span>
        <div className="flex gap-1">
          <button
            onClick={handleCopy}
            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
            title="Copiar"
          >
            {copied ? (
              <Check className="h-3 w-3 text-green-500" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </button>
        </div>
      </div>
      <p className="text-xs text-gray-700 leading-relaxed mb-2">
        {reply.text}
      </p>
      <Button
        size="sm"
        variant="outline"
        className="w-full text-xs h-7 border-indigo-200 text-indigo-600 hover:bg-indigo-50"
        onClick={() => onUse(reply.text)}
      >
        Usar esta resposta
      </Button>
    </div>
  );
}

function ActionCard({ action }: { action: SuggestedAction }) {
  const style = PRIORITY_STYLES[action.priority] || PRIORITY_STYLES.MEDIUM;

  return (
    <div className="flex items-start gap-2 p-2 rounded-lg bg-white border">
      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-amber-500" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-xs font-medium text-gray-800">
            {action.action}
          </span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold border ${style}`}
          >
            {action.priority}
          </span>
        </div>
        <p className="text-[11px] text-gray-500">{action.reason}</p>
      </div>
    </div>
  );
}

export function NurseAssistPanel({
  data,
  isLoading,
  onRequest,
  onUseSuggestion,
}: NurseAssistPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!data && !isLoading) {
    return (
      <div className="border-t bg-gradient-to-r from-indigo-50 to-purple-50 p-3">
        <Button
          onClick={onRequest}
          size="sm"
          variant="outline"
          className="w-full gap-2 border-indigo-200 text-indigo-700 hover:bg-indigo-100"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Assistente IA para Enfermeiro
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="border-t bg-gradient-to-r from-indigo-50 to-purple-50 p-4">
        <div className="flex items-center justify-center gap-2 text-indigo-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm font-medium">
            Analisando conversa com IA...
          </span>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="border-t bg-gradient-to-r from-indigo-50 to-purple-50">
      {/* Header */}
      <div className="flex items-center justify-between p-2.5 px-3">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1.5 text-sm font-semibold text-indigo-700 hover:text-indigo-900"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Assistente IA
          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronUp className="h-3.5 w-3.5" />
          )}
        </button>
        <div className="flex items-center gap-2">
          {data.used_llm && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-600 font-medium">
              LLM
            </span>
          )}
          <button
            onClick={onRequest}
            className="p-1 rounded hover:bg-indigo-100 text-indigo-400 hover:text-indigo-600"
            title="Atualizar sugestões"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="px-3 pb-3 space-y-3">
          {/* Summary */}
          {data.summary && (
            <div className="bg-white rounded-lg p-2.5 border">
              <h4 className="text-[10px] uppercase tracking-wide font-semibold text-gray-500 mb-1">
                Resumo
              </h4>
              <p className="text-xs text-gray-700 leading-relaxed">
                {data.summary}
              </p>
            </div>
          )}

          {/* Suggested Replies */}
          {data.suggested_replies.length > 0 && (
            <div>
              <h4 className="text-[10px] uppercase tracking-wide font-semibold text-gray-500 mb-1.5">
                Sugestões de Resposta
              </h4>
              <div className="grid gap-2">
                {data.suggested_replies.map((reply, i) => (
                  <SuggestionCard
                    key={i}
                    reply={reply}
                    onUse={onUseSuggestion}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Suggested Actions */}
          {data.suggested_actions.length > 0 && (
            <div>
              <h4 className="text-[10px] uppercase tracking-wide font-semibold text-gray-500 mb-1.5">
                Ações Recomendadas
              </h4>
              <div className="space-y-1.5">
                {data.suggested_actions.map((action, i) => (
                  <ActionCard key={i} action={action} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
