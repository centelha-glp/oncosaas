'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { PatientListConnected } from '@/components/dashboard/patient-list-connected';
import { AlertsPanel } from '@/components/dashboard/alerts-panel';
import { ConversationView } from '@/components/dashboard/conversation-view';
import { PatientDetails } from '@/components/dashboard/patient-details';
import { AlertDetails } from '@/components/dashboard/alert-details';
import { ResizablePanel } from '@/components/dashboard/resizable-panel';
import { usePatient } from '@/hooks/usePatients';
import {
  useMessages,
  useSendMessage,
  useAssumeMessage,
} from '@/hooks/useMessages';
import { useMessagesSocket } from '@/hooks/useMessagesSocket';
import { useAlert } from '@/hooks/useAlerts';
import { Button } from '@/components/ui/button';
import { Alert } from '@/lib/api/alerts';
import { NavigationBar } from '@/components/shared/navigation-bar';
import { KPICards } from '@/components/dashboard/oncologist/kpi-cards';
import { MetricsCharts } from '@/components/dashboard/oncologist/metrics-charts';
import { CriticalAlertsPanel } from '@/components/dashboard/oncologist/critical-alerts-panel';
import { TeamPerformance } from '@/components/dashboard/oncologist/team-performance';
import { CriticalStepsSection } from '@/components/dashboard/oncologist/critical-steps-section';
import { ROISection } from '@/components/dashboard/oncologist/roi-section';
import { ExecutiveView } from '@/components/dashboard/oncologist/executive-view';
import { CriticalTimelinesSection } from '@/components/dashboard/oncologist/critical-timelines-section';

import {
  useDashboardMetrics,
  useDashboardStatistics,
} from '@/hooks/useDashboardMetrics';
import { useDashboardSocket } from '@/hooks/useDashboardSocket';
import { Calendar, RefreshCw } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { mapPriorityToDisplay } from '@/lib/utils/priority';
import {
  getPatientCancerType,
  getPatientAllCancerTypes,
} from '@/lib/utils/patient-cancer-type';
import { ChartDrillDownModal } from '@/components/dashboard/shared/chart-drill-down-modal';
import type { PeriodFilter } from '@/components/dashboard/shared/chart-filters';

/** API só aceita 7d/30d/90d; "Todos" nos gráficos = janela máxima (90d). */
function toStatisticsApiPeriod(p: PeriodFilter): '7d' | '30d' | '90d' {
  return p === 'all' ? '90d' : p;
}

// Componente do Dashboard Específico para Enfermeiros
import { NurseSpecificDashboard } from '@/components/dashboard/nurse/nurse-specific-dashboard';

// Componente do Dashboard de Enfermagem (legado - manter para compatibilidade)
function NursingDashboard() {
  const { isAuthenticated } = useAuthStore();
  const [selectedPatient, setSelectedPatient] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('patient');
    }
    return null;
  });
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [isNursingActive, setIsNursingActive] = useState(false);
  const [activeTab, setActiveTab] = useState<'patients' | 'alerts'>('patients');

  const { data: selectedPatientData, isLoading: isLoadingPatient } = usePatient(
    selectedPatient || '',
    { enabled: !!selectedPatient }
  );
  const { data: messages } = useMessages(selectedPatient || undefined);
  const { data: alertDetails, isLoading: isLoadingAlert } = useAlert(
    selectedAlert?.id || ''
  );

  const displayAlert = alertDetails || selectedAlert;
  useMessagesSocket(selectedPatient || undefined);

  const sendMessageMutation = useSendMessage();
  const assumeMessageMutation = useAssumeMessage();

  const conversationId =
    messages && messages.length > 0 ? messages[0].conversationId : undefined;

  const handleSendMessage = async (content: string) => {
    if (!selectedPatient) return;

    try {
      await sendMessageMutation.mutateAsync({
        patientId: selectedPatient,
        content,
        conversationId: conversationId || undefined,
      });
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
    }
  };

  const handleTakeOver = async () => {
    if (!selectedPatient || !messages || messages.length === 0) return;

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
      } catch (error) {
        console.error('Erro ao assumir conversa:', error);
      }
    } else {
      setIsNursingActive(true);
    }
  };

  return (
    <div className="h-screen bg-gray-50 overflow-hidden flex flex-col">
      <NavigationBar />

      <div className="flex-1 overflow-hidden">
        <div className="flex h-full">
          <ResizablePanel
            defaultWidth={320}
            minWidth={250}
            maxWidth={500}
            storageKey="dashboard-left-panel-width"
            side="left"
          >
            <div className="h-full flex flex-col bg-white border-r">
              <div className="p-4 border-b flex-shrink-0">
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => setActiveTab('patients')}
                    className={`px-4 py-2 rounded-md font-semibold transition-colors ${
                      activeTab === 'patients'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Pacientes
                  </button>
                  <button
                    onClick={() => setActiveTab('alerts')}
                    className={`px-4 py-2 rounded-md font-semibold transition-colors ${
                      activeTab === 'alerts'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Alertas
                  </button>
                </div>

                {activeTab === 'patients' && (
                  <div>
                    <input
                      type="text"
                      placeholder="Buscar paciente..."
                      className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-4 min-h-0">
                {activeTab === 'patients' ? (
                  <PatientListConnected onPatientSelect={setSelectedPatient} />
                ) : (
                  <AlertsPanel
                    onAlertSelect={setSelectedAlert}
                    selectedAlertId={selectedAlert?.id}
                  />
                )}
              </div>
            </div>
          </ResizablePanel>

          <div className="flex-1 min-w-0 h-full">
            {selectedPatient ? (
              isLoadingPatient ? (
                <div className="bg-white h-full flex items-center justify-center text-gray-500">
                  <p>Carregando dados do paciente...</p>
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
                      sender: msg.direction === 'INBOUND' ? 'patient' : 'agent',
                      content: msg.content || '',
                      timestamp: new Date(
                        msg.whatsappTimestamp || msg.createdAt
                      ),
                    }))}
                    structuredData={{
                      symptoms: {},
                    }}
                    onSendMessage={handleSendMessage}
                    onTakeOver={handleTakeOver}
                    isNursingActive={isNursingActive}
                    isSending={sendMessageMutation.isPending}
                  />
                </div>
              ) : (
                <div className="bg-white h-full flex flex-col items-center justify-center text-gray-500">
                  <p className="text-lg mb-2">Erro ao carregar paciente</p>
                  <p className="text-sm">
                    Não foi possível carregar os dados do paciente selecionado
                  </p>
                </div>
              )
            ) : (
              <div className="bg-white h-full flex flex-col items-center justify-center text-gray-500">
                <p className="text-lg mb-2">Selecione um paciente</p>
                <p className="text-sm">
                  Escolha um paciente da lista para ver a conversa
                </p>
              </div>
            )}
          </div>

          <ResizablePanel
            defaultWidth={360}
            minWidth={280}
            maxWidth={600}
            storageKey="dashboard-right-panel-width"
            side="right"
          >
            <div className="h-full overflow-y-auto flex flex-col">
              <div className="border-b">
                <PatientDetails
                  patient={selectedPatientData || null}
                  isLoading={isLoadingPatient}
                />
              </div>

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

// Componente do Dashboard Gerencial (Oncologistas)
function ManagementDashboard() {
  const router = useRouter();
  const { user, isAuthenticated, isInitializing } = useAuthStore();
  const [statisticsPeriod, setStatisticsPeriod] = useState<
    '7d' | '30d' | '90d'
  >('7d');
  const [activeTab, setActiveTab] = useState<'gerencial' | 'enfermeira'>(
    'gerencial'
  );

  // Estado do modal de drill-down
  const [drillDownModal, setDrillDownModal] = useState<{
    open: boolean;
    filterType:
      | 'priority'
      | 'cancerType'
      | 'journeyStage'
      | 'alerts'
      | 'messages'
      | 'overdueSteps'
      | 'biomarkers'
      | null;
    filterValue: string | null;
    title: string;
    description?: string;
  }>({
    open: false,
    filterType: null,
    filterValue: null,
    title: '',
  });

  // Autenticação: o pai `DashboardPage` já chama `initialize()` — evita GET /auth/profile duplicado.

  const {
    data: metrics,
    isLoading: isLoadingMetrics,
    error: metricsError,
    refetch: refetchMetrics,
  } = useDashboardMetrics();
  const {
    data: statistics,
    isLoading: isLoadingStatistics,
    error: statisticsError,
  } = useDashboardStatistics(statisticsPeriod);

  useDashboardSocket();

  if (!isAuthenticated || !user) {
    return null;
  }

  const handlePatientClick = (patientId: string) => {
    router.push(`/patients/${patientId}`);
  };

  const handleAlertSelect = (alert: Alert) => {
    if (alert.patientId) {
      handlePatientClick(alert.patientId);
    }
  };

  const handlePriorityFilter = (category: string | null) => {
    if (!category) {
      router.push('/patients');
      return;
    }
    router.push(`/patients?priority=${encodeURIComponent(category)}`);
  };

  const handleKPICardClick = (
    filterType: string,
    filterValue?: string | Record<string, unknown>,
    cardTitle?: string
  ) => {
    if (!filterType) return;

    const filterValueStr = typeof filterValue === 'string' ? filterValue : null;
    const validFilterType = filterType as
      | 'priority'
      | 'cancerType'
      | 'journeyStage'
      | 'alerts'
      | 'messages'
      | 'overdueSteps'
      | 'biomarkers';

    const titleByFilterType: Record<string, string> = {
      priority: filterValueStr
        ? `Pacientes — prioridade ${filterValueStr}`
        : cardTitle || 'Pacientes por prioridade',
      cancerType: filterValueStr
        ? `Pacientes — ${filterValueStr}`
        : cardTitle || 'Pacientes por tipo de câncer',
      journeyStage: filterValueStr
        ? `Pacientes — ${filterValueStr}`
        : cardTitle || 'Pacientes por estágio',
      alerts: cardTitle || 'Alertas Pendentes',
      messages: cardTitle || 'Mensagens Não Assumidas',
      overdueSteps: cardTitle || 'Etapas Atrasadas',
      biomarkers: cardTitle || 'Biomarcadores Pendentes',
    };

    const descriptionByFilterType: Record<string, string> = {
      priority:
        'Pacientes filtrados por prioridade. Clique em um paciente para ver detalhes.',
      cancerType:
        'Pacientes filtrados por tipo de câncer. Clique em um paciente para ver detalhes.',
      journeyStage:
        'Pacientes filtrados por estágio da jornada. Clique em um paciente para ver detalhes.',
      alerts:
        'Lista de alertas pendentes. Clique em um alerta para abrir o paciente.',
      messages:
        'Pacientes com mensagens não assumidas. Clique em um paciente para ver detalhes.',
      overdueSteps: 'Pacientes com pelo menos uma etapa de navegação atrasada.',
      biomarkers:
        'Pacientes com biomarcadores pendentes. Clique em um paciente para ver detalhes.',
    };

    setDrillDownModal({
      open: true,
      filterType: validFilterType,
      filterValue: filterValueStr,
      title: cardTitle || titleByFilterType[filterType] || 'Pacientes',
      description:
        descriptionByFilterType[filterType] ||
        'Clique em um paciente para ver detalhes',
    });
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-gray-100">
      <NavigationBar />

      <main className="flex-1 p-6 overflow-y-auto">
        <div className="container mx-auto space-y-6">
          {/* Tabs para alternar entre visões */}
          <Tabs
            value={activeTab}
            onValueChange={(value) =>
              setActiveTab(value as 'gerencial' | 'enfermeira')
            }
            className="w-full"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
                <TabsList>
                  <TabsTrigger value="gerencial">Gerencial</TabsTrigger>
                  <TabsTrigger value="enfermeira">Enfermeira</TabsTrigger>
                </TabsList>
              </div>
              {activeTab === 'gerencial' && (
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <select
                      value={statisticsPeriod}
                      onChange={(e) =>
                        setStatisticsPeriod(
                          e.target.value as '7d' | '30d' | '90d'
                        )
                      }
                      className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                    >
                      <option value="7d">Últimos 7 dias</option>
                      <option value="30d">Últimos 30 dias</option>
                      <option value="90d">Últimos 90 dias</option>
                    </select>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetchMetrics()}
                    disabled={isLoadingMetrics}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Atualizar
                  </Button>
                </div>
              )}
            </div>

            {/* Conteúdo da aba Gerencial */}
            <TabsContent value="gerencial" className="space-y-6">
              {/* Mensagens de erro */}
              {(metricsError || statisticsError) && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h3 className="text-red-800 font-semibold mb-2">
                    Erro ao carregar dados
                  </h3>
                  {metricsError && (
                    <p className="text-red-600 text-sm">
                      Métricas:{' '}
                      {metricsError instanceof Error
                        ? metricsError.message
                        : 'Erro desconhecido'}
                    </p>
                  )}
                  {statisticsError && (
                    <p className="text-red-600 text-sm">
                      Estatísticas:{' '}
                      {statisticsError instanceof Error
                        ? statisticsError.message
                        : 'Erro desconhecido'}
                    </p>
                  )}
                </div>
              )}

              {/* Loading state */}
              {(isLoadingMetrics || isLoadingStatistics) &&
                !metrics &&
                !statistics && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-blue-800">
                      Carregando dados do dashboard...
                    </p>
                  </div>
                )}

              {/* Alertas Críticos */}
              {metrics && metrics.criticalAlertsCount > 0 && (
                <CriticalAlertsPanel onAlertSelect={handleAlertSelect} />
              )}

              {/* KPI Cards - sempre mostrar se houver dados ou loading */}
              {isLoadingMetrics ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className="bg-white rounded-lg border p-6 h-32 animate-pulse"
                    >
                      <div className="h-4 bg-gray-200 rounded w-2/3 mb-2"></div>
                      <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  ))}
                </div>
              ) : metricsError ? (
                <div className="bg-white rounded-lg border p-6">
                  <p className="text-gray-500 text-center">
                    Erro ao carregar métricas. Tente novamente.
                  </p>
                </div>
              ) : metrics ? (
                <KPICards
                  metrics={metrics}
                  isLoading={false}
                  onCardClick={handleKPICardClick}
                />
              ) : (
                <div className="bg-white rounded-lg border p-6">
                  <p className="text-gray-500 text-center">
                    Aguardando dados do dashboard...
                  </p>
                </div>
              )}

              {/* Pacientes com Etapas Críticas - abaixo dos indicadores, acima dos gráficos */}
              {metrics && metrics.overdueStepsCount > 0 && (
                <CriticalStepsSection maxResults={10} />
              )}

              {/* Gráficos de Métricas */}
              {isLoadingMetrics || isLoadingStatistics ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {[...Array(4)].map((_, i) => (
                    <div
                      key={i}
                      className="bg-white rounded-lg border p-6 h-80 animate-pulse"
                    >
                      <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
                      <div className="h-full bg-gray-100 rounded"></div>
                    </div>
                  ))}
                </div>
              ) : metrics && statistics ? (
                <MetricsCharts
                  metrics={metrics}
                  statistics={statistics}
                  isLoading={false}
                  onPriorityFilter={handlePriorityFilter}
                  onPeriodChange={(period) =>
                    setStatisticsPeriod(toStatisticsApiPeriod(period))
                  }
                  currentPeriod={statisticsPeriod}
                />
              ) : metricsError || statisticsError ? (
                <div className="bg-white rounded-lg border p-6">
                  <p className="text-gray-500 text-center">
                    Não foi possível carregar os gráficos. Verifique os erros
                    acima.
                  </p>
                </div>
              ) : null}

              {/* Performance da Equipe */}
              {isLoadingMetrics || isLoadingStatistics ? (
                <div className="bg-white rounded-lg border p-6 animate-pulse">
                  <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="h-24 bg-gray-100 rounded"></div>
                    ))}
                  </div>
                </div>
              ) : metrics && statistics ? (
                <TeamPerformance
                  metrics={metrics}
                  statistics={statistics}
                  isLoading={false}
                />
              ) : null}

              {/* Visão Executiva */}
              {metrics && statistics && (
                <ExecutiveView metrics={metrics} statistics={statistics} />
              )}

              {/* Seção de ROI */}
              {metrics && statistics && (
                <ROISection metrics={metrics} statistics={statistics} />
              )}

              {/* Seção de Prazos Críticos por Tipo de Câncer */}
              <CriticalTimelinesSection />
            </TabsContent>

            {/* Conteúdo da aba Enfermeira */}
            <TabsContent value="enfermeira" className="mt-0 -m-6 p-0">
              <div className="w-full">
                <NurseSpecificDashboard hideNavigationBar={true} />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Modal de drill-down dos KPI cards */}
      <ChartDrillDownModal
        open={drillDownModal.open}
        onOpenChange={(open) =>
          setDrillDownModal((prev) => ({ ...prev, open }))
        }
        filterType={drillDownModal.filterType}
        filterValue={drillDownModal.filterValue}
        title={drillDownModal.title}
        description={drillDownModal.description}
      />
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, isInitializing, initialize } = useAuthStore();

  // Inicializar autenticação do localStorage
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Verificar autenticação (após inicialização)
  useEffect(() => {
    if (!isInitializing && !isAuthenticated) {
      router.replace('/login');
      return;
    }
  }, [isAuthenticated, isInitializing, router]);

  // Mostrar loading durante inicialização
  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  // Detectar role e renderizar dashboard apropriado
  const isManagementRole =
    user.role === 'ONCOLOGIST' ||
    user.role === 'ADMIN' ||
    user.role === 'COORDINATOR';

  if (isManagementRole) {
    return <ManagementDashboard />;
  }

  // Dashboard específico para NURSE
  if (user.role === 'NURSE') {
    return <NurseSpecificDashboard />;
  }

  // Dashboard de enfermagem para outros roles (NURSE_CHIEF, etc.)
  return <NursingDashboard />;
}
