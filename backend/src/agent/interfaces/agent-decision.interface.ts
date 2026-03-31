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
