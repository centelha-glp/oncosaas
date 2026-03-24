import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveFiltersToStorage,
  loadFiltersFromStorage,
  clearFiltersFromStorage,
  type PatientFilters,
} from '../filter-storage';

const KEY = 'ONCONAV-patient-filters';

describe('saveFiltersToStorage', () => {
  beforeEach(() => localStorage.clear());

  it('persists filters as JSON in localStorage', () => {
    const filters: PatientFilters = { searchTerm: 'maria', priorityCategory: 'HIGH' };
    saveFiltersToStorage(filters);
    expect(localStorage.getItem(KEY)).toBe(JSON.stringify(filters));
  });

  it('overwrites previously saved filters', () => {
    saveFiltersToStorage({ searchTerm: 'antigo' });
    saveFiltersToStorage({ searchTerm: 'novo' });
    const stored = JSON.parse(localStorage.getItem(KEY)!);
    expect(stored.searchTerm).toBe('novo');
  });

  it('saves partial filter objects', () => {
    saveFiltersToStorage({ priorityCategory: 'CRITICAL' });
    const stored = JSON.parse(localStorage.getItem(KEY)!);
    expect(stored.priorityCategory).toBe('CRITICAL');
    expect(stored.searchTerm).toBeUndefined();
  });

  it('saves empty object without throwing', () => {
    expect(() => saveFiltersToStorage({})).not.toThrow();
    const stored = localStorage.getItem(KEY);
    expect(stored).toBe('{}');
  });
});

describe('loadFiltersFromStorage', () => {
  beforeEach(() => localStorage.clear());

  it('returns null when nothing is stored', () => {
    expect(loadFiltersFromStorage()).toBeNull();
  });

  it('returns the previously saved filters', () => {
    const filters: PatientFilters = { searchTerm: 'João', priorityCategory: 'LOW', cancerType: 'Bexiga' };
    localStorage.setItem(KEY, JSON.stringify(filters));
    expect(loadFiltersFromStorage()).toEqual(filters);
  });

  it('returns null when stored JSON is invalid', () => {
    localStorage.setItem(KEY, '{invalid-json-payload}');
    expect(loadFiltersFromStorage()).toBeNull();
  });

  it('round-trips all priority categories', () => {
    const categories: PatientFilters['priorityCategory'][] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', null];
    for (const priorityCategory of categories) {
      saveFiltersToStorage({ priorityCategory });
      expect(loadFiltersFromStorage()?.priorityCategory).toBe(priorityCategory);
    }
  });
});

describe('clearFiltersFromStorage', () => {
  beforeEach(() => localStorage.clear());

  it('removes the filters key from localStorage', () => {
    localStorage.setItem(KEY, JSON.stringify({ searchTerm: 'x' }));
    clearFiltersFromStorage();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('does not throw when the key is not present', () => {
    expect(() => clearFiltersFromStorage()).not.toThrow();
  });

  it('leaves other localStorage keys intact', () => {
    localStorage.setItem('other-key', 'other-value');
    saveFiltersToStorage({ searchTerm: 'test' });
    clearFiltersFromStorage();
    expect(localStorage.getItem('other-key')).toBe('other-value');
  });
});
