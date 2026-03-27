import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getReadPatientIds,
  markPatientAsRead,
  getUnreadPatientIds,
  READ_PATIENTS_UPDATED_EVENT,
} from '../read-storage';

const KEY = 'ONCONAV-chat-read-patient-ids';

describe('getReadPatientIds', () => {
  beforeEach(() => localStorage.clear());

  it('returns an empty Set when nothing is stored', () => {
    expect(getReadPatientIds().size).toBe(0);
  });

  it('returns stored IDs as a Set', () => {
    localStorage.setItem(KEY, JSON.stringify(['p1', 'p2', 'p3']));
    const ids = getReadPatientIds();
    expect(ids.has('p1')).toBe(true);
    expect(ids.has('p2')).toBe(true);
    expect(ids.has('p3')).toBe(true);
    expect(ids.size).toBe(3);
  });

  it('returns empty Set when stored JSON is invalid', () => {
    localStorage.setItem(KEY, 'not-valid-json');
    expect(getReadPatientIds().size).toBe(0);
  });

  it('returns empty Set for empty array', () => {
    localStorage.setItem(KEY, JSON.stringify([]));
    expect(getReadPatientIds().size).toBe(0);
  });
});

describe('markPatientAsRead', () => {
  beforeEach(() => localStorage.clear());

  it('adds a patient ID to localStorage', () => {
    markPatientAsRead('p1');
    expect(getReadPatientIds().has('p1')).toBe(true);
  });

  it('accumulates multiple patient IDs', () => {
    markPatientAsRead('p1');
    markPatientAsRead('p2');
    markPatientAsRead('p3');
    const ids = getReadPatientIds();
    expect(ids.size).toBe(3);
    expect(ids.has('p1')).toBe(true);
    expect(ids.has('p2')).toBe(true);
    expect(ids.has('p3')).toBe(true);
  });

  it('is idempotent — does not duplicate IDs', () => {
    markPatientAsRead('p1');
    markPatientAsRead('p1');
    markPatientAsRead('p1');
    const stored = JSON.parse(localStorage.getItem(KEY)!) as string[];
    expect(stored.filter((id) => id === 'p1')).toHaveLength(1);
  });

  it(`dispatches ${READ_PATIENTS_UPDATED_EVENT} event`, () => {
    const listener = vi.fn();
    window.addEventListener(READ_PATIENTS_UPDATED_EVENT, listener);
    markPatientAsRead('p1');
    expect(listener).toHaveBeenCalledOnce();
    window.removeEventListener(READ_PATIENTS_UPDATED_EVENT, listener);
  });

  it('dispatches event on every call, even for already-read IDs', () => {
    const listener = vi.fn();
    window.addEventListener(READ_PATIENTS_UPDATED_EVENT, listener);
    markPatientAsRead('p1');
    markPatientAsRead('p1');
    expect(listener).toHaveBeenCalledTimes(2);
    window.removeEventListener(READ_PATIENTS_UPDATED_EVENT, listener);
  });

  it('ignores calls with empty string ID', () => {
    markPatientAsRead('');
    expect(getReadPatientIds().size).toBe(0);
  });

  it('preserves existing IDs when adding a new one', () => {
    localStorage.setItem(KEY, JSON.stringify(['p1', 'p2']));
    markPatientAsRead('p3');
    const ids = getReadPatientIds();
    expect(ids.has('p1')).toBe(true);
    expect(ids.has('p2')).toBe(true);
    expect(ids.has('p3')).toBe(true);
  });
});

describe('getUnreadPatientIds', () => {
  beforeEach(() => localStorage.clear());

  it('returns all IDs when none are read', () => {
    const result = getUnreadPatientIds(['p1', 'p2', 'p3']);
    expect(result).toEqual(['p1', 'p2', 'p3']);
  });

  it('excludes IDs that have been read', () => {
    markPatientAsRead('p1');
    const result = getUnreadPatientIds(['p1', 'p2', 'p3']);
    expect(result).toEqual(['p2', 'p3']);
  });

  it('returns empty array when all are read', () => {
    markPatientAsRead('p1');
    markPatientAsRead('p2');
    expect(getUnreadPatientIds(['p1', 'p2'])).toEqual([]);
  });

  it('returns empty array for empty input', () => {
    expect(getUnreadPatientIds([])).toEqual([]);
  });

  it('preserves the order of unread IDs', () => {
    markPatientAsRead('p2');
    const result = getUnreadPatientIds(['p1', 'p2', 'p3', 'p4']);
    expect(result).toEqual(['p1', 'p3', 'p4']);
  });
});
