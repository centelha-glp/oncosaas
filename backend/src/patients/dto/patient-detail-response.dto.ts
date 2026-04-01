import {
  JourneyStage,
  PriorityCategory,
  PatientStatus,
  ComplementaryExamType,
} from '@generated/prisma/client';

export interface PatientDetailResponse {
  id: string;
  tenantId: string;
  name: string;
  cpf: string | null;
  birthDate: Date;
  gender: string | null;
  phone: string | null;
  email: string | null;
  cancerType: string | null;
  stage: string | null;
  diagnosisDate: Date | null;
  performanceStatus: number | null;
  currentStage: JourneyStage;
  currentSpecialty: string | null;
  priorityScore: number;
  priorityCategory: PriorityCategory;
  priorityReason: string | null;
  priorityUpdatedAt: Date | null;
  ehrPatientId: string | null;
  lastSyncAt: Date | null;
  status: PatientStatus;
  lastInteraction: Date | null;
  createdAt: Date;
  updatedAt: Date;
  journey: {
    id: string;
    screeningDate: Date | null;
    screeningResult: string | null;
    diagnosisDate: Date | null;
    diagnosisConfirmed: boolean;
    pathologyReport: string | null;
    stagingDate: Date | null;
    treatmentStartDate: Date | null;
    treatmentType: string | null;
    treatmentProtocol: string | null;
    currentCycle: number | null;
    totalCycles: number | null;
    lastFollowUpDate: Date | null;
    nextFollowUpDate: Date | null;
    currentStep: string | null;
    nextStep: string | null;
    blockers: string[];
  } | null;
  cancerDiagnoses: Array<{
    id: string;
    cancerType: string;
    icd10Code: string | null;
    stage: string | null;
    stagingDate: Date | null;
    diagnosisDate: Date;
    diagnosisConfirmed: boolean;
    pathologyReport: string | null;
    confirmedBy: string | null;
    isPrimary: boolean;
    isActive: boolean;
  }>;
  complementaryExams: Array<{
    id: string;
    type: ComplementaryExamType;
    name: string;
    code: string | null;
    unit: string | null;
    referenceRange: string | null;
    results: Array<{
      id: string;
      performedAt: Date;
      valueNumeric: number | null;
      valueText: string | null;
      unit: string | null;
      referenceRange: string | null;
      isAbnormal: boolean | null;
      report: string | null;
    }>;
  }>;
  navigationSteps: Array<{
    id: string;
    cancerType: string;
    journeyStage: JourneyStage;
    stepKey: string;
    stepName: string;
    stepDescription: string | null;
    status: string;
    isRequired: boolean;
    isCompleted: boolean;
    completedAt: Date | null;
    expectedDate: Date | null;
    dueDate: Date | null;
    actualDate: Date | null;
    institutionName: string | null;
    professionalName: string | null;
    result: string | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
  alerts: Array<{
    id: string;
    type: string;
    severity: string;
    status: string;
    message: string;
    createdAt: Date;
  }>;
  _count: {
    messages: number;
    alerts: number;
    observations: number;
  };
}