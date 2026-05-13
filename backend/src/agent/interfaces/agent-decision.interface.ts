import { AgentDecisionType } from '@generated/prisma/client';

export interface AgentDecision {
  decisionType: AgentDecisionType;
  reasoning: string;
  confidence?: number;
  inputData: Record<string, any>;
  outputAction: Record<string, any>;
  requiresApproval: boolean;
}

export interface AgentResponse {
  response: string;
  actions: AgentAction[];
  symptomAnalysis?: SymptomAnalysis;
  newState?: Record<string, any>;
  decisions: AgentDecision[];
  /** Observability trace from ai-service (spans, pipeline_path, intent, etc.) */
  pipelineTrace?: Record<string, unknown>;
}

export interface AgentAction {
  type: string;
  payload: Record<string, any>;
  requiresApproval: boolean;
}

export interface SymptomAnalysis {
  detectedSymptoms: DetectedSymptom[];
  overallSeverity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  requiresEscalation: boolean;
}

export interface DetectedSymptom {
  name: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  confidence: number;
  action: string;
}

export interface ClinicalContext {
  patient: {
    id: string;
    name: string;
    cancerType?: string;
    stage?: string;
    currentStage: string;
    performanceStatus?: number;
    priorityScore: number;
    priorityCategory: string;
    clinicalDisposition?: string;
  };
  diagnoses: any[];
  treatments: any[];
  navigationSteps: any[];
  recentAlerts: any[];
  questionnaireResponses: any[];
  observations: any[];
  medications: any[];
  comorbidities: any[];
  performanceStatusHistory: any[];
}

/** Contrato `outputAction.type` da secretária de agendamento (ai-service ↔ backend). */
export {
  CREATE_CONSULTATION_APPOINTMENT,
  RESCHEDULE_CONSULTATION_APPOINTMENT,
  CANCEL_CONSULTATION_APPOINTMENT,
  CONFIRM_CONSULTATION_APPOINTMENT,
  CHECK_CONSULTATION_AVAILABILITY,
  SCHEDULING_SECRETARY_OUTPUT_ACTION_TYPES,
  isSchedulingSecretaryOutputActionType,
  type SchedulingSecretaryOutputActionType,
} from '../scheduling-secretary.constants';
