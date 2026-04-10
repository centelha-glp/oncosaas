import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('api-config — HTTPS / mixed content', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('alinha NEXT_PUBLIC_WS_URL ws→wss quando a página está em HTTPS', async () => {
    vi.stubGlobal('window', { location: { protocol: 'https:' } });
    vi.stubEnv('NEXT_PUBLIC_WS_URL', 'ws://localhost:3002');
    vi.stubEnv('NEXT_PUBLIC_API_URL', '');
    const { getWebSocketUrl } = await import('../api-config');
    expect(getWebSocketUrl()).toBe('wss://localhost:3002');
  });

  it('alinha NEXT_PUBLIC_API_URL http→https quando a página está em HTTPS', async () => {
    vi.stubGlobal('window', { location: { protocol: 'https:' } });
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://localhost:3002');
    const { getApiUrl } = await import('../api-config');
    expect(getApiUrl()).toBe('https://localhost:3002');
  });

  it('mantém ws:// quando a página está em HTTP', async () => {
    vi.stubGlobal('window', { location: { protocol: 'http:' } });
    vi.stubEnv('NEXT_PUBLIC_WS_URL', 'ws://localhost:3002');
    vi.stubEnv('NEXT_PUBLIC_API_URL', '');
    const { getWebSocketUrl } = await import('../api-config');
    expect(getWebSocketUrl()).toBe('ws://localhost:3002');
  });
});
