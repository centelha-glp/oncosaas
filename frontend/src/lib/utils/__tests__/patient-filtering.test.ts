import { describe, it, expect } from 'vitest';
import { filterPatientsBySearch, filterPatients } from '../patient-filtering';
import type { Patient } from '@/lib/api/patients';

// Minimal patient fixture — only the fields used by filtering logic.
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
    ...overrides,
  }) as Patient;

describe('filterPatientsBySearch', () => {
  it('returns all patients when search term is empty', () => {
    const patients = [makePatient(), makePatient({ id: 'p2', name: 'João Costa' })];
    expect(filterPatientsBySearch(patients, '')).toHaveLength(2);
    expect(filterPatientsBySearch(patients, '   ')).toHaveLength(2);
  });

  it('matches by name (case-insensitive, partial)', () => {
    const patients = [
      makePatient({ name: 'Maria Silva' }),
      makePatient({ id: 'p2', name: 'João Costa' }),
    ];
    expect(filterPatientsBySearch(patients, 'maria')).toHaveLength(1);
    expect(filterPatientsBySearch(patients, 'SILVA')).toHaveLength(1);
    expect(filterPatientsBySearch(patients, 'a')).toHaveLength(2); // both names contain 'a'
  });

  it('matches by CPF digits', () => {
    const patients = [makePatient({ cpf: '123.456.789-00' })];
    expect(filterPatientsBySearch(patients, '123')).toHaveLength(1);
    expect(filterPatientsBySearch(patients, '999')).toHaveLength(0);
  });

  it('returns empty array when no match', () => {
    const patients = [makePatient({ name: 'Maria Silva' })];
    expect(filterPatientsBySearch(patients, 'zzz')).toHaveLength(0);
  });
});

describe('filterPatients', () => {
  const patients = [
    makePatient({ id: 'p1', name: 'Alice', priorityCategory: 'CRITICAL' }),
    makePatient({ id: 'p2', name: 'Bob', priorityCategory: 'LOW' }),
    makePatient({ id: 'p3', name: 'Carol', priorityCategory: 'MEDIUM' }),
  ];

  it('returns all patients with no filters', () => {
    expect(filterPatients(patients, {})).toHaveLength(3);
  });

  it('filters by priorityCategory', () => {
    const result = filterPatients(patients, { priorityCategory: 'CRITICAL' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('p1');
  });

  it('filters by search term', () => {
    const result = filterPatients(patients, { searchTerm: 'bob' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('p2');
  });

  it('applies multiple filters as AND', () => {
    const result = filterPatients(patients, {
      searchTerm: 'a',        // matches Alice and Carol
      priorityCategory: 'LOW', // matches Bob only
    });
    expect(result).toHaveLength(0); // no patient satisfies both
  });

  it('filters by cancerType from cancerDiagnoses', () => {
    const withDiagnosis = [
      makePatient({
        id: 'p1',
        cancerDiagnoses: [{ cancerType: 'Mama', id: 'd1' } as never],
      }),
      makePatient({ id: 'p2', cancerDiagnoses: [] }),
    ];
    const result = filterPatients(withDiagnosis, { cancerType: 'mama' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('p1');
  });

  it('filters unread-only when unreadPatientIds is set', () => {
    const unreadIds = new Set(['p1', 'p3']);
    const result = filterPatients(patients, {
      unreadOnly: true,
      unreadPatientIds: unreadIds,
    });
    expect(result.map((p) => p.id)).toEqual(['p1', 'p3']);
  });

  it('ignores unread filter when unreadPatientIds is empty', () => {
    const result = filterPatients(patients, {
      unreadOnly: true,
      unreadPatientIds: new Set(),
    });
    expect(result).toHaveLength(3);
  });
});
