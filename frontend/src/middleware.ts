import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

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

function hasValidAuthToken(token: string | undefined): boolean {
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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_ROUTES.has(pathname) || isResetPasswordRoute(pathname)) {
    return NextResponse.next();
  }

  // Validate mirrored access token cookie to avoid allowing routes with a mere
  // boolean session flag. Full server-issued HttpOnly cookie auth is still preferred.
  const authToken = request.cookies.get('auth_token')?.value;
  const sessionActive = hasValidAuthToken(authToken);

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
