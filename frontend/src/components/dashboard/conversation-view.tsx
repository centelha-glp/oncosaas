'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { EmptyState } from '@/components/ui/empty-state';
import { MessageSquare, Send, UserCheck, HandshakeIcon } from 'lucide-react';

interface Message {
  id: string;
  sender: 'agent' | 'patient' | 'nursing';
  content: string;
  timestamp: Date;
  type?: 'text' | 'audio';
  audioUrl?: string;
}

interface ConversationViewProps {
  patientName: string;
  patientInfo: {
    cancerType: string;
    stage: string;
    age: number;
    priorityScore: number;
    priorityCategory: string;
  };
  messages: Message[];
  structuredData?: {
    symptoms: Record<string, number>;
    scales?: Record<string, number>;
  };
  onSendMessage: (message: string) => void;
  onTakeOver: () => void;
  isNursingActive: boolean;
  isSending?: boolean;
  assumedBy?: string | null; // Nome do usuário que assumiu a conversa
  assumedAt?: Date | null; // Data/hora em que foi assumida
}

export function ConversationView({
  patientName,
  patientInfo,
  messages,
  structuredData,
  onSendMessage,
  onTakeOver,
  isNursingActive,
  isSending = false,
  assumedBy,
  assumedAt,
}: ConversationViewProps) {
  const [messageInput, setMessageInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll automático para última mensagem quando:
  // 1. Mensagens mudarem (nova mensagem recebida)
  // 2. Componente montar (abrir conversa)
  useEffect(() => {
    if (messages.length > 0 && messagesEndRef.current) {
      // Pequeno delay para garantir que o DOM foi atualizado
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [messages.length]); // Re-executar quando número de mensagens mudar

  const handleSend = () => {
    if (messageInput.trim()) {
      onSendMessage(messageInput);
      setMessageInput('');
    }
  };

  const getSenderLabel = (sender: string) => {
    switch (sender) {
      case 'agent':
        return '🤖 Agente';
      case 'patient':
        return '👤 Paciente';
      case 'nursing':
        return '👩‍⚕️ Enfermagem';
      default:
        return '❓';
    }
  };

  const priorityBadgeClass = (category: string) => {
    switch (category.toLowerCase()) {
      case 'critico':
      case 'critical':
        return 'bg-red-100 text-red-700 border border-red-300';
      case 'alto':
      case 'high':
        return 'bg-orange-100 text-orange-700 border border-orange-300';
      case 'medio':
      case 'medium':
        return 'bg-yellow-100 text-yellow-700 border border-yellow-300';
      default:
        return 'bg-green-100 text-green-700 border border-green-300';
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b p-3 flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base font-semibold truncate">{patientName}</h2>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${priorityBadgeClass(patientInfo.priorityCategory)}`}
            >
              {patientInfo.priorityCategory.toUpperCase()} · {patientInfo.priorityScore}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {patientInfo.cancerType}
            {patientInfo.stage ? ` · ${patientInfo.stage}` : ''}
            {patientInfo.age ? ` · ${patientInfo.age} anos` : ''}
          </p>
        </div>

        {/* Status e botão Assumir no header */}
        {assumedBy && assumedAt ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-green-100 border border-green-300 rounded-md flex-shrink-0">
            <UserCheck className="h-3.5 w-3.5 text-green-700" />
            <div className="text-xs">
              <span className="font-semibold text-green-800">{assumedBy}</span>
              <span className="text-green-600 ml-1">
                {format(new Date(assumedAt), "HH:mm", { locale: ptBR })}
              </span>
            </div>
          </div>
        ) : (
          !isNursingActive && (
            <Button
              onClick={onTakeOver}
              size="sm"
              variant="outline"
              className="flex-shrink-0 gap-1.5 border-indigo-300 text-indigo-700 hover:bg-indigo-50"
            >
              <HandshakeIcon className="h-3.5 w-3.5" />
              Assumir
            </Button>
          )
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <EmptyState
            icon={<MessageSquare className="h-12 w-12 text-gray-400" />}
            title="Nenhuma mensagem ainda"
            description={
              isNursingActive
                ? 'Comece a conversa enviando uma mensagem ao paciente.'
                : 'Assuma a conversa para começar a trocar mensagens com o paciente.'
            }
            className="h-full"
          />
        ) : (
          <>
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender === 'patient' ? 'justify-start' : 'justify-end'}`}
              >
                <div
                  className={`max-w-[70%] rounded-lg p-3 ${
                    message.sender === 'patient'
                      ? 'bg-gray-100'
                      : message.sender === 'agent'
                        ? 'bg-blue-100'
                        : 'bg-green-100'
                  }`}
                >
                  <div className="text-xs font-semibold mb-1">
                    {getSenderLabel(message.sender)}
                  </div>
                  <div className="text-sm">{message.content}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {format(new Date(message.timestamp), 'dd/MM/yyyy HH:mm', {
                      locale: ptBR,
                    })}
                  </div>
                </div>
              </div>
            ))}
            {/* Elemento invisível para scroll automático */}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Structured Data */}
      {structuredData && (
        <div className="border-t p-4 bg-gray-50">
          <h3 className="font-semibold mb-2">Dados Estruturados Extraídos</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {Object.entries(structuredData.symptoms).map(([key, value]) => (
              <div key={key}>
                <span className="font-medium">{key}:</span> {value}/10
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t p-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && !isSending && handleSend()}
            placeholder={
              isNursingActive
                ? 'Digite sua mensagem...'
                : 'Assuma a conversa para enviar mensagens'
            }
            disabled={!isNursingActive || isSending}
            className="flex-1 px-3 py-2 border rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <Button
            onClick={handleSend}
            size="sm"
            disabled={!isNursingActive || !messageInput.trim() || isSending}
            className="gap-1.5"
          >
            <Send className="h-3.5 w-3.5" />
            {isSending ? 'Enviando...' : 'Enviar'}
          </Button>
        </div>
      </div>
    </div>
  );
}
