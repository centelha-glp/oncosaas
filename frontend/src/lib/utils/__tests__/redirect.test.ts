import { describe, it, expect } from 'vitest';
import { getSafeRedirectTarget } from '../redirect';

describe('getSafeRedirectTarget', () => {
  it('uses dashboard as default destination', () => {
    expect(getSafeRedirectTarget(null)).toBe('/dashboard');
    expect(getSafeRedirectTarget('')).toBe('/dashboard');
  });

  it('accepts valid in-app paths', () => {
    expect(getSafeRedirectTarget('/dashboard')).toBe('/dashboard');
    expect(getSafeRedirectTarget('/patients/123?tab=timeline')).toBe(
      '/patients/123?tab=timeline'
    );
  });

  it('blocks unsafe external/protocol-relative redirects', () => {
    expect(getSafeRedirectTarget('https://evil.site')).toBe('/dashboard');
    expect(getSafeRedirectTarget('//evil.site')).toBe('/dashboard');
  });
});
