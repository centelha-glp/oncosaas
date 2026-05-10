'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { usePatients } from '@/hooks/usePatients';
import { useMessages } from '@/hooks/useMessages';
import { useMessagesSocket } from '@/hooks/useMessagesSocket';
import { apiClient } from '@/lib/api/client';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Send, Smartphone, ArrowLeft, MessageSquare } from 'lucide-react';

export default function TestePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isAuthenticated, isInitializing, initialize } = useAuthStore();
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: patients } = usePatients();
  const { data: messages } = useMessages(selectedPatient || undefined);

  // WebSocket para atualizações em tempo real
  useMessagesSocket(selectedPatient || undefined);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (!isInitializing && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, isInitializing, router]);

  // Scroll automático para última mensagem
  useEffect(() => {
    if (messages && messages.length > 0 && messagesEndRef.current) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [messages]);

  const selectedPatientData = patients?.find((p) => p.id === selectedPatient);

  const handleSendAsPatient = async () => {
    if (!selectedPatient || !messageInput.trim() || isSending) return;

    setIsSending(true);
    try {
      // Buscar conversationId da mensagem mais recente (evita usar conversa antiga)
      const conversationId =
        messages && messages.length > 0
          ? messages[messages.length - 1].conversationId
          : undefined;

      // O simulador /teste deve priorizar resposta do agente.
      // Se a conversa estiver em NURSING, devolvemos para AGENT antes de enviar.
      if (conversationId) {
        try {
          await apiClient.patch(
            `/agent/conversations/${conversationId}/return-to-agent`,
            {}
          );
        } catch {
          // Se falhar, seguimos com envio; backend pode criar/usar outra conversa.
        }
      }

      // Enviar como INBOUND para simular mensagem do paciente via WhatsApp
      await apiClient.post('/messages', {
        patientId: selectedPatient,
        conversationId: conversationId || undefined,
        whatsappMessageId: `sim_${crypto.randomUUID()}`,
        whatsappTimestamp: new Date().toISOString(),
        type: 'TEXT',
        direction: 'INBOUND',
        content: messageInput,
        processedBy: 'AGENT',
      });

      setMessageInput('');
      // Invalidar para buscar dados atualizados
      queryClient.invalidateQueries({
        queryKey: ['messages', selectedPatient],
      });
      queryClient.invalidateQueries({
        queryKey: ['messages', 'unassumed', 'count'],
      });

      // Fallback: refetch após 5s para capturar resposta do agente caso
      // o evento WebSocket message_sent não chegue (conexão instável, etc.)
      const patientForRefetch = selectedPatient;
      setTimeout(() => {
        queryClient.invalidateQueries({
          queryKey: ['messages', patientForRefetch],
        });
      }, 5000);
    } catch {
      // Silently handle error for now
    } finally {
      setIsSending(false);
    }
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="h-8 w-8 rounded-full border-4 border-green-500 border-t-transparent animate-spin" />
          <p className="text-sm text-gray-400">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="h-screen bg-gray-900 flex flex-col">
      {/* Header - WhatsApp-like */}
      <div className="bg-green-700 text-white px-4 py-3 flex items-center gap-3">
        <Smartphone className="h-5 w-5" />
        <div className="flex-1">
          <h1 className="text-sm font-bold">
            Simulador de Paciente (WhatsApp)
          </h1>
          <p className="text-xs text-green-200">
            Envie mensagens como se fosse o paciente
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/chat')}
          className="text-white hover:bg-green-600 gap-1.5"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao Chat
        </Button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Patient selector */}
        <div className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col">
          <div className="p-3 border-b border-gray-700">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
              Selecione um paciente
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            {patients?.map((patient) => (
              <button
                key={patient.id}
                onClick={() => setSelectedPatient(patient.id)}
                className={`w-full text-left px-4 py-3 border-b border-gray-700 transition-colors ${
                  selectedPatient === patient.id
                    ? 'bg-green-900/40 border-l-2 border-l-green-500'
                    : 'hover:bg-gray-700/50'
                }`}
              >
                <div className="text-sm font-medium text-gray-200">
                  {patient.name}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {patient.cancerType || 'N/A'} &middot;{' '}
                  {patient.currentStage || 'N/A'}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col">
          {selectedPatient && selectedPatientData ? (
            <>
              {/* Chat header */}
              <div className="bg-gray-800 px-4 py-3 border-b border-gray-700 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center text-white font-bold text-sm">
                  {selectedPatientData.name
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')}
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-200">
                    {selectedPatientData.name}
                  </div>
                  <div className="text-xs text-gray-400">
                    Simulando como paciente
                  </div>
                </div>
              </div>

              {/* Messages - WhatsApp-like background */}
              <div
                className="flex-1 overflow-y-auto p-4 space-y-2"
                style={{
                  backgroundImage:
                    "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23374151' fill-opacity='0.15'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
                  backgroundColor: '#0b141a',
                }}
              >
                {!messages || messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center text-gray-500">
                      <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">Nenhuma mensagem ainda</p>
                      <p className="text-xs mt-1">
                        Envie uma mensagem como paciente
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    {messages.map((msg) => {
                      const isPatient = msg.direction === 'INBOUND';
                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isPatient ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[70%] rounded-lg px-3 py-2 ${
                              isPatient
                                ? 'bg-green-800 text-green-50'
                                : 'bg-gray-700 text-gray-200'
                            }`}
                          >
                            <div className="text-xs font-semibold mb-0.5 opacity-70">
                              {isPatient
                                ? 'Voce (Paciente)'
                                : msg.processedBy === 'NURSING'
                                  ? 'Enfermagem'
                                  : 'Agente IA'}
                            </div>
                            <div className="text-sm whitespace-pre-wrap break-words">
                              {msg.content}
                            </div>
                            <div className="text-xs opacity-50 mt-1 text-right">
                              {format(
                                new Date(
                                  msg.whatsappTimestamp || msg.createdAt
                                ),
                                'HH:mm',
                                { locale: ptBR }
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Input area */}
              <div className="bg-gray-800 p-3 border-t border-gray-700">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === 'Enter' &&
                      !e.shiftKey &&
                      !isSending &&
                      handleSendAsPatient()
                    }
                    placeholder="Digite a mensagem do paciente..."
                    className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-full text-sm text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <Button
                    onClick={handleSendAsPatient}
                    size="sm"
                    disabled={!messageInput.trim() || isSending}
                    className="rounded-full h-10 w-10 p-0 bg-green-600 hover:bg-green-700"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-gray-900">
              <div className="text-center text-gray-500">
                <Smartphone className="h-16 w-16 mx-auto mb-4 opacity-30" />
                <h2 className="text-lg font-medium text-gray-400">
                  Simulador de Paciente
                </h2>
                <p className="text-sm mt-2 max-w-sm">
                  Selecione um paciente na barra lateral para simular o envio de
                  mensagens via WhatsApp. As mensagens aparecem em tempo real na
                  tela de chat da enfermagem.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
