import { describe, it, expect } from 'vitest';
import {
  mapPriorityToDisplay,
  mapPriorityToApi,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
  type ApiPriority,
  type DisplayPriority,
} from '../priority';

describe('mapPriorityToDisplay', () => {
  it('maps API values to display values', () => {
    expect(mapPriorityToDisplay('CRITICAL')).toBe('critico');
    expect(mapPriorityToDisplay('HIGH')).toBe('alto');
    expect(mapPriorityToDisplay('MEDIUM')).toBe('medio');
    expect(mapPriorityToDisplay('LOW')).toBe('baixo');
  });

  it('is case-insensitive on input', () => {
    expect(mapPriorityToDisplay('critical')).toBe('critico');
    expect(mapPriorityToDisplay('high')).toBe('alto');
  });

  it('falls back gracefully for unknown values', () => {
    const result = mapPriorityToDisplay('UNKNOWN');
    expect(result).toBeDefined();
  });
});

describe('mapPriorityToApi', () => {
  it('maps display values to API values', () => {
    expect(mapPriorityToApi('critico')).toBe('CRITICAL');
    expect(mapPriorityToApi('alto')).toBe('HIGH');
    expect(mapPriorityToApi('medio')).toBe('MEDIUM');
    expect(mapPriorityToApi('baixo')).toBe('LOW');
  });

  it('is case-insensitive on input', () => {
    expect(mapPriorityToApi('CRITICO')).toBe('CRITICAL');
    expect(mapPriorityToApi('Alto')).toBe('HIGH');
  });

  it('falls back gracefully for unknown values', () => {
    const result = mapPriorityToApi('UNKNOWN');
    expect(result).toBeDefined();
  });
});

describe('mapPriorityToDisplay / mapPriorityToApi roundtrip', () => {
  const apiValues: ApiPriority[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

  it.each(apiValues)('roundtrips %s without data loss', (api) => {
    const display = mapPriorityToDisplay(api);
    const backToApi = mapPriorityToApi(display);
    expect(backToApi).toBe(api);
  });
});

describe('PRIORITY_LABELS', () => {
  const displayValues: DisplayPriority[] = ['critico', 'alto', 'medio', 'baixo'];

  it.each(displayValues)('has a non-empty label for %s', (priority) => {
    expect(PRIORITY_LABELS[priority]).toBeTruthy();
    expect(typeof PRIORITY_LABELS[priority]).toBe('string');
  });
});

describe('PRIORITY_COLORS', () => {
  const displayValues: DisplayPriority[] = ['critico', 'alto', 'medio', 'baixo'];

  it.each(displayValues)('has Tailwind color classes for %s', (priority) => {
    expect(PRIORITY_COLORS[priority]).toMatch(/bg-\w+-\d+/);
    expect(PRIORITY_COLORS[priority]).toMatch(/text-\w+-\d+/);
  });
});
