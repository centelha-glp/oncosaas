import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from './middleware';

const buildRequest = (pathname: string, cookie?: string) =>
  new NextRequest(`https://onconav.local${pathname}`, {
    headers: cookie ? { cookie } : {},
  });

const base64UrlEncode = (value: string) =>
  btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

const buildJwt = (exp: number) => {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64UrlEncode(JSON.stringify({ exp }));
  return `${header}.${payload}.signature`;
};

describe('middleware auth gating', () => {
  it('allows public password recovery routes without session cookie', () => {
    const forgotResponse = middleware(buildRequest('/forgot-password'));
    const resetResponse = middleware(buildRequest('/reset-password/token-123'));

    expect(forgotResponse.headers.get('location')).toBeNull();
    expect(resetResponse.headers.get('location')).toBeNull();
  });

  it('redirects unauthenticated access to protected pages and preserves intent', () => {
    const response = middleware(buildRequest('/dashboard'));
    const location = response.headers.get('location');

    expect(location).toContain('/login');
    expect(location).toContain('redirect=%2Fdashboard');
  });

  it('allows protected pages when session cookie is active', () => {
    const validToken = buildJwt(Math.floor(Date.now() / 1000) + 60 * 5);
    const response = middleware(
      buildRequest('/dashboard', `auth_token=${validToken}`)
    );
    expect(response.headers.get('location')).toBeNull();
  });

  it('rejects invalid token cookie values', () => {
    const response = middleware(buildRequest('/dashboard', 'auth_token=invalid'));
    const location = response.headers.get('location');

    expect(location).toContain('/login');
  });

  it('rejects expired auth tokens', () => {
    const expiredToken = buildJwt(Math.floor(Date.now() / 1000) - 60);
    const response = middleware(
      buildRequest('/dashboard', `auth_token=${expiredToken}`)
    );
    const location = response.headers.get('location');

    expect(location).toContain('/login');
  });
});
