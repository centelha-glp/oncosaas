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

/** Valida assinatura HS256 do JWT usando JWT_SECRET.
 *  [M-01] JWT_SECRET é obrigatório em todos os ambientes — sem ele, toda sessão é rejeitada.
 *  Não existe fallback de expiração: qualquer JWT forjado seria aceito sem verificação de assinatura. */
async function hasValidAuthToken(token: string | undefined): Promise<boolean> {
  if (!token) {
    return false;
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // Falha segura: sem JWT_SECRET configurado não há como validar assinatura.
    // Isso rejeita todas as sessões até que JWT_SECRET seja configurado corretamente.
    return false;
  }

  try {
    await jwtVerify(token, new TextEncoder().encode(secret));
    return true;
  } catch {
    return false;
  }
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
