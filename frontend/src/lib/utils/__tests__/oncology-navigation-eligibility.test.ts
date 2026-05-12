import { describe, expect, it } from 'vitest';
import { patientEligibleForOncologyNavigationPage } from '../oncology-navigation-eligibility';
import type { Patient } from '@/lib/api/patients';

const base = {
  id: 'p1',
  tenantId: 't1',
  name: 'Test',
  cpf: null,
  birthDate: '1990-01-01',
  gender: 'female' as const,
  phone: null,
  email: null,
  cancerType: null,
  stage: null,
  diagnosisDate: null,
  performanceStatus: null,
  smokingHistory: null,
  alcoholHistory: null,
  occupationalExposure: null,
  familyHistory: null,
  clinicalDisposition: null,
  clinicalDispositionAt: null,
  clinicalDispositionReason: null,
  preferredEmergencyHospital: null,
  currentStage: 'SCREENING' as const,
  currentSpecialty: null,
  priorityScore: 0,
  priorityCategory: 'LOW' as const,
  priorityReason: null,
  priorityUpdatedAt: null,
  ehrPatientId: null,
  lastSyncAt: null,
  status: 'ACTIVE',
  lastInteraction: null,
  createdAt: '2020-01-01',
  updatedAt: '2020-01-01',
};

describe('patientEligibleForOncologyNavigationPage', () => {
  it('retorna true quando cancerType está preenchido no paciente', () => {
    const p = {
      ...base,
      cancerType: 'breast',
    } as Patient;
    expect(patientEligibleForOncologyNavigationPage(p)).toBe(true);
  });

  it('retorna true quando há diagnóstico ativo com cancerType', () => {
    const p = {
      ...base,
      cancerDiagnoses: [
        {
          id: 'd1',
          tenantId: 't1',
          patientId: 'p1',
          cancerType: 'lung',
          icd10Code: null,
          stage: null,
          tStage: null,
          nStage: null,
          mStage: null,
          grade: null,
          stagingDate: null,
          histologicalType: null,
          diagnosisDate: '2024-01-01',
          diagnosisConfirmed: true,
          pathologyReport: null,
          confirmedBy: null,
          her2Status: null,
          erStatus: null,
          prStatus: null,
          ki67Percentage: null,
          egfrMutation: null,
          alkRearrangement: null,
          ros1Rearrangement: null,
          brafMutation: null,
          krasMutation: null,
          nrasMutation: null,
          pdl1Expression: null,
          msiStatus: null,
          psaBaseline: null,
          gleasonScore: null,
          ceaBaseline: null,
          ca199Baseline: null,
          ca125Baseline: null,
          ca153Baseline: null,
          afpBaseline: null,
          hcgBaseline: null,
          isPrimary: true,
          isActive: true,
          resolvedDate: null,
          resolutionReason: null,
          primaryDiagnosisId: null,
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
        },
      ],
    } as Patient;
    expect(patientEligibleForOncologyNavigationPage(p)).toBe(true);
  });

  it('retorna false sem cancerType nem diagnósticos úteis', () => {
    const p = { ...base } as Patient;
    expect(patientEligibleForOncologyNavigationPage(p)).toBe(false);
  });

  it('retorna false quando diagnóstico está inativo', () => {
    const p = {
      ...base,
      cancerDiagnoses: [
        {
          id: 'd1',
          tenantId: 't1',
          patientId: 'p1',
          cancerType: 'lung',
          icd10Code: null,
          stage: null,
          tStage: null,
          nStage: null,
          mStage: null,
          grade: null,
          stagingDate: null,
          histologicalType: null,
          diagnosisDate: '2024-01-01',
          diagnosisConfirmed: true,
          pathologyReport: null,
          confirmedBy: null,
          her2Status: null,
          erStatus: null,
          prStatus: null,
          ki67Percentage: null,
          egfrMutation: null,
          alkRearrangement: null,
          ros1Rearrangement: null,
          brafMutation: null,
          krasMutation: null,
          nrasMutation: null,
          pdl1Expression: null,
          msiStatus: null,
          psaBaseline: null,
          gleasonScore: null,
          ceaBaseline: null,
          ca199Baseline: null,
          ca125Baseline: null,
          ca153Baseline: null,
          afpBaseline: null,
          hcgBaseline: null,
          isPrimary: true,
          isActive: false,
          resolvedDate: null,
          resolutionReason: null,
          primaryDiagnosisId: null,
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
        },
      ],
    } as Patient;
    expect(patientEligibleForOncologyNavigationPage(p)).toBe(false);
  });
});
