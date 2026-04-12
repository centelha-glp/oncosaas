import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const PUBLIC_ROUTES = new Set([
  '/login',
  '/register',
  '/',
  '/termos',
  '/privacidade',
  '/forgot-password',
]);

function isResetPasswordRoute(pathname: string): boolean {
  return /^\/reset-password\/[^/]+$/.test(pathname);
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
  return atob(normalized + padding);
}

function hasValidAuthTokenLegacy(token: string | undefined): boolean {
  if (!token) {
    return false;
  }

  const parts = token.split('.');
  if (parts.length !== 3 || !parts[1]) {
    return false;
  }

  try {
    const payload = JSON.parse(decodeBase64Url(parts[1])) as { exp?: number };
    if (typeof payload.exp !== 'number') {
      return false;
    }

    return Date.now() / 1000 < payload.exp - 30;
  } catch {
    return false;
  }
}

/** Valida assinatura HS256 do JWT usando JWT_SECRET.
 *  [M-01] Em produção JWT_SECRET é obrigatório — sem ele, toda sessão é rejeitada.
 *  Em desenvolvimento sem JWT_SECRET, aceita apenas verificação de expiração (fallback fraco). */
async function hasValidAuthToken(token: string | undefined): Promise<boolean> {
  if (!token) {
    return false;
  }

  const secret = process.env.JWT_SECRET;
  if (secret) {
    try {
      await jwtVerify(token, new TextEncoder().encode(secret));
      return true;
    } catch {
      return false;
    }
  }

  // [M-01] Em produção sem JWT_SECRET, rejeitar toda sessão (falha segura)
  if (process.env.NODE_ENV === 'production') {
    return false;
  }

  // Desenvolvimento sem JWT_SECRET: fallback com apenas validação de expiração
  // NUNCA usar em produção — qualquer JWT forjado com exp futuro seria aceito
  return hasValidAuthTokenLegacy(token);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_ROUTES.has(pathname) || isResetPasswordRoute(pathname)) {
    return NextResponse.next();
  }

  // HttpOnly `access_token` quando API passa pelo mesmo host (rewrite). Espelho
  // `auth_token` só em modo cross-origin (API direta na porta do Nest).
  const accessToken = request.cookies.get('access_token')?.value;
  const authMirror = request.cookies.get('auth_token')?.value;
  const raw = accessToken ?? authMirror;
  const sessionActive = await hasValidAuthToken(raw);

  if (!sessionActive) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
