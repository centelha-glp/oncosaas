'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { NavigationBar } from '@/components/shared/navigation-bar';
import { NurseMetricsPanel } from './nurse-metrics-panel';
import { NavigationMetricsPanel } from './navigation-metrics-panel';
import { PatientsCriticalStepsList } from './patients-critical-steps-list';
import { ShiftChecklist } from './shift-checklist';
import { ResizablePanel } from '@/components/dashboard/resizable-panel';
import { PatientDetails } from '@/components/dashboard/patient-details';
import { usePatient } from '@/hooks/usePatients';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { InternalNotes } from './internal-notes';
import { InterventionHistory } from './intervention-history';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertsPanel } from '@/components/dashboard/alerts-panel';
import { CriticalAlertsPanel } from '@/components/dashboard/oncologist/critical-alerts-panel';
import { Alert } from '@/lib/api/alerts';
import {
  ChevronUp,
  ChevronDown,
  User,
  Minimize2,
  Maximize2,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type RightPanelTab = 'details' | 'notes' | 'interventions';
type LeftPanelTab = 'patients' | 'alerts';

interface NurseSpecificDashboardProps {
  hideNavigationBar?: boolean;
}

export function NurseSpecificDashboard({
  hideNavigationBar = false,
}: NurseSpecificDashboardProps) {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);
  const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>('details');
  const [leftPanelTab, setLeftPanelTab] = useState<LeftPanelTab>('patients');
  const [isLeftPanelMinimized, setIsLeftPanelMinimized] = useState(true);
  const [isRightPanelMinimized, setIsRightPanelMinimized] = useState(true);
  const [isPanelMaximized, setIsPanelMaximized] = useState(false);
  const metricsContainerRef = useRef<HTMLDivElement>(null);
  const [metricsContainerHeight, setMetricsContainerHeight] = useState<
    number | undefined
  >(undefined);
  const [maxPanelWidth, setMaxPanelWidth] = useState<number>(1000);

  const {
    data: selectedPatientData,
    isLoading: isLoadingPatient,
    error: patientError,
  } = usePatient(selectedPatient || '', { enabled: !!selectedPatient });

  // Calcular altura dinâmica do container de métricas
  useEffect(() => {
    const updateHeight = () => {
      if (metricsContainerRef.current) {
        if (hideNavigationBar) {
          // Quando usado dentro de abas, não limitar altura - permitir scroll natural
          setMetricsContainerHeight(undefined);
        } else {
          const navBar = document.querySelector('nav');
          const navBarHeight = navBar?.offsetHeight || 0;
          const availableHeight = window.innerHeight - navBarHeight;
          // Máximo de 50% da altura disponível, mínimo de 200px
          const maxHeight = Math.max(200, Math.min(availableHeight * 0.5, 600));
          setMetricsContainerHeight(maxHeight);
        }
      }
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, [hideNavigationBar]);

  // Calcular largura máxima do painel (90% da tela)
  useEffect(() => {
    const updateMaxWidth = () => {
      const screenWidth = window.innerWidth;
      const maxWidth = Math.floor(screenWidth * 0.9);
      setMaxPanelWidth(maxWidth);
    };

    updateMaxWidth();
    window.addEventListener('resize', updateMaxWidth);
    return () => window.removeEventListener('resize', updateMaxWidth);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, router]);

  const handleTabChange = (value: string) => {
    // Validação de tipo seguro
    if (value === 'details' || value === 'notes' || value === 'interventions') {
      setRightPanelTab(value);
    }
  };

  const handleAlertSelect = (alert: Alert) => {
    setSelectedPatient(alert.patientId);
  };

  const toggleLeftPanelMinimize = () => {
    const newState = !isLeftPanelMinimized;
    // Minimizar ambos os painéis juntos
    setIsLeftPanelMinimized(newState);
    setIsRightPanelMinimized(newState);
    // Se estiver minimizando, desmaximizar também
    if (newState) {
      setIsPanelMaximized(false);
    }
  };

  const togglePanelMaximize = () => {
    setIsPanelMaximized((prev) => !prev);
  };

  const toggleRightPanelMinimize = () => {
    const newState = !isRightPanelMinimized;
    // Minimizar ambos os painéis juntos
    setIsLeftPanelMinimized(newState);
    setIsRightPanelMinimized(newState);
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div
      className={cn(
        'bg-gray-50 flex flex-col relative',
        hideNavigationBar ? 'min-h-full w-full' : 'h-screen overflow-hidden'
      )}
    >
      {!hideNavigationBar && <NavigationBar />}

      <div
        className={cn(
          'flex-1 flex flex-col min-h-0',
          hideNavigationBar ? 'overflow-y-auto' : 'overflow-hidden',
          isLeftPanelMinimized ? 'relative' : ''
        )}
      >
        {/* Métricas no topo - altura dinâmica calculada */}
        {!isLeftPanelMinimized && (
          <div
            ref={metricsContainerRef}
            className={cn(
              'flex-shrink-0 bg-white border-b',
              hideNavigationBar ? 'overflow-visible' : 'overflow-y-auto'
            )}
            style={
              hideNavigationBar
                ? undefined
                : {
                    maxHeight: metricsContainerHeight
                      ? `${metricsContainerHeight}px`
                      : '50vh',
                  }
            }
          >
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h1 className="text-xl font-bold text-gray-900">
                  Dashboard de Navegação Oncológica
                </h1>
                <div className="flex gap-2">
                  <ShiftChecklist type="start" />
                  <ShiftChecklist type="end" />
                </div>
              </div>

              {/* Alertas Críticos */}
              <CriticalAlertsPanel onAlertSelect={handleAlertSelect} />

              {/* Métricas operacionais */}
              <div className="mb-4">
                <NurseMetricsPanel />
              </div>

              {/* Métricas de navegação oncológica */}
              <NavigationMetricsPanel />
            </div>
          </div>
        )}

        {/* Métricas expandidas quando painéis minimizados */}
        {isLeftPanelMinimized && (
          <div className="flex-1 overflow-y-auto bg-white pb-16">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h1 className="text-xl font-bold text-gray-900">
                  Dashboard de Navegação Oncológica
                </h1>
                <div className="flex gap-2">
                  <ShiftChecklist type="start" />
                  <ShiftChecklist type="end" />
                </div>
              </div>

              {/* Alertas Críticos */}
              <CriticalAlertsPanel onAlertSelect={handleAlertSelect} />

              {/* Métricas operacionais */}
              <div className="mb-4">
                <NurseMetricsPanel />
              </div>

              {/* Métricas de navegação oncológica */}
              <NavigationMetricsPanel />
            </div>
          </div>
        )}

        {/* Layout de 2 painéis: Lista de pacientes + Detalhes - apenas renderiza quando não minimizado */}
        {!isLeftPanelMinimized && (
          <>
            {/* Quando maximizado, renderizar painel unificado ocupando tela inteira */}
            {isPanelMaximized ? (
              <div className="fixed top-0 left-0 right-0 bottom-0 z-[100] bg-white flex flex-row h-full w-full">
                {/* Botões de controle no canto superior direito */}
                <div className="fixed top-4 right-4 z-[101] flex gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={togglePanelMaximize}
                    className="h-8 w-8 bg-white hover:bg-gray-100 border border-gray-200 shadow-sm"
                    title="Restaurar tamanho"
                  >
                    <Minimize2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleLeftPanelMinimize}
                    className="h-8 w-8 bg-white hover:bg-gray-100 border border-gray-200 shadow-sm"
                    title="Minimizar painéis para o fundo"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </div>

                {/* Painel unificado: Lista de pacientes + Detalhes */}
                <div className="flex h-full w-full">
                  {/* Seção esquerda: Lista de pacientes ou Alertas */}
                  <div className="w-[600px] flex-shrink-0 border-r bg-white flex flex-col">
                    <Tabs
                      value={leftPanelTab}
                      onValueChange={(v) =>
                        setLeftPanelTab(v as LeftPanelTab)
                      }
                      className="flex-1 flex flex-col overflow-hidden"
                    >
                      <div className="flex-shrink-0 border-b px-4 pt-3 pb-2">
                        <TabsList className="grid w-full grid-cols-2">
                          <TabsTrigger value="patients">
                            <User className="h-4 w-4 mr-2" />
                            Pacientes
                          </TabsTrigger>
                          <TabsTrigger value="alerts">
                            <AlertTriangle className="h-4 w-4 mr-2" />
                            Alertas
                          </TabsTrigger>
                        </TabsList>
                      </div>
                      <div className="flex-1 overflow-hidden min-h-0">
                        <TabsContent
                          value="patients"
                          className="h-full m-0 overflow-hidden"
                        >
                          <PatientsCriticalStepsList
                            onPatientSelect={setSelectedPatient}
                            selectedPatientId={selectedPatient}
                            onMinimize={toggleLeftPanelMinimize}
                            onMaximize={togglePanelMaximize}
                            isMaximized={isPanelMaximized}
                            hideButtons={true}
                          />
                        </TabsContent>
                        <TabsContent
                          value="alerts"
                          className="h-full m-0 overflow-y-auto p-4"
                        >
                          <AlertsPanel onAlertSelect={handleAlertSelect} />
                        </TabsContent>
                      </div>
                    </Tabs>
                  </div>

                  {/* Seção direita: Detalhes do paciente */}
                  <div className="flex-1 min-w-0 overflow-hidden relative">
                    <div className="h-full flex flex-col bg-white overflow-hidden">
                      {selectedPatient ? (
                        <>
                          {patientError && (
                            <div className="p-4 bg-red-50 border-b border-red-200 text-red-700 text-sm">
                              Erro ao carregar dados do paciente. Tente
                              novamente.
                            </div>
                          )}
                          <Tabs
                            value={rightPanelTab}
                            onValueChange={handleTabChange}
                            className="flex-1 flex flex-col overflow-hidden min-h-0"
                          >
                            <div className="border-b px-4 pt-4 flex-shrink-0">
                              <TabsList className="grid w-full grid-cols-3">
                                <TabsTrigger value="details">
                                  Detalhes
                                </TabsTrigger>
                                <TabsTrigger value="notes">Notas</TabsTrigger>
                                <TabsTrigger value="interventions">
                                  Histórico
                                </TabsTrigger>
                              </TabsList>
                            </div>

                            <TabsContent
                              value="details"
                              className="flex-1 overflow-y-auto m-0 min-h-0"
                            >
                              <PatientDetails
                                patient={selectedPatientData || null}
                                isLoading={isLoadingPatient}
                              />
                            </TabsContent>

                            <TabsContent
                              value="notes"
                              className="flex-1 overflow-y-auto m-0 p-4 min-h-0"
                            >
                              <InternalNotes patientId={selectedPatient} />
                            </TabsContent>

                            <TabsContent
                              value="interventions"
                              className="flex-1 overflow-y-auto m-0 p-4 min-h-0"
                            >
                              <InterventionHistory
                                patientId={selectedPatient}
                              />
                            </TabsContent>
                          </Tabs>
                        </>
                      ) : (
                        <div className="flex-1 flex items-center justify-center text-muted-foreground">
                          <div className="text-center">
                            <p className="text-lg mb-2">
                              Selecione um paciente
                            </p>
                            <p className="text-sm">
                              Escolha um paciente da lista para ver detalhes,
                              notas e histórico de intervenções
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-hidden min-h-0 relative flex flex-col">
                {/* Botões de controle no canto superior direito (quando não maximizado) */}
                <div className="absolute top-4 right-4 z-[50] flex gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={togglePanelMaximize}
                    className="h-8 w-8 bg-white hover:bg-gray-100 border border-gray-200 shadow-sm"
                    title="Expandir para tela cheia"
                  >
                    <Maximize2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleLeftPanelMinimize}
                    className="h-8 w-8 bg-white hover:bg-gray-100 border border-gray-200 shadow-sm"
                    title="Minimizar painéis para o fundo"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </div>

                {/* Área principal dos painéis */}
                <div className="flex h-full w-full relative transition-all duration-300 ease-in-out">
                  {/* Painel esquerdo: Lista de pacientes com etapas críticas */}
                  <ResizablePanel
                    defaultWidth={600}
                    minWidth={400}
                    maxWidth={maxPanelWidth}
                    storageKey="nurse-dashboard-left-panel-width"
                    side="left"
                  >
                    <div className="h-full bg-white border-r w-full relative flex flex-col">
                      <Tabs
                        value={leftPanelTab}
                        onValueChange={(v) =>
                          setLeftPanelTab(v as LeftPanelTab)
                        }
                        className="flex-1 flex flex-col overflow-hidden min-h-0"
                      >
                        <div className="flex-shrink-0 border-b px-4 pt-3 pb-2">
                          <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="patients">
                              <User className="h-4 w-4 mr-2" />
                              Pacientes
                            </TabsTrigger>
                            <TabsTrigger value="alerts">
                              <AlertTriangle className="h-4 w-4 mr-2" />
                              Alertas
                            </TabsTrigger>
                          </TabsList>
                        </div>
                        <div className="flex-1 overflow-hidden min-h-0">
                          <TabsContent
                            value="patients"
                            className="h-full m-0 overflow-hidden"
                          >
                            <PatientsCriticalStepsList
                              onPatientSelect={setSelectedPatient}
                              selectedPatientId={selectedPatient}
                              onMinimize={toggleLeftPanelMinimize}
                              onMaximize={togglePanelMaximize}
                              isMaximized={isPanelMaximized}
                              hideButtons={true}
                            />
                          </TabsContent>
                          <TabsContent
                            value="alerts"
                            className="h-full m-0 overflow-y-auto p-4"
                          >
                            <AlertsPanel onAlertSelect={handleAlertSelect} />
                          </TabsContent>
                        </div>
                      </Tabs>
                    </div>
                  </ResizablePanel>

                  {/* Painel direito: Detalhes do paciente selecionado */}
                  <div className="flex-1 min-w-0 overflow-hidden relative">
                    <div className="h-full flex flex-col bg-white overflow-hidden">
                      {selectedPatient ? (
                        <>
                          {patientError && (
                            <div className="p-4 bg-red-50 border-b border-red-200 text-red-700 text-sm">
                              Erro ao carregar dados do paciente. Tente
                              novamente.
                            </div>
                          )}
                          <Tabs
                            value={rightPanelTab}
                            onValueChange={handleTabChange}
                            className="flex-1 flex flex-col overflow-hidden min-h-0"
                          >
                            <div className="border-b px-4 pt-4 flex-shrink-0">
                              <TabsList className="grid w-full grid-cols-3">
                                <TabsTrigger value="details">
                                  Detalhes
                                </TabsTrigger>
                                <TabsTrigger value="notes">Notas</TabsTrigger>
                                <TabsTrigger value="interventions">
                                  Histórico
                                </TabsTrigger>
                              </TabsList>
                            </div>

                            <TabsContent
                              value="details"
                              className="flex-1 overflow-y-auto m-0 min-h-0"
                            >
                              <PatientDetails
                                patient={selectedPatientData || null}
                                isLoading={isLoadingPatient}
                              />
                            </TabsContent>

                            <TabsContent
                              value="notes"
                              className="flex-1 overflow-y-auto m-0 p-4 min-h-0"
                            >
                              <InternalNotes patientId={selectedPatient} />
                            </TabsContent>

                            <TabsContent
                              value="interventions"
                              className="flex-1 overflow-y-auto m-0 p-4 min-h-0"
                            >
                              <InterventionHistory
                                patientId={selectedPatient}
                              />
                            </TabsContent>
                          </Tabs>
                        </>
                      ) : (
                        <div className="flex-1 flex items-center justify-center text-muted-foreground">
                          <div className="text-center">
                            <p className="text-lg mb-2">
                              Selecione um paciente
                            </p>
                            <p className="text-sm">
                              Escolha um paciente da lista para ver detalhes,
                              notas e histórico de intervenções
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Barra inferior com painéis minimizados - ancorada no bottom */}
        {isLeftPanelMinimized && (
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-white border-t shadow-lg z-50 flex items-center gap-2 px-4">
            {/* Informação dos painéis minimizados */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-lg border border-gray-200 flex-1 min-w-0">
                {leftPanelTab === 'alerts' ? (
                  <AlertTriangle className="h-4 w-4 text-gray-500 flex-shrink-0" />
                ) : (
                  <User className="h-4 w-4 text-gray-500 flex-shrink-0" />
                )}
                <span className="text-sm font-medium text-gray-700 truncate">
                  {leftPanelTab === 'alerts'
                    ? 'Alertas'
                    : 'Lista de Pacientes'}
                </span>
                {selectedPatient && (
                  <span className="text-xs text-gray-500 truncate">
                    • {selectedPatientData?.name || 'Paciente selecionado'}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-lg border border-gray-200 flex-1 min-w-0">
                <span className="text-sm font-medium text-gray-700 truncate">
                  Detalhes do Paciente
                </span>
                {selectedPatient && selectedPatientData ? (
                  <>
                    <span className="text-xs text-gray-500 truncate">
                      • {selectedPatientData.name}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {rightPanelTab === 'details'
                        ? 'Detalhes'
                        : rightPanelTab === 'notes'
                          ? 'Notas'
                          : 'Histórico'}
                    </Badge>
                  </>
                ) : (
                  <span className="text-xs text-gray-400 truncate">
                    • Nenhum paciente selecionado
                  </span>
                )}
              </div>
            </div>

            {/* Botão único para restaurar ambos */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleLeftPanelMinimize}
              className="h-8 w-8 flex-shrink-0"
              title="Restaurar painéis"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
