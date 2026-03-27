'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useDebounce } from '@/lib/utils/use-debounce';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { getApiUrl } from '@/lib/utils/api-config';
import { usePatients } from '@/hooks/usePatients';
import {
  usePatientNavigationSteps,
  useUpdateNavigationStep,
  useUploadStepFile,
  useDeleteNavigationStep,
} from '@/hooks/useOncologyNavigation';
import { Patient } from '@/lib/api/patients';
import { CANCER_TYPE_LABELS as BASE_CANCER_TYPE_LABELS } from '@/lib/utils/patient-cancer-type';
import { NavigationStep } from '@/lib/api/oncology-navigation';
import { navigationApi } from '@/lib/api/navigation';
import { Button } from '@/components/ui/button';
import {
  Navigation,
  ChevronRight,
  ChevronDown,
  Users,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  Search,
  Edit,
  Upload,
  File,
  X,
  Check,
  Plus,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { NavigationBar } from '@/components/shared/navigation-bar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { CreateNavigationStepDialog } from '@/components/patients/create-navigation-step-dialog';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import {
  JOURNEY_STAGE_LABELS,
  JOURNEY_STAGES,
} from '@/lib/utils/journey-stage';

interface FileMetadata {
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  path: string;
  uploadedAt: string;
  uploadedBy: string;
}

const CANCER_TYPE_LABELS: Record<string, string> = {
  ...Object.fromEntries(
    Object.entries(BASE_CANCER_TYPE_LABELS).map(([k, v]) => [k, `Câncer de ${v}`])
  ),
  palliative_care: 'Tratamento Paliativo',
};

/** Normaliza tipo de câncer para a chave canônica (ex.: pulmão → lung) para agrupamento e label. */
function normalizeCancerTypeKey(raw: string): string {
  const lower = raw.toLowerCase().trim();
  if (lower === 'pulmão' || lower === 'pulmao') return 'lung';
  return lower;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-gray-100 text-gray-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-green-100 text-green-700',
  OVERDUE: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-yellow-100 text-yellow-700',
  NOT_APPLICABLE: 'bg-gray-50 text-gray-500',
};

const STATUS_ICONS: Record<string, React.ReactElement> = {
  PENDING: <Clock className="h-4 w-4" />,
  IN_PROGRESS: <ChevronRight className="h-4 w-4" />,
  COMPLETED: <CheckCircle2 className="h-4 w-4" />,
  OVERDUE: <AlertCircle className="h-4 w-4" />,
  CANCELLED: <XCircle className="h-4 w-4" />,
  NOT_APPLICABLE: <XCircle className="h-4 w-4" />,
};

export default function OncologyNavigationPage() {
  const router = useRouter();
  const { user, isAuthenticated, isInitializing, initialize } = useAuthStore();

  // Obter URL da API dinamicamente (HTTP/HTTPS)
  const apiUrl = useMemo(() => {
    if (typeof window !== 'undefined') {
      return getApiUrl();
    }
    return 'http://localhost:3002'; // Fallback para SSR
  }, []);

  const { data: patients, isLoading: isLoadingPatients } = usePatients();
  const [selectedCancerType, setSelectedCancerType] = useState<string | null>(
    null
  );
  const [searchTerm, setSearchTerm] = useState<string>('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [expandedPatients, setExpandedPatients] = useState<Set<string>>(
    new Set()
  );
  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (!isInitializing && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, isInitializing, router]);

  // Filtrar pacientes por termo de busca (debounced para evitar filtragem a cada tecla)
  const filteredPatients = useMemo(() => {
    if (!patients) return [];
    if (!debouncedSearchTerm.trim()) return patients;

    const term = debouncedSearchTerm.toLowerCase().trim();
    return patients.filter((patient) => {
      // Buscar por nome
      if (patient.name.toLowerCase().includes(term)) return true;

      // Buscar por tipo de câncer
      const cancerType = patient.cancerType?.toLowerCase() || '';
      if (cancerType.includes(term)) return true;
      if (CANCER_TYPE_LABELS[cancerType]?.toLowerCase().includes(term))
        return true;

      // Buscar por estágio atual
      const currentStage = patient.currentStage?.toLowerCase() || '';
      if (currentStage.includes(term)) return true;
      if (
        JOURNEY_STAGE_LABELS[patient.currentStage || '']
          ?.toLowerCase()
          .includes(term)
      )
        return true;

      // Buscar por email
      if (patient.email?.toLowerCase().includes(term)) return true;

      // Buscar por telefone
      if (patient.phone?.includes(term)) return true;

      // Buscar em cancerDiagnoses
      if (
        patient.cancerDiagnoses?.some((d) =>
          d.cancerType.toLowerCase().includes(term)
        )
      )
        return true;

      return false;
    });
  }, [patients, debouncedSearchTerm]);

  // Agrupar pacientes por tipo de câncer (após filtro de busca)
  // Pacientes em tratamento paliativo são agrupados separadamente
  const patientsByCancerType = useMemo(() => {
    if (!filteredPatients) return {};

    const grouped: Record<string, Patient[]> = {};

    filteredPatients.forEach((patient) => {
      // Se paciente está em tratamento paliativo, agrupar separadamente
      if (patient.status === 'PALLIATIVE_CARE') {
        if (!grouped['palliative_care']) {
          grouped['palliative_care'] = [];
        }
        // Evitar duplicatas
        if (!grouped['palliative_care'].find((p) => p.id === patient.id)) {
          grouped['palliative_care'].push(patient);
        }
        return; // Não adicionar em outros grupos
      }

      // Verificar cancerDiagnoses primeiro
      if (patient.cancerDiagnoses && patient.cancerDiagnoses.length > 0) {
        patient.cancerDiagnoses.forEach((diagnosis) => {
          const cancerType = normalizeCancerTypeKey(diagnosis.cancerType);
          if (!grouped[cancerType]) {
            grouped[cancerType] = [];
          }
          // Evitar duplicatas
          if (!grouped[cancerType].find((p) => p.id === patient.id)) {
            grouped[cancerType].push(patient);
          }
        });
      } else if (patient.cancerType) {
        const cancerType = normalizeCancerTypeKey(patient.cancerType);
        if (!grouped[cancerType]) {
          grouped[cancerType] = [];
        }
        grouped[cancerType].push(patient);
      }
    });

    return grouped;
  }, [filteredPatients]);

  const cancerTypes = Object.keys(patientsByCancerType).sort();

  const togglePatient = (patientId: string) => {
    setExpandedPatients((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(patientId)) {
        newSet.delete(patientId);
      } else {
        newSet.add(patientId);
      }
      return newSet;
    });
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="h-screen bg-gray-50 overflow-hidden flex flex-col">
      <NavigationBar />

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Controles */}
        <div className="mb-6 space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Navigation className="h-6 w-6" />
              Navegação Oncológica
            </h1>
          </div>

          {/* Campo de busca */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nome, tipo de câncer, estágio, email ou telefone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <XCircle className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
        {isLoadingPatients ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Carregando pacientes...</p>
            </div>
          </div>
        ) : cancerTypes.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500">
              <Users className="h-16 w-16 mx-auto mb-4 text-gray-400" />
              {searchTerm ? (
                <>
                  <p className="text-lg font-semibold">
                    Nenhum paciente encontrado
                  </p>
                  <p className="text-sm">
                    Tente buscar com outros termos ou limpe a busca.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-lg font-semibold">
                    Nenhum paciente com câncer encontrado
                  </p>
                  <p className="text-sm">
                    Os pacientes aparecerão aqui quando tiverem um tipo de
                    câncer definido.
                  </p>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Filtro por tipo de câncer */}
            <div className="bg-white rounded-lg shadow-sm p-4 border">
              <h2 className="text-lg font-semibold mb-3">
                Filtrar por Tipo de Câncer
              </h2>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedCancerType(null)}
                  className={`px-4 py-2 rounded-md font-medium transition-colors ${
                    selectedCancerType === null
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Todos ({filteredPatients?.length || 0})
                </button>
                {cancerTypes.map((cancerType) => {
                  const count = patientsByCancerType[cancerType]?.length || 0;
                  return (
                    <button
                      key={cancerType}
                      onClick={() => setSelectedCancerType(cancerType)}
                      className={`px-4 py-2 rounded-md font-medium transition-colors ${
                        selectedCancerType === cancerType
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {CANCER_TYPE_LABELS[cancerType] || cancerType} ({count})
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Lista de pacientes por tipo de câncer */}
            {(selectedCancerType ? [selectedCancerType] : cancerTypes).map(
              (cancerType) => {
                const typePatients = patientsByCancerType[cancerType] || [];
                if (typePatients.length === 0) return null;

                return (
                  <div
                    key={cancerType}
                    className="bg-white rounded-lg shadow-sm border"
                  >
                    <div className="p-4 border-b">
                      <h2 className="text-xl font-bold flex items-center gap-2">
                        {CANCER_TYPE_LABELS[cancerType] || cancerType}
                        <span className="text-sm font-normal text-gray-500">
                          ({typePatients.length} paciente
                          {typePatients.length > 1 ? 's' : ''})
                        </span>
                      </h2>
                    </div>
                    <div className="divide-y">
                      {typePatients.map((patient) => (
                        <PatientNavigationCard
                          key={patient.id}
                          patient={patient}
                          cancerType={cancerType}
                          isExpanded={expandedPatients.has(patient.id)}
                          onToggle={() => togglePatient(patient.id)}
                          apiUrl={apiUrl}
                        />
                      ))}
                    </div>
                  </div>
                );
              }
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface PatientNavigationCardProps {
  patient: Patient;
  cancerType: string;
  isExpanded: boolean;
  onToggle: () => void;
  apiUrl: string;
}

function PatientNavigationCard({
  patient,
  cancerType,
  isExpanded,
  onToggle,
  apiUrl,
}: PatientNavigationCardProps) {
  const queryClient = useQueryClient();
  const { data: navigationSteps, isLoading } = usePatientNavigationSteps(
    patient.id || null
  );
  // Wizard de adicionar etapa: null = fechado, 'phase' = seleção de fase, 'step' = seleção de etapa
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardPhase, setWizardPhase] = useState<string | null>(null);
  const [templates, setTemplates] = useState<
    { stepKey: string; stepName: string; stepDescription?: string; isRequired: boolean; existingCount: number }[]
  >([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [createStage, setCreateStage] = useState<string | null>(null);

  const createFromTemplateMutation = useMutation({
    mutationFn: ({ journeyStage, stepKey }: { journeyStage: string; stepKey: string }) =>
      navigationApi.createStepFromTemplate(patient.id ?? '', journeyStage, stepKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['navigation-steps', patient.id] });
      toast.success('Etapa criada com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar etapa: ${error.message}`);
    },
  });

  const createMissingStepsMutation = useMutation({
    mutationFn: ({ journeyStage }: { journeyStage: string }) =>
      navigationApi.createMissingStepsForStage(patient.id ?? '', journeyStage),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['navigation-steps', patient.id] });
      toast.success(
        data.created > 0
          ? `${data.created} etapa(s) criada(s) com sucesso`
          : 'Todas as etapas já existem para esta fase'
      );
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar etapas: ${error.message}`);
    },
  });

  const handleSelectPhase = async (stage: string): Promise<void> => {
    setWizardPhase(stage);
    setLoadingTemplates(true);
    try {
      const data = await navigationApi.getStepTemplates(patient.id ?? '', stage);
      setTemplates(data);
    } catch {
      setTemplates([]);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleSelectStep = (stepKey: string | null): void => {
    const stage = wizardPhase!;
    setWizardOpen(false);
    setWizardPhase(null);
    setTemplates([]);
    if (stepKey === '__custom__') {
      setCreateStage(stage);
    } else if (stepKey === null) {
      createMissingStepsMutation.mutate({ journeyStage: stage });
    } else {
      createFromTemplateMutation.mutate({ journeyStage: stage, stepKey });
    }
  };

  const handleAllPhases = (): void => {
    setWizardOpen(false);
    setWizardPhase(null);
    // Cria missing steps para todas as fases sequencialmente
    const stages = ['SCREENING', 'DIAGNOSIS', 'TREATMENT', 'FOLLOW_UP', 'PALLIATIVE'];
    Promise.all(
      stages.map((s) =>
        navigationApi.createMissingStepsForStage(patient.id ?? '', s).catch(() => null)
      )
    ).then(() => {
      queryClient.invalidateQueries({ queryKey: ['navigation-steps', patient.id] });
      toast.success('Etapas criadas para todas as fases');
    });
  };

  const stepsByStage = useMemo(() => {
    if (!navigationSteps) return {};

    const grouped: Record<string, NavigationStep[]> = {
      SCREENING: [],
      DIAGNOSIS: [],
      TREATMENT: [],
      FOLLOW_UP: [],
      PALLIATIVE: [],
    };

    navigationSteps.forEach((step) => {
      if (step.cancerType.toLowerCase() === cancerType.toLowerCase()) {
        const stage = step.journeyStage;
        if (!grouped[stage]) grouped[stage] = [];
        grouped[stage].push(step);
      }
    });

    return grouped;
  }, [navigationSteps, cancerType]);

  const totalSteps = Object.values(stepsByStage).flat().length;
  const completedSteps = Object.values(stepsByStage)
    .flat()
    .filter((step) => step.status === 'COMPLETED').length;
  const overdueSteps = Object.values(stepsByStage)
    .flat()
    .filter((step) => step.status === 'OVERDUE').length;

  const currentStage = patient.currentStage || 'SCREENING';
  const isPalliativeCare = patient.status === 'PALLIATIVE_CARE';

  return (
    <div
      className={`p-4 hover:bg-gray-50 transition-colors ${isPalliativeCare ? 'border-l-4 border-purple-500 bg-purple-50/30' : ''}`}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              {isExpanded ? (
                <ChevronDown className="h-5 w-5 text-gray-400" />
              ) : (
                <ChevronRight className="h-5 w-5 text-gray-400" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-lg">{patient.name}</h3>
                {isPalliativeCare && (
                  <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">
                    💜 Tratamento Paliativo
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                <span>
                  Etapa atual:{' '}
                  <strong>
                    {JOURNEY_STAGE_LABELS[currentStage] || currentStage}
                  </strong>
                </span>
                <span>
                  Etapas: {completedSteps}/{totalSteps} concluídas
                </span>
                {overdueSteps > 0 && (
                  <span className="text-red-600 font-semibold">
                    {overdueSteps} atrasada{overdueSteps > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </button>

      {isExpanded && (
        <div className="mt-4 ml-8 space-y-4">
          <div className="flex justify-end">
            <Popover
              open={wizardOpen}
              onOpenChange={(open) => {
                setWizardOpen(open);
                if (!open) { setWizardPhase(null); setTemplates([]); }
              }}
            >
              <PopoverTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar etapa
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 p-2 bg-background z-[100]">
                {wizardPhase === null ? (
                  /* Passo 1: selecionar fase */
                  <>
                    <p className="text-sm font-medium text-muted-foreground px-2 py-1 mb-1">
                      Escolha a fase
                    </p>
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-blue-600"
                      size="sm"
                      onClick={() => { setWizardOpen(false); handleAllPhases(); }}
                    >
                      Criar todas as fases
                    </Button>
                    <div className="border-t my-1" />
                    {JOURNEY_STAGES.map((stage) => (
                      <Button
                        key={stage}
                        variant="ghost"
                        className="w-full justify-start"
                        size="sm"
                        onClick={() => handleSelectPhase(stage)}
                      >
                        {JOURNEY_STAGE_LABELS[stage] ?? stage}
                      </Button>
                    ))}
                  </>
                ) : (
                  /* Passo 2: selecionar etapa dentro da fase */
                  <>
                    <div className="flex items-center gap-1 mb-1">
                      <button
                        onClick={() => { setWizardPhase(null); setTemplates([]); }}
                        className="p-1 hover:bg-gray-100 rounded"
                      >
                        <ChevronRight className="h-4 w-4 rotate-180 text-gray-500" />
                      </button>
                      <p className="text-sm font-medium">
                        {JOURNEY_STAGE_LABELS[wizardPhase] ?? wizardPhase}
                      </p>
                    </div>
                    {loadingTemplates ? (
                      <p className="text-xs text-muted-foreground px-2 py-2">Carregando...</p>
                    ) : (
                      <>
                        {templates.some((t) => t.existingCount === 0) && (
                          <Button
                            variant="ghost"
                            className="w-full justify-start text-blue-600"
                            size="sm"
                            onClick={() => handleSelectStep(null)}
                          >
                            Criar todas as etapas faltantes
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          className="w-full justify-start text-gray-500"
                          size="sm"
                          onClick={() => handleSelectStep('__custom__')}
                        >
                          + Etapa personalizada...
                        </Button>
                        {templates.length > 0 && <div className="border-t my-1" />}
                        {templates.map((t) => (
                          <Button
                            key={t.stepKey}
                            variant="ghost"
                            className="w-full justify-start text-sm"
                            size="sm"
                            onClick={() => handleSelectStep(t.stepKey)}
                            title={t.stepDescription}
                          >
                            <span className="truncate">{t.stepName}</span>
                            <span className="ml-auto flex items-center gap-1 shrink-0">
                              {t.existingCount > 0 && (
                                <span className="text-xs text-muted-foreground">
                                  ({t.existingCount})
                                </span>
                              )}
                              {t.isRequired && (
                                <span className="text-xs text-purple-600">obr.</span>
                              )}
                            </span>
                          </Button>
                        ))}
                        {templates.length === 0 && (
                          <p className="text-xs text-muted-foreground px-2 py-1">
                            Nenhum template disponível para esta fase.
                          </p>
                        )}
                      </>
                    )}
                  </>
                )}
              </PopoverContent>
            </Popover>
          </div>
          {isLoading ? (
            <div className="text-center py-4 text-gray-500">
              Carregando etapas de navegação...
            </div>
          ) : totalSteps === 0 ? (
            <div className="text-center py-4 text-gray-500">
              Nenhuma etapa de navegação definida para este paciente.
            </div>
          ) : (
            Object.entries(stepsByStage).map(([stage, steps]) => {
              if (steps.length === 0) return null;

              const stageCompleted = steps.filter(
                (s) => s.status === 'COMPLETED'
              ).length;
              const stageOverdue = steps.filter(
                (s) => s.status === 'OVERDUE'
              ).length;
              const isCurrentStage = stage === currentStage;

              return (
                <div
                  key={stage}
                  className={`border rounded-lg overflow-hidden ${
                    isCurrentStage ? 'ring-2 ring-blue-500' : ''
                  }`}
                >
                  <div className="bg-gray-50 px-4 py-2 border-b">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">
                        {JOURNEY_STAGE_LABELS[stage] || stage}
                      </span>
                      <span className="text-sm text-gray-600">
                        {stageCompleted}/{steps.length} concluídas
                        {stageOverdue > 0 && (
                          <span className="text-red-600 ml-2">
                            • {stageOverdue} atrasada
                            {stageOverdue > 1 ? 's' : ''}
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="p-4 space-y-2">
                    {steps.map((step) => (
                      <StepCard
                        key={`${step.id}-${step.updatedAt}`}
                        step={step}
                        apiUrl={apiUrl}
                      />
                    ))}
                  </div>
                </div>
              );
            })
          )}
          <CreateNavigationStepDialog
            open={createStage !== null}
            onOpenChange={(open) => !open && setCreateStage(null)}
            patientId={patient.id ?? ''}
            cancerType={cancerType}
            journeyStage={createStage ?? 'SCREENING'}
            diagnosisId={undefined}
            onSuccess={() => {
              queryClient.invalidateQueries({
                queryKey: ['navigation-steps', patient.id],
              });
              queryClient.invalidateQueries({ queryKey: ['patients'] });
            }}
          />
        </div>
      )}
    </div>
  );
}

interface StepCardProps {
  step: NavigationStep;
  apiUrl: string;
}

function StepCard({ step, apiUrl }: StepCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [notes, setNotes] = useState(step.notes || '');
  const [isCompleted, setIsCompleted] = useState(step.isCompleted);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Novos campos do formulário
  const [institutionName, setInstitutionName] = useState(
    step.institutionName || ''
  );
  const [professionalName, setProfessionalName] = useState(
    step.professionalName || ''
  );
  const [result, setResult] = useState(step.result || '');
  const [findings, setFindings] = useState<string[]>(step.findings || []);
  const [newFinding, setNewFinding] = useState('');
  const [actualDate, setActualDate] = useState(
    step.actualDate ? new Date(step.actualDate).toISOString().split('T')[0] : ''
  );
  const [dueDate, setDueDate] = useState(
    step.dueDate ? new Date(step.dueDate).toISOString().split('T')[0] : ''
  );

  const [confirmDelete, setConfirmDelete] = useState(false);
  const updateStep = useUpdateNavigationStep();
  const uploadFile = useUploadStepFile();
  const deleteStep = useDeleteNavigationStep();

  const files = ((step.metadata as { files?: FileMetadata[] })?.files ||
    []) as FileMetadata[];

  const handleSave = async (): Promise<void> => {
    try {
      await updateStep.mutateAsync({
        stepId: step.id,
        data: {
          notes,
          isCompleted,
          completedAt:
            isCompleted && !step.isCompleted
              ? new Date().toISOString()
              : undefined,
          institutionName: institutionName || undefined,
          professionalName: professionalName || undefined,
          result: result || undefined,
          findings: findings.length > 0 ? findings : undefined,
          actualDate: actualDate
            ? new Date(actualDate).toISOString()
            : undefined,
          dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        },
      });
      setIsEditing(false);
      toast.success('Etapa atualizada com sucesso');
    } catch (error) {
      toast.error('Erro ao atualizar etapa');
    }
  };

  const handleAddFinding = (): void => {
    if (newFinding.trim()) {
      setFindings([...findings, newFinding.trim()]);
      setNewFinding('');
    }
  };

  const handleRemoveFinding = (index: number): void => {
    setFindings(findings.filter((_, i) => i !== index));
  };

  const handleFileUpload = async (): Promise<void> => {
    if (!selectedFile) return;

    try {
      await uploadFile.mutateAsync({
        stepId: step.id,
        file: selectedFile,
      });
      setSelectedFile(null);
      toast.success('Arquivo enviado com sucesso');
    } catch (error) {
      toast.error('Erro ao enviar arquivo');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleQuickComplete = async (): Promise<void> => {
    const newCompletedStatus = !isCompleted;
    try {
      await updateStep.mutateAsync({
        stepId: step.id,
        data: {
          isCompleted: newCompletedStatus,
          completedAt: newCompletedStatus
            ? new Date().toISOString()
            : undefined,
        },
      });
      setIsCompleted(newCompletedStatus);
      toast.success(
        newCompletedStatus
          ? 'Etapa marcada como concluída'
          : 'Etapa desmarcada como concluída'
      );
    } catch (error) {
      toast.error('Erro ao atualizar etapa');
    }
  };

  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-lg border ${
        STATUS_COLORS[step.status] || STATUS_COLORS.PENDING
      }`}
    >
      <div className="flex-shrink-0 mt-0.5">
        {STATUS_ICONS[step.status] || STATUS_ICONS.PENDING}
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">{step.stepName}</span>
              {step.isRequired && (
                <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-800 rounded-full">
                  Obrigatório
                </span>
              )}
            </div>
            {step.stepDescription && (
              <p className="text-sm mt-1 opacity-80">{step.stepDescription}</p>
            )}
          </div>
          <div className="flex items-center gap-1">
            {/* Botão de atalho para marcar como concluída */}
            <button
              onClick={handleQuickComplete}
              disabled={updateStep.isPending}
              className={`p-1.5 rounded transition-colors ${
                isCompleted
                  ? 'bg-green-100 hover:bg-green-200 text-green-700'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              title={
                isCompleted
                  ? 'Desmarcar como concluída'
                  : 'Marcar como concluída'
              }
            >
              <Check
                className={`h-4 w-4 ${
                  isCompleted ? 'text-green-700' : 'text-gray-600'
                }`}
              />
            </button>
            {/* Botão de editar */}
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="p-1.5 hover:bg-gray-200 rounded transition-colors"
              title="Editar etapa"
            >
              <Edit className="h-4 w-4 text-gray-600" />
            </button>
            {/* Botão de excluir */}
            {confirmDelete ? (
              <div className="flex items-center gap-1 bg-red-50 border border-red-200 rounded px-2 py-1">
                <span className="text-xs text-red-700 font-medium">Excluir?</span>
                <button
                  onClick={async () => {
                    await deleteStep.mutateAsync({ stepId: step.id, patientId: step.patientId });
                    toast.success('Etapa excluída');
                    setConfirmDelete(false);
                  }}
                  disabled={deleteStep.isPending}
                  className="p-0.5 hover:bg-red-200 rounded transition-colors text-red-700 disabled:opacity-50"
                  title="Confirmar exclusão"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="p-0.5 hover:bg-gray-200 rounded transition-colors text-gray-600"
                  title="Cancelar"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="p-1.5 hover:bg-red-100 rounded transition-colors"
                title="Excluir etapa"
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </button>
            )}
          </div>
        </div>

        {isEditing ? (
          <div className="mt-3 space-y-4">
            {/* Seção: Informações Básicas */}
            <div className="border-b pb-3">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">
                Informações Básicas
              </h4>

              {/* Data Limite (para gerar alarmes de atraso) */}
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">
                  Data Limite <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Data limite para conclusão da etapa (gera alarmes de atraso)
                </p>
              </div>

              {/* Data Realizada */}
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">
                  Data Realizada
                </label>
                <input
                  type="date"
                  value={actualDate}
                  onChange={(e) => setActualDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                />
              </div>

              {/* Checkbox para marcar como concluída */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isCompleted}
                  onChange={(e) => setIsCompleted(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm font-medium">
                  Marcar como concluída
                </span>
              </label>
            </div>

            {/* Seção: Local e Profissional */}
            <div className="border-b pb-3">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">
                Local e Profissional
              </h4>

              {/* Instituição de Saúde */}
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">
                  Instituição de Saúde
                </label>
                <input
                  type="text"
                  value={institutionName}
                  onChange={(e) => setInstitutionName(e.target.value)}
                  placeholder="Ex: Hospital das Clínicas, Clínica ABC..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                />
              </div>

              {/* Profissional que Realizou */}
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">
                  Profissional que Realizou
                </label>
                <input
                  type="text"
                  value={professionalName}
                  onChange={(e) => setProfessionalName(e.target.value)}
                  placeholder="Ex: Dr. João Silva, CRM 12345"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                />
              </div>
            </div>

            {/* Seção: Resultados */}
            <div className="border-b pb-3">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">
                Resultados
              </h4>

              {/* Resultado */}
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">
                  Resultado
                </label>
                <select
                  value={result}
                  onChange={(e) => setResult(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                >
                  <option value="">Selecione...</option>
                  <option value="Normal">Normal</option>
                  <option value="Alterado">Alterado</option>
                  <option value="Pendente">Pendente</option>
                  <option value="Inconclusivo">Inconclusivo</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>

              {/* Achados (Lista de Alterações) */}
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">
                  Achados (Alterações Encontradas)
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newFinding}
                    onChange={(e) => setNewFinding(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddFinding();
                      }
                    }}
                    placeholder="Digite um achado e pressione Enter"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleAddFinding}
                    className="px-3 py-2 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700"
                  >
                    Adicionar
                  </button>
                </div>
                {findings.length > 0 && (
                  <div className="space-y-1">
                    {findings.map((finding, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-md text-sm"
                      >
                        <span className="flex-1">{finding}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveFinding(index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Seção: Observações e Arquivos */}
            <div className="border-b pb-3">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">
                Observações e Documentos
              </h4>

              {/* Campo de observações */}
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">
                  Observações
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Adicione observações sobre esta etapa..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                  rows={3}
                />
              </div>

              {/* Upload de arquivo */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Anexar arquivo
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    onChange={(e) =>
                      setSelectedFile(e.target.files?.[0] || null)
                    }
                    className="text-sm"
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                  />
                  {selectedFile && (
                    <button
                      onClick={handleFileUpload}
                      disabled={uploadFile.isPending}
                      className="px-3 py-1 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1"
                    >
                      <Upload className="h-3 w-3" />
                      {uploadFile.isPending ? 'Enviando...' : 'Enviar'}
                    </button>
                  )}
                </div>
              </div>

              {/* Lista de arquivos existentes */}
              {files.length > 0 && (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Arquivos anexados
                  </label>
                  <div className="space-y-1">
                    {files.map((file: FileMetadata, index: number) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 px-2 py-1 bg-gray-100 rounded text-sm"
                      >
                        <File className="h-4 w-4 text-gray-600" />
                        <span className="flex-1 truncate">
                          {file.originalName}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatFileSize(file.size)}
                        </span>
                        <a
                          href={`${apiUrl}${file.path}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:text-indigo-800"
                        >
                          Abrir
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Botões de ação */}
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={handleSave}
                disabled={updateStep.isPending}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
              >
                <Check className="h-4 w-4" />
                {updateStep.isPending ? 'Salvando...' : 'Salvar'}
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setNotes(step.notes || '');
                  setIsCompleted(step.isCompleted);
                  setSelectedFile(null);
                  setInstitutionName(step.institutionName || '');
                  setProfessionalName(step.professionalName || '');
                  setResult(step.result || '');
                  setFindings(step.findings || []);
                  setActualDate(
                    step.actualDate
                      ? new Date(step.actualDate).toISOString().split('T')[0]
                      : ''
                  );
                  setDueDate(
                    step.dueDate
                      ? new Date(step.dueDate).toISOString().split('T')[0]
                      : ''
                  );
                  setNewFinding('');
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md text-sm hover:bg-gray-300 flex items-center gap-2"
              >
                <X className="h-4 w-4" />
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-2 space-y-2">
            {/* Informações de Local e Profissional */}
            {(step.institutionName || step.professionalName) && (
              <div className="p-2 bg-gray-50 rounded border border-gray-200">
                {step.institutionName && (
                  <p className="text-sm text-gray-700">
                    <strong>Instituição:</strong> {step.institutionName}
                  </p>
                )}
                {step.professionalName && (
                  <p className="text-sm text-gray-700">
                    <strong>Profissional:</strong> {step.professionalName}
                  </p>
                )}
              </div>
            )}

            {/* Resultado */}
            {step.result && (
              <div className="p-2 bg-blue-50 rounded border border-blue-200">
                <p className="text-sm text-gray-700">
                  <strong>Resultado:</strong>{' '}
                  <span className="font-medium">{step.result}</span>
                </p>
              </div>
            )}

            {/* Achados */}
            {step.findings && step.findings.length > 0 && (
              <div className="p-2 bg-yellow-50 rounded border border-yellow-200">
                <p className="text-sm font-medium text-gray-700 mb-1">
                  Achados Encontrados:
                </p>
                <ul className="list-disc list-inside space-y-1">
                  {step.findings.map((finding, index) => (
                    <li key={index} className="text-sm text-gray-700">
                      {finding}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Observações existentes */}
            {step.notes && (
              <div className="p-2 bg-white rounded border border-gray-200">
                <p className="text-sm font-medium text-gray-700 mb-1">
                  Observações:
                </p>
                <p className="text-sm text-gray-700">{step.notes}</p>
              </div>
            )}

            {/* Arquivos existentes (visualização) */}
            {files.length > 0 && (
              <div className="mt-2 space-y-1">
                <p className="text-sm font-medium text-gray-700 mb-1">
                  Arquivos Anexados:
                </p>
                {files.map((file: FileMetadata, index: number) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 px-2 py-1 bg-white rounded border border-gray-200 text-sm"
                  >
                    <File className="h-4 w-4 text-gray-600" />
                    <span className="flex-1 truncate">{file.originalName}</span>
                    <span className="text-xs text-gray-500">
                      {formatFileSize(file.size)}
                    </span>
                    <a
                      href={`${apiUrl}${file.path}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:text-indigo-800 text-xs"
                    >
                      Abrir
                    </a>
                  </div>
                ))}
              </div>
            )}

            {/* Informações de datas */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs mt-2 opacity-70">
              {step.expectedDate && (
                <span>
                  Esperado:{' '}
                  {new Date(step.expectedDate).toLocaleDateString('pt-BR')}
                </span>
              )}
              {step.dueDate && (
                <span
                  className={
                    step.status === 'OVERDUE' ? 'text-red-600 font-medium' : ''
                  }
                >
                  Prazo: {new Date(step.dueDate).toLocaleDateString('pt-BR')}
                  {step.status === 'OVERDUE' && ' (ATRASADO)'}
                </span>
              )}
              {step.actualDate && (
                <span>
                  Realizado:{' '}
                  {new Date(step.actualDate).toLocaleDateString('pt-BR')}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
