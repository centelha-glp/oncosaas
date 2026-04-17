/**
 * Proxy BFF: /api/v1/* → Nest (BACKEND_URL).
 * LGPD / segurança: não registar corpo nem cookies em logs; repasse só o necessário.
 */
import { NextRequest, NextResponse } from 'next/server';
import { Agent } from 'undici';
import { hasUnsafeApiPathSegments } from '@/lib/security/assert-safe-api-path';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
  'host',
]);

function backendBase(): string {
  return (
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://127.0.0.1:3002'
  ).replace(/\/$/, '');
}

let devAgent: Agent | undefined;

function getDispatcher(): Agent | undefined {
  if (process.env.NODE_ENV === 'production') {
    return undefined;
  }
  if (!devAgent) {
    devAgent = new Agent({
      connect: { rejectUnauthorized: false },
    });
  }
  return devAgent;
}

function targetUrl(pathParts: string[] | undefined, search: string): string {
  const tail = pathParts?.length ? pathParts.join('/') : '';
  const slash = tail ? `/${tail}` : '';
  return `${backendBase()}/api/v1${slash}${search}`;
}

function forwardHeaders(h: Headers): Headers {
  const out = new Headers();
  h.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) {
      out.append(key, value);
    }
  });
  return out;
}

/**
 * Repassa a resposta do Nest para o browser preservando **todos** os `Set-Cookie`.
 * Um `return fetch(backend)` direto costuma perder cookies múltiplos (access + refresh):
 * o middleware Next não recebe `access_token` HttpOnly e o utilizador fica preso no /login.
 */
function forwardBackendResponse(backendRes: Response): NextResponse {
  const nextRes = new NextResponse(backendRes.body, {
    status: backendRes.status,
    statusText: backendRes.statusText,
  });

  backendRes.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') {
      return;
    }
    nextRes.headers.append(key, value);
  });

  const withSetCookie = backendRes.headers as Headers & {
    getSetCookie?: () => string[];
  };
  const cookies = withSetCookie.getSetCookie?.() ?? [];
  for (const cookie of cookies) {
    nextRes.headers.append('Set-Cookie', cookie);
  }

  if (cookies.length === 0) {
    const fallback = backendRes.headers.get('set-cookie');
    if (fallback) {
      nextRes.headers.append('Set-Cookie', fallback);
    }
  }

  return nextRes;
}

/**
 * BFF ativo quando explicitamente habilitado ou quando há BACKEND_URL em runtime
 * (Docker/ECS). Usar só `NEXT_PUBLIC_USE_RELATIVE_API !== 'true'` quebrava o proxy
 * se o build não embutisse `true` ou se o runtime divergisse — o probe do middleware
 * recebia 404 e redirecionava para /login.
 */
function isBffProxyEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_USE_RELATIVE_API === 'false') {
    return false;
  }
  if (process.env.NEXT_PUBLIC_USE_RELATIVE_API === 'true') {
    return true;
  }
  return Boolean(process.env.BACKEND_URL?.trim());
}

async function proxy(
  req: NextRequest,
  context: { params: Promise<{ path?: string[] }> }
): Promise<Response> {
  if (!isBffProxyEnabled()) {
    return NextResponse.json(
      { message: 'API relativa desativada (NEXT_PUBLIC_USE_RELATIVE_API).' },
      { status: 404 }
    );
  }

  const { path } = await context.params;
  if (hasUnsafeApiPathSegments(path)) {
    return NextResponse.json({ message: 'Path inválido' }, { status: 400 });
  }
  const url = targetUrl(path, req.nextUrl.search);

  const init: Record<string, unknown> = {
    method: req.method,
    headers: forwardHeaders(req.headers),
    dispatcher: getDispatcher(),
  };

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = req.body;
    init.duplex = 'half';
  }

  const backendRes = await fetch(url, init as RequestInit);
  return forwardBackendResponse(backendRes);
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  return proxy(req, ctx);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  return proxy(req, ctx);
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  return proxy(req, ctx);
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  return proxy(req, ctx);
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  return proxy(req, ctx);
}

export async function OPTIONS(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  return proxy(req, ctx);
}
