import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isPublicPathname } from './lib/auth/public-paths';

const SESSION_PROBE_PATH = '/api/v1/auth/profile';
const SESSION_PROBE_TIMEOUT_MS = 2000;

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

/**
 * Hostnames permitidos para probe direto ao Nest (evita depender do BFF e do
 * gate NEXT_PUBLIC_USE_RELATIVE_API). `backend` é o nome típico no Docker Compose.
 */
function isAllowedBackendProbeHostname(hostname: string): boolean {
  if (LOOPBACK_HOSTS.has(hostname)) {
    return true;
  }
  if (hostname === 'backend') {
    return true;
  }
  return hostname.endsWith('.internal');
}

/**
 * Preferir probe HTTP direto ao Nest via BACKEND_URL (runtime no container).
 * Fallback: URL interna do próprio Next (BFF /api/v1 → Nest).
 */
function sessionProbeUrl(): string {
  const raw = process.env.BACKEND_URL?.trim();
  if (raw) {
    try {
      const base = new URL(raw);
      if (isAllowedBackendProbeHostname(base.hostname)) {
        return new URL(SESSION_PROBE_PATH, base).toString();
      }
    } catch {
      // ignora BACKEND_URL inválido
    }
  }
  return internalProbeUrl();
}

/**
 * URL interna do servidor Next.js para o probe de sessão.
 * Usa loopback (localhost) para evitar roundtrip HTTPS externo no Docker.
 * Em produção o container escuta em 0.0.0.0:3000; localhost sempre resolve localmente.
 *
 * Quando INTERNAL_APP_URL está definido, o hostname é validado para prevenir
 * SSRF interno: somente loopback e sufixo `.internal` são permitidos.
 */
function internalProbeUrl(): string {
  const raw =
    process.env.INTERNAL_APP_URL ??
    `http://localhost:${process.env.PORT ?? 3000}`;
  const parsed = new URL(raw); // lança se malformada
  const ALLOWED = new Set(['localhost', '127.0.0.1', '::1']);
  if (!ALLOWED.has(parsed.hostname) && !parsed.hostname.endsWith('.internal')) {
    // Falha segura: hostname não permitido → usa loopback padrão.
    return new URL(
      SESSION_PROBE_PATH,
      `http://localhost:${process.env.PORT ?? 3000}`
    ).toString();
  }
  return new URL(SESSION_PROBE_PATH, raw).toString();
}

async function hasActiveSession(request: NextRequest): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SESSION_PROBE_TIMEOUT_MS);

  try {
    const url = sessionProbeUrl();
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        // Importante: repassar cookies para o backend validar `access_token`/`refresh_token` HttpOnly.
        // Remover CR/LF para prevenir HTTP header injection.
        cookie: (request.headers.get('cookie') ?? '').replace(/[\r\n]/g, ''),
      },
      cache: 'no-store',
      signal: controller.signal,
    });

    return res.ok;
  } catch {
    // Falha segura: erro/timeout no probe => exigir novo login.
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPathname(pathname)) {
    return NextResponse.next();
  }

  const sessionActive = await hasActiveSession(request);

  if (!sessionActive) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Exclui /api/* intencionalmente: o probe interno usa /api/v1/auth/profile e não
  // deve ser interceptado pelo middleware para evitar loop infinito.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
