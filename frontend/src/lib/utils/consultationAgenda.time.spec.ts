import { describe, expect, it } from 'vitest';
import { isoUtcToSaoPauloHHmm, isoUtcToSaoPauloYmd } from './consultationAgenda';

describe('consultationAgenda timezone helpers', () => {
  it('isoUtcToSaoPauloYmd formata data civil em SP', () => {
    expect(isoUtcToSaoPauloYmd('2026-06-15T03:00:00.000Z')).toBe('2026-06-15');
  });

  it('isoUtcToSaoPauloHHmm formata hora em SP', () => {
    const t = isoUtcToSaoPauloHHmm('2026-06-15T14:30:00.000Z');
    expect(t).toMatch(/^\d{2}:\d{2}$/);
  });
});
