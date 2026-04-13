/** Ambiente Node evita falha `instanceof Uint8Array` do jose no jsdom. */
// @vitest-environment node

import { SignJWT } from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

describe('middleware auth gating (sem JWT_SECRET — falha segura)', () => {
  beforeEach(() => {
    vi.stubEnv('JWT_SECRET', '');
  });

  it('allows public password recovery routes without session cookie', async () => {
    const forgotResponse = await middleware(buildRequest('/forgot-password'));
    const resetResponse = await middleware(buildRequest('/reset-password/token-123'));

    expect(forgotResponse.headers.get('location')).toBeNull();
    expect(resetResponse.headers.get('location')).toBeNull();
  });

  it('redirects unauthenticated access to protected pages and preserves intent', async () => {
    const response = await middleware(buildRequest('/dashboard'));
    const location = response.headers.get('location');

    expect(location).toContain('/login');
    expect(location).toContain('redirect=%2Fdashboard');
  });

  it('rejeita páginas protegidas mesmo com cookie quando JWT_SECRET está ausente', async () => {
    const validToken = buildJwt(Math.floor(Date.now() / 1000) + 60 * 5);
    const response = await middleware(
      buildRequest('/dashboard', `auth_token=${validToken}`)
    );
    const location = response.headers.get('location');
    expect(location).toContain('/login');
  });

  it('rejects invalid token cookie values', async () => {
    const response = await middleware(buildRequest('/dashboard', 'auth_token=invalid'));
    const location = response.headers.get('location');

    expect(location).toContain('/login');
  });

  it('rejects expired auth tokens', async () => {
    const expiredToken = buildJwt(Math.floor(Date.now() / 1000) - 60);
    const response = await middleware(
      buildRequest('/dashboard', `auth_token=${expiredToken}`)
    );
    const location = response.headers.get('location');

    expect(location).toContain('/login');
  });
});

describe('middleware com verificação de assinatura (JWT_SECRET)', () => {
  const signingSecret = 'middleware-test-hs256-secret';

  beforeEach(() => {
    vi.stubEnv('JWT_SECRET', signingSecret);
  });

  it('aceita JWT assinado com o mesmo segredo', async () => {
    const token = await new SignJWT({ sub: 'test' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('2h')
      .sign(new TextEncoder().encode(signingSecret));

    const response = await middleware(
      buildRequest('/dashboard', `auth_token=${encodeURIComponent(token)}`)
    );
    expect(response.headers.get('location')).toBeNull();
  });

  it('aceita cookie access_token (HttpOnly no mesmo host) com JWT assinado', async () => {
    const token = await new SignJWT({ sub: 'test' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('2h')
      .sign(new TextEncoder().encode(signingSecret));

    const response = await middleware(
      buildRequest('/dashboard', `access_token=${encodeURIComponent(token)}`)
    );
    expect(response.headers.get('location')).toBeNull();
  });

  it('rejeita JWT assinado com outro segredo', async () => {
    const token = await new SignJWT({ sub: 'test' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('2h')
      .sign(new TextEncoder().encode('outro-segredo'));

    const response = await middleware(
      buildRequest('/dashboard', `auth_token=${encodeURIComponent(token)}`)
    );
    expect(response.headers.get('location')).toContain('/login');
  });

  it('rejeita JWT legado com assinatura fictícia quando JWT_SECRET está definido', async () => {
    const fakeSigned = buildJwt(Math.floor(Date.now() / 1000) + 3600);
    const response = await middleware(
      buildRequest('/dashboard', `auth_token=${fakeSigned}`)
    );
    expect(response.headers.get('location')).toContain('/login');
  });
});
