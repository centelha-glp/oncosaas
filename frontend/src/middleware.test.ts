import { middleware } from './middleware';

function buildRequest(pathname: string, cookie?: string) {
  const url = `https://onconav.local${pathname}`;
  const headers = new Headers(cookie ? { cookie } : {});

  const request = {
    url,
    headers,
    nextUrl: new URL(url),
  };

  return request as unknown as Parameters<typeof middleware>[0];
}

describe('middleware auth gating (probe no backend)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Garantir que `fetch` e outros globals stubados não vazem entre testes.
    vi.unstubAllGlobals?.();
  });

  it('allows public password recovery routes without session cookie', async () => {
    const forgotResponse = await middleware(buildRequest('/forgot-password'));
    const resetResponse = await middleware(buildRequest('/reset-password/token-123'));

    expect(forgotResponse.headers.get('location')).toBeNull();
    expect(resetResponse.headers.get('location')).toBeNull();
  });

  it('redirects unauthenticated access to protected pages and preserves intent', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 401 })));
    const response = await middleware(buildRequest('/dashboard'));
    const location = response.headers.get('location');

    expect(location).toContain('/login');
    expect(location).toContain('redirect=%2Fdashboard');
  });

  it('permite rota protegida quando o backend retorna 200 no probe (cookie presente)', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: 'u1' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const response = await middleware(
      buildRequest('/dashboard', 'access_token=token')
    );
    expect(response.headers.get('location')).toBeNull();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    // Probe usa URL interna (loopback) — não o hostname externo da requisição original.
    // Isso evita roundtrip HTTPS externo no Docker de produção.
    expect(calledUrl).toBe('http://localhost:3000/api/v1/auth/profile');
    expect(init?.method).toBe('GET');
    expect((init?.headers as Record<string, string>)?.cookie).toContain('access_token=token');
  });
  it('usa INTERNAL_APP_URL quando hostname é .internal (permitido)', async () => {
    process.env.INTERNAL_APP_URL = 'http://app.internal:4000';
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await middleware(buildRequest('/dashboard', 'access_token=token'));
    const [calledUrl] = fetchMock.mock.calls[0] as unknown as [string];
    expect(calledUrl).toBe('http://app.internal:4000/api/v1/auth/profile');
    delete process.env.INTERNAL_APP_URL;
  });

  it('cai para localhost quando INTERNAL_APP_URL tem hostname externo não permitido', async () => {
    process.env.INTERNAL_APP_URL = 'http://169.254.169.254/';
    const fetchMock = vi.fn(async () => new Response(null, { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);
    await middleware(buildRequest('/dashboard', 'access_token=token'));
    const [calledUrl] = fetchMock.mock.calls[0] as unknown as [string];
    // Deve usar loopback, não o hostname malicioso
    expect(calledUrl).toContain('localhost');
    expect(calledUrl).not.toContain('169.254');
    delete process.env.INTERNAL_APP_URL;
  });

  it('sanitiza CR/LF no header cookie para evitar header injection', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    // Simula `headers.get('cookie')` retornando string com newlines
    // (Headers nativa rejeita newlines; aqui testamos que a sanitização
    //  funciona mesmo se o valor chegar por outro caminho, ex: mock de ambiente)
    const req = buildRequest('/dashboard');
    vi.spyOn(req.headers, 'get').mockReturnValue('access_token=token\r\nX-Evil: injected');

    await middleware(req);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const cookie = (init?.headers as Record<string, string>)?.cookie ?? '';
    expect(cookie).not.toMatch(/[\r\n]/);
    expect(cookie).toContain('access_token=token');
  });

  it('redireciona rota protegida quando o backend retorna 401 no probe', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 401 })));
    const response = await middleware(buildRequest('/dashboard', 'access_token=token'));
    const location = response.headers.get('location');

    expect(location).toContain('/login');
  });

  it('redireciona rota protegida quando o probe falha (erro/timeout)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('network');
    }));
    const response = await middleware(buildRequest('/dashboard', 'access_token=token'));
    const location = response.headers.get('location');

    expect(location).toContain('/login');
  });
});
