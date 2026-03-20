import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_ROUTES = new Set(['/login', '/register', '/']);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_ROUTES.has(pathname)) {
    return NextResponse.next();
  }

  // Check for the session presence cookie set by apiClient.setToken().
  // Note: this is a lightweight presence flag, not the JWT itself.
  // The full HttpOnly cookie migration (proper server-side auth) is a planned improvement.
  const sessionActive = request.cookies.get('session_active');

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
