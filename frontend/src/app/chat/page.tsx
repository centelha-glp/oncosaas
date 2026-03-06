'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { useDebounce } from '@/lib/utils/use-debounce';
import {
  saveFiltersToStorage,
  loadFiltersFromStorage,
  clearFiltersFromStorage,
  PatientFilters,
} from '@/lib/utils/filter-storage';
import { PatientListConnected } from '@/components/dashboard/patient-list-connected';
import { AlertsPanel } from '@/components/dashboard/alerts-panel';
import { DecisionLogPanel } from '@/components/chat';
import { ConversationView } from '@/components/dashboard/conversation-view';
import { PatientDetails } from '@/components/dashboard/patient-details';
import { AlertDetails } from '@/components/dashboard/alert-details';
import { ResizablePanel } from '@/components/dashboard/resizable-panel';
import { usePatient, usePatients } from '@/hooks/usePatients';
import {
  useMessages,
  useUnassumedPatientIds,
  useSendMessage,
  useAssumeMessage,
} from '@/hooks/useMessages';
import { usePendingDecisions } from '@/hooks/useConversations';
import { useReadPatients } from '@/hooks/useReadPatients';
import { conversationsApi } from '@/lib/api/conversations';
import { useMessagesSocket } from '@/hooks/useMessagesSocket';
import { useAlert, useCriticalAlertsCount } from '@/hooks/useAlerts';
import { Button } from '@/components/ui/button';
import { Bell, X } from 'lucide-react';
import { Alert } from '@/lib/api/alerts';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { User, MessageSquare } from 'lucide-react';
import { NavigationBar } from '@/components/shared/navigation-bar';
import { mapPriorityToDisplay } from '@/lib/utils/priority';
import { getPatientAllCancerTypes } from '@/lib/utils/patient-cancer-type';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

export default function ChatPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isAuthenticated, isInitializing, initialize } = useAuthStore();
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [isNursingActive, setIsNursingActive] = useState(false);
  const [isReturningToAgent, setIsReturningToAgent] = useState(false);
  const [activeTab, setActiveTab] = useState<
    'patients' | 'alerts' | 'decisions'
  >('patients');
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Filtros
  const [priorityFilter, setPriorityFilter] = useState<
    'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | null
  >(null);
  const [cancerTypeFilter, setCancerTypeFilter] = useState<string>('');
  const [unreadOnlyFilter, setUnreadOnlyFilter] = useState(false);
  const [alertsSeverityFilter, setAlertsSeverityFilter] = useState<
    'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | null
  >(null);

  const { data: unassumedPatientIds } = useUnassumedPatientIds();
  const { data: criticalAlertsCount } = useCriticalAlertsCount();
  const { data: pendingDecisionsRaw } = usePendingDecisions();
  const pendingDecisions = Array.isArray(pendingDecisionsRaw)
    ? pendingDecisionsRaw
    : [];
  const displayablePendingCount = pendingDecisions.filter(
    (d) =>
      d &&
      d.requiresApproval &&
      !d.approvedAt &&
      !d.rejected
  ).length;
  const { readPatientIds, markAsRead } = useReadPatients();

  // Unread = não assumidas E ainda não abertas (não lidas)
  // Ler = abrir a conversa. Assumir = clicar no botão.
  const unreadPatientIdsSet =
    unassumedPatientIds?.patientIds && readPatientIds
      ? new Set(
          unassumedPatientIds.patientIds.filter((id) => !readPatientIds.has(id))
        )
      : undefined;

  // Marcar como lida ao abrir a conversa (apenas visualizar - NÃO assumir)
  useEffect(() => {
    if (selectedPatient) {
      markAsRead(selectedPatient);
    }
  }, [selectedPatient, markAsRead]);
  const { data: patients } = usePatients();

  // Obter tipos de câncer únicos para o dropdown
  const uniqueCancerTypes = Array.from(
    new Set(
      patients
        ?.flatMap((p) => getPatientAllCancerTypes(p))
        .filter((type): type is string => !!type) || []
    )
  ).sort();

  // Inicializar autenticação do localStorage
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Verificar autenticação e obter paciente da URL (após inicialização)
  useEffect(() => {
    if (!isInitializing) {
      if (!isAuthenticated) {
        router.replace('/login');
        return;
      }

      // Obter paciente da query string
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const patientId = params.get('patient');
        if (patientId) {
          setSelectedPatient(patientId);
        }
      }
    }
  }, [isAuthenticated, isInitializing, router]);

  const { data: selectedPatientData, isLoading: isLoadingPatient } = usePatient(
    selectedPatient || '',
    { enabled: !!selectedPatient }
  );
  const { data: messages } = useMessages(selectedPatient || undefined);
  const { data: alertDetails, isLoading: isLoadingAlert } = useAlert(
    selectedAlert?.id || ''
  );

  // Usar alertDetails se disponível, senão usar selectedAlert (dados básicos)
  const displayAlert = alertDetails || selectedAlert;

  // WebSocket para atualizações em tempo real
  useMessagesSocket(selectedPatient || undefined);

  // Hooks para ações
  const sendMessageMutation = useSendMessage();
  const assumeMessageMutation = useAssumeMessage();

  // Obter conversationId da primeira mensagem (se existir)
  const conversationId =
    messages && messages.length > 0
      ? messages[messages.length - 1].conversationId
      : undefined;

  // Encontrar mensagem assumida mais recente para mostrar quem assumiu
  const assumedMessage = messages
    ?.filter((msg) => msg.assumedBy && msg.assumedAt)
    .sort(
      (a, b) =>
        new Date(b.assumedAt!).getTime() - new Date(a.assumedAt!).getTime()
    )[0];

  // Determinar se a conversa está ativa para o usuário atual
  const isConversationAssumedByCurrentUser =
    assumedMessage?.assumedBy === user?.id;

  // Atualizar isNursingActive baseado na mensagem assumida
  useEffect(() => {
    if (assumedMessage && isConversationAssumedByCurrentUser) {
      setIsNursingActive(true);
    } else if (!assumedMessage) {
      setIsNursingActive(false);
    }
  }, [assumedMessage?.id, isConversationAssumedByCurrentUser]);

  // Carregar filtros do localStorage ao montar o componente
  useEffect(() => {
    const savedFilters = loadFiltersFromStorage();
    if (savedFilters) {
      setSearchTerm(savedFilters.searchTerm || '');
      setPriorityFilter(savedFilters.priorityCategory || null);
      setCancerTypeFilter(savedFilters.cancerType || '');
    }
  }, []);

  // Salvar filtros no localStorage sempre que mudarem
  useEffect(() => {
    const filtersToSave: PatientFilters = {
      searchTerm,
      priorityCategory: priorityFilter,
      cancerType: cancerTypeFilter,
    };
    saveFiltersToStorage(filtersToSave);
  }, [searchTerm, priorityFilter, cancerTypeFilter]);

  // Função para limpar todos os filtros
  const handleClearFilters = () => {
    setSearchTerm('');
    setPriorityFilter(null);
    setCancerTypeFilter('');
    setUnreadOnlyFilter(false);
    clearFiltersFromStorage();
  };

  // F1: Extract structured symptom data from the most recent message that has it
  const latestStructuredData = (() => {
    const msgWithData = messages
      ?.filter((m) => {
        const d = m.structuredData as
          | { symptoms?: Record<string, number> }
          | null
          | undefined;
        return d?.symptoms && Object.keys(d.symptoms).length > 0;
      })
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0];
    if (!msgWithData?.structuredData) return undefined;
    const d = msgWithData.structuredData as {
      symptoms: Record<string, number>;
      scales?: Record<string, number>;
    };
    return { symptoms: d.symptoms, scales: d.scales };
  })();

  // Nome do usuário que assumiu (se for o usuário atual, usar o nome dele)
  const assumedByName =
    assumedMessage?.assumedBy === user?.id
      ? user?.name || 'Você'
      : assumedMessage?.assumedBy
        ? 'Outro usuário'
        : null;

  const handleSendMessage = async (content: string) => {
    if (!selectedPatient) return;

    try {
      await sendMessageMutation.mutateAsync({
        patientId: selectedPatient,
        content,
        conversationId: conversationId || undefined,
      });
    } catch (error) {
      toast.error('Erro ao enviar mensagem', {
        description:
          error instanceof Error
            ? error.message
            : 'Tente novamente em alguns instantes.',
      });
    }
  };

  const handleTakeOver = async () => {
    if (!selectedPatient || !messages || messages.length === 0) return;

    // Assumir a última mensagem não assumida do paciente
    const unassumedMessage = messages
      .filter((msg) => !msg.assumedBy && msg.direction === 'INBOUND')
      .sort(
        (a, b) =>
          new Date(b.whatsappTimestamp).getTime() -
          new Date(a.whatsappTimestamp).getTime()
      )[0];

    if (unassumedMessage) {
      try {
        await assumeMessageMutation.mutateAsync(unassumedMessage.id);
        setIsNursingActive(true);
        toast.success('Conversa assumida com sucesso');
      } catch (error) {
        toast.error('Erro ao assumir conversa', {
          description:
            error instanceof Error
              ? error.message
              : 'Tente novamente em alguns instantes.',
        });
      }
    } else {
      // Se não há mensagens não assumidas, apenas ativar modo manual
      setIsNursingActive(true);
    }
  };

  const handleReturnToAgent = async () => {
    if (!conversationId || isReturningToAgent) return;

    setIsReturningToAgent(true);
    try {
      await conversationsApi.returnToAgent(conversationId);
      setIsNursingActive(false);
      queryClient.invalidateQueries({ queryKey: ['messages', selectedPatient ?? ''] });
      queryClient.invalidateQueries({ queryKey: ['messages', 'unassumed', 'count'] });
      toast.success('Conversa devolvida para a IA');
    } catch (error) {
      toast.error('Erro ao devolver conversa para a IA', {
        description:
          error instanceof Error
            ? error.message
            : 'Tente novamente em alguns instantes.',
      });
    } finally {
      setIsReturningToAgent(false);
    }
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="h-8 w-8 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
          <p className="text-sm text-gray-500">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="h-screen bg-gray-50 overflow-hidden flex flex-col">
      <NavigationBar />

      <div className="flex-1 overflow-hidden">
        <div className="flex h-full">
          {/* Sidebar Esquerda - Pacientes e Alertas */}
          <ResizablePanel
            defaultWidth={320}
            minWidth={250}
            maxWidth={500}
            storageKey="chat-left-panel-width"
            side="left"
          >
            <div className="h-full flex flex-col bg-white border-r">
              {/* Header fixo com tabs */}
              <div className="p-4 border-b flex-shrink-0">
                {/* Tabs para alternar entre Pacientes e Alertas */}
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => setActiveTab('patients')}
                    className={`relative px-4 py-2 rounded-md font-semibold transition-colors ${
                      activeTab === 'patients'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Pacientes
                    {unreadPatientIdsSet && unreadPatientIdsSet.size > 0 ? (
                      <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white leading-none">
                        {unreadPatientIdsSet.size > 99
                          ? '99+'
                          : unreadPatientIdsSet.size}
                      </span>
                    ) : null}
                  </button>
                  <button
                    onClick={() => setActiveTab('alerts')}
                    className={`relative px-4 py-2 rounded-md font-semibold transition-colors ${
                      activeTab === 'alerts'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Alertas
                    {criticalAlertsCount && criticalAlertsCount.count > 0 ? (
                      <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white leading-none">
                        {criticalAlertsCount.count > 99
                          ? '99+'
                          : criticalAlertsCount.count}
                      </span>
                    ) : null}
                  </button>
                  <button
                    onClick={() => setActiveTab('decisions')}
                    className={`relative px-4 py-2 rounded-md font-semibold transition-colors ${
                      activeTab === 'decisions'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Decisões pendentes
                    {displayablePendingCount > 0 ? (
                      <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white leading-none">
                        {displayablePendingCount > 99
                          ? '99+'
                          : displayablePendingCount}
                      </span>
                    ) : null}
                  </button>
                </div>

                {/* Campo de busca e Filtros (apenas para Pacientes) */}
                {activeTab === 'patients' && (
                  <div className="space-y-3">
                    {/* Campo de busca */}
                    <div>
                      <input
                        type="text"
                        placeholder="Buscar paciente (nome ou CPF)..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    {/* Filtros */}
                    <div className="space-y-2">
                      {/* Filtro por Prioridade */}
                      <div>
                        <label className="text-xs font-semibold text-gray-600 mb-1 block">
                          Prioridade
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map(
                            (priority) => (
                              <button
                                key={priority}
                                onClick={() =>
                                  setPriorityFilter(
                                    priorityFilter === priority
                                      ? null
                                      : priority
                                  )
                                }
                                className={`px-2 py-1 text-xs rounded-md transition-colors ${
                                  priorityFilter === priority
                                    ? priority === 'CRITICAL'
                                      ? 'bg-red-600 text-white'
                                      : priority === 'HIGH'
                                        ? 'bg-orange-600 text-white'
                                        : priority === 'MEDIUM'
                                          ? 'bg-yellow-600 text-white'
                                          : 'bg-gray-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                              >
                                {priority === 'CRITICAL'
                                  ? 'Crítico'
                                  : priority === 'HIGH'
                                    ? 'Alto'
                                    : priority === 'MEDIUM'
                                      ? 'Médio'
                                      : 'Baixo'}
                              </button>
                            )
                          )}
                          {priorityFilter && (
                            <button
                              onClick={() => setPriorityFilter(null)}
                              className="px-2 py-1 text-xs rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 flex items-center gap-1"
                            >
                              <X className="h-3 w-3" />
                              Limpar
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Filtro Não lidas */}
                      <div>
                        <label className="text-xs font-semibold text-gray-600 mb-1 block">
                          Conversas
                        </label>
                        <button
                          onClick={() => setUnreadOnlyFilter(!unreadOnlyFilter)}
                          className={`flex items-center gap-2 px-3 py-2 w-full text-left rounded-md transition-colors ${
                            unreadOnlyFilter
                              ? 'bg-indigo-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          <MessageSquare className="h-4 w-4" />
                          <span className="text-sm">
                            Não lidas
                            {unreadPatientIdsSet && unreadPatientIdsSet.size > 0 && (
                              <span className="ml-1 opacity-80">
                                ({unreadPatientIdsSet.size})
                              </span>
                            )}
                          </span>
                        </button>
                      </div>

                      {/* Filtro por Tipo de Câncer */}
                      {uniqueCancerTypes.length > 0 && (
                        <div>
                          <label className="text-xs font-semibold text-gray-600 mb-1 block">
                            Tipo de Câncer
                          </label>
                          <select
                            value={cancerTypeFilter}
                            onChange={(e) =>
                              setCancerTypeFilter(e.target.value)
                            }
                            className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            <option value="">Todos os tipos</option>
                            {uniqueCancerTypes.map((type) => (
                              <option key={type} value={type}>
                                {type}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Indicador de filtros ativos */}
                      {(priorityFilter || cancerTypeFilter || unreadOnlyFilter) && (
                        <div className="pt-2 border-t">
                          <button
                            onClick={handleClearFilters}
                            className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                          >
                            <X className="h-3 w-3" />
                            Limpar todos os filtros
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Conteúdo da aba ativa */}
              <div className="flex-1 overflow-y-auto p-4 min-h-0">
                {activeTab === 'patients' ? (
                  <PatientListConnected
                    onPatientSelect={setSelectedPatient}
                    filters={{
                      searchTerm: debouncedSearchTerm,
                      priorityCategory: priorityFilter || undefined,
                      cancerType: cancerTypeFilter || undefined,
                      unreadOnly: unreadOnlyFilter,
                      unreadPatientIds: unreadPatientIdsSet,
                    }}
                    selectedPatientId={selectedPatient}
                    onClearFilters={handleClearFilters}
                  />
                ) : activeTab === 'alerts' ? (
                  <AlertsPanel
                    onAlertSelect={(alert) => {
                      // Selecionar o alerta para mostrar detalhes
                      setSelectedAlert(alert);
                      // Também selecionar o paciente para abrir a conversa
                      if (alert.patientId) {
                        setSelectedPatient(alert.patientId);
                        // Mudar para aba de pacientes para mostrar a conversa
                        setActiveTab('patients');
                      }
                    }}
                    selectedAlertId={selectedAlert?.id}
                    severityFilter={alertsSeverityFilter}
                  />
                ) : (
                  <DecisionLogPanel
                    decisions={pendingDecisions}
                    showPendingOnly
                    onDecisionSelect={(decision) => {
                      if (decision.patientId) {
                        setSelectedPatient(decision.patientId);
                        setActiveTab('patients');
                      }
                    }}
                  />
                )}
              </div>
            </div>
          </ResizablePanel>

          {/* Área Principal - Conversa */}
          <div className="flex-1 min-w-0 h-full">
            {selectedPatient ? (
              isLoadingPatient ? (
                <div className="bg-white h-full border-x flex flex-col">
                  {/* Header skeleton */}
                  <div className="border-b p-4">
                    <Skeleton className="h-7 w-48 mb-2" />
                    <Skeleton className="h-4 w-64" />
                  </div>
                  {/* Messages skeleton */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className="max-w-[70%] rounded-lg p-3 bg-gray-100">
                          <Skeleton className="h-3 w-16 mb-2" />
                          <Skeleton className="h-4 w-48 mb-1" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Input skeleton */}
                  <div className="border-t p-4">
                    <div className="flex gap-2">
                      <Skeleton className="h-10 flex-1" />
                      <Skeleton className="h-10 w-20" />
                    </div>
                  </div>
                </div>
              ) : selectedPatientData ? (
                <div className="bg-white h-full border-x">
                  <ConversationView
                    conversationId={conversationId || null}
                    patientName={selectedPatientData.name}
                    patientInfo={{
                      cancerType:
                        getPatientAllCancerTypes(selectedPatientData).join(
                          ', '
                        ) || 'Em Rastreio',
                      stage:
                        selectedPatientData.cancerDiagnoses?.[0]?.stage ||
                        selectedPatientData.stage ||
                        'N/A',
                      age: selectedPatientData.birthDate
                        ? new Date().getFullYear() -
                          new Date(selectedPatientData.birthDate).getFullYear()
                        : 0,
                      priorityScore: selectedPatientData.priorityScore || 0,
                      priorityCategory: mapPriorityToDisplay(
                        selectedPatientData.priorityCategory || 'MEDIUM'
                      ),
                    }}
                    messages={(messages || []).map((msg) => ({
                      id: msg.id,
                      sender:
                        msg.direction === 'INBOUND'
                          ? 'patient'
                          : msg.processedBy === 'NURSING'
                            ? 'nursing'
                            : 'agent',
                      content: msg.content || '',
                      timestamp: new Date(
                        msg.whatsappTimestamp || msg.createdAt
                      ),
                      type: msg.type?.toLowerCase() as
                        | 'text'
                        | 'audio'
                        | undefined,
                      audioUrl: msg.audioUrl ?? undefined,
                    }))}
                    structuredData={latestStructuredData}
                    onSendMessage={handleSendMessage}
                    onTakeOver={handleTakeOver}
                    onReturnToAgent={handleReturnToAgent}
                    isReturningToAgent={isReturningToAgent}
                    isNursingActive={
                      isNursingActive || isConversationAssumedByCurrentUser
                    }
                    isSending={sendMessageMutation.isPending}
                    assumedBy={assumedByName}
                    assumedAt={
                      assumedMessage?.assumedAt
                        ? new Date(assumedMessage.assumedAt)
                        : null
                    }
                  />
                </div>
              ) : (
                <EmptyState
                  icon={<User className="h-12 w-12 text-red-500" />}
                  title="Erro ao carregar paciente"
                  description="Não foi possível carregar os dados do paciente selecionado. Tente selecionar novamente."
                  action={
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.location.reload()}
                    >
                      Recarregar página
                    </Button>
                  }
                  className="h-full"
                />
              )
            ) : (
              <EmptyState
                icon={<MessageSquare className="h-12 w-12 text-gray-400" />}
                title="Selecione um paciente"
                description="Escolha um paciente da lista ao lado para visualizar e gerenciar a conversa."
                className="h-full"
              />
            )}
          </div>

          {/* Sidebar Direita - Detalhes do Paciente e Alerta */}
          <ResizablePanel
            defaultWidth={360}
            minWidth={280}
            maxWidth={600}
            storageKey="chat-right-panel-width"
            side="right"
          >
            <div className="h-full overflow-y-auto flex flex-col">
              {/* Detalhes do Paciente */}
              <div className="border-b">
                <PatientDetails
                  patient={selectedPatientData || null}
                  isLoading={isLoadingPatient}
                />
              </div>

              {/* Detalhes do Alerta */}
              <div className="flex-1">
                <AlertDetails
                  alert={displayAlert}
                  isLoading={isLoadingAlert && !!selectedAlert}
                  onClose={() => setSelectedAlert(null)}
                />
              </div>
            </div>
          </ResizablePanel>
        </div>
      </div>
    </div>
  );
}
