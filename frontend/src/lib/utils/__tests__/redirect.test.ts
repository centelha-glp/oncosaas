import { getSafeRedirectTarget, getPostLoginRedirectTarget } from '../redirect';

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
    expect(getSafeRedirectTarget('/\\evil')).toBe('/dashboard');
    expect(getSafeRedirectTarget('/%5Cevil')).toBe('/dashboard');
  });
});

describe('getPostLoginRedirectTarget', () => {
  it('envia secretaria para a agenda quando não há redirect explícito', () => {
    expect(getPostLoginRedirectTarget(null, 'SECRETARY')).toBe(
      '/agenda'
    );
    expect(getPostLoginRedirectTarget(undefined, 'SECRETARY')).toBe(
      '/agenda'
    );
  });

  it('mantém dashboard como padrão para outros papéis', () => {
    expect(getPostLoginRedirectTarget(null, 'NURSE')).toBe('/dashboard');
    expect(getPostLoginRedirectTarget(null, undefined)).toBe('/dashboard');
  });

  it('prioriza redirect explícito válido (incluindo secretaria)', () => {
    expect(getPostLoginRedirectTarget('/chat', 'SECRETARY')).toBe('/chat');
  });
});
