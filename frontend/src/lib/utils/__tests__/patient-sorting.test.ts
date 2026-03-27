import { describe, it, expect } from 'vitest';
import { sortPatientsByPriority } from '../patient-sorting';
import type { Patient } from '@/lib/api/patients';

const makePatient = (overrides: Partial<Patient> = {}): Patient =>
  ({
    id: 'p1',
    tenantId: 't1',
    name: 'Maria Silva',
    cpf: '123.456.789-00',
    priorityCategory: 'MEDIUM',
    priorityScore: 50,
    currentStage: 'DIAGNOSIS',
    cancerType: null,
    cancerDiagnoses: [],
    createdAt: '2024-01-15T10:00:00Z',
    ...overrides,
  }) as Patient;

describe('sortPatientsByPriority', () => {
  it('does not mutate the input array', () => {
    const patients = [
      makePatient({ id: 'p1', priorityCategory: 'LOW' }),
      makePatient({ id: 'p2', priorityCategory: 'CRITICAL' }),
    ];
    const originalIds = patients.map((p) => p.id);
    sortPatientsByPriority(patients);
    expect(patients.map((p) => p.id)).toEqual(originalIds);
  });

  it('orders CRITICAL > HIGH > MEDIUM > LOW', () => {
    const patients = [
      makePatient({ id: 'p4', priorityCategory: 'LOW' }),
      makePatient({ id: 'p2', priorityCategory: 'HIGH' }),
      makePatient({ id: 'p3', priorityCategory: 'MEDIUM' }),
      makePatient({ id: 'p1', priorityCategory: 'CRITICAL' }),
    ];
    const sorted = sortPatientsByPriority(patients);
    expect(sorted.map((p) => p.id)).toEqual(['p1', 'p2', 'p3', 'p4']);
  });

  it('within same category, sorts by score descending', () => {
    const patients = [
      makePatient({ id: 'p1', priorityCategory: 'HIGH', priorityScore: 30 }),
      makePatient({ id: 'p2', priorityCategory: 'HIGH', priorityScore: 80 }),
      makePatient({ id: 'p3', priorityCategory: 'HIGH', priorityScore: 60 }),
    ];
    const sorted = sortPatientsByPriority(patients);
    expect(sorted.map((p) => p.id)).toEqual(['p2', 'p3', 'p1']);
  });

  it('within same category and score, sorts by createdAt descending (newest first)', () => {
    const patients = [
      makePatient({ id: 'p1', priorityScore: 50, createdAt: '2024-01-01T00:00:00Z' }),
      makePatient({ id: 'p2', priorityScore: 50, createdAt: '2024-03-01T00:00:00Z' }),
      makePatient({ id: 'p3', priorityScore: 50, createdAt: '2024-02-01T00:00:00Z' }),
    ];
    const sorted = sortPatientsByPriority(patients);
    expect(sorted.map((p) => p.id)).toEqual(['p2', 'p3', 'p1']);
  });

  it('treats null priorityCategory as MEDIUM', () => {
    const patients = [
      makePatient({ id: 'p1', priorityCategory: null as unknown as undefined }),
      makePatient({ id: 'p2', priorityCategory: 'HIGH' }),
      makePatient({ id: 'p3', priorityCategory: 'LOW' }),
    ];
    const sorted = sortPatientsByPriority(patients);
    // HIGH (1) < MEDIUM/null (2) < LOW (3)
    expect(sorted.map((p) => p.id)).toEqual(['p2', 'p1', 'p3']);
  });

  it('treats null priorityScore as 0', () => {
    const patients = [
      makePatient({ id: 'p1', priorityCategory: 'MEDIUM', priorityScore: null as unknown as undefined }),
      makePatient({ id: 'p2', priorityCategory: 'MEDIUM', priorityScore: 70 }),
    ];
    const sorted = sortPatientsByPriority(patients);
    expect(sorted.map((p) => p.id)).toEqual(['p2', 'p1']);
  });

  it('returns empty array unchanged', () => {
    expect(sortPatientsByPriority([])).toEqual([]);
  });

  it('returns single-element array unchanged', () => {
    const patients = [makePatient()];
    expect(sortPatientsByPriority(patients)).toHaveLength(1);
  });

  it('applies all three criteria in correct priority order', () => {
    const patients = [
      makePatient({ id: 'low-low',      priorityCategory: 'LOW',      priorityScore: 10, createdAt: '2024-03-01T00:00:00Z' }),
      makePatient({ id: 'critical-high',priorityCategory: 'CRITICAL',  priorityScore: 90, createdAt: '2024-01-01T00:00:00Z' }),
      makePatient({ id: 'high-low',     priorityCategory: 'HIGH',      priorityScore: 20, createdAt: '2024-01-01T00:00:00Z' }),
      makePatient({ id: 'high-high',    priorityCategory: 'HIGH',      priorityScore: 80, createdAt: '2024-01-01T00:00:00Z' }),
    ];
    const sorted = sortPatientsByPriority(patients);
    expect(sorted.map((p) => p.id)).toEqual(['critical-high', 'high-high', 'high-low', 'low-low']);
  });
});
