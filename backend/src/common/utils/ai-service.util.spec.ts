import { ConfigService } from '@nestjs/config';
import {
  buildTenantServiceProof,
  getAiServiceHeadersWithTenant,
} from './ai-service.util';

describe('ai-service.util (SEC-002 tenant binding)', () => {
  it('buildTenantServiceProof matches Python hmac sha256 hex', () => {
    const token = 'test-service-token';
    const tenant = '550e8400-e29b-41d4-a716-446655440000';
    const proof = buildTenantServiceProof(token, tenant);
    expect(proof).toHaveLength(64);
    expect(proof).toMatch(/^[a-f0-9]+$/);
    const again = buildTenantServiceProof(token, tenant);
    expect(again).toBe(proof);
  });

  it('getAiServiceHeadersWithTenant inclui X-Tenant-Auth quando há token', () => {
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'AI_SERVICE_URL') return 'http://localhost:8001';
        if (key === 'BACKEND_SERVICE_TOKEN') return 'secret-token';
        return undefined;
      }),
    } as unknown as ConfigService;

    const tid = 'tenant-uuid-1';
    const h = getAiServiceHeadersWithTenant(config, tid);
    expect(h['X-Tenant-Id']).toBe(tid);
    expect(h['Authorization']).toBe('Bearer secret-token');
    expect(h['X-Tenant-Auth']).toBe(
      buildTenantServiceProof('secret-token', tid),
    );
  });

  it('getAiServiceHeadersWithTenant omite X-Tenant-Auth sem BACKEND_SERVICE_TOKEN', () => {
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'AI_SERVICE_URL') return 'http://localhost:8001';
        if (key === 'BACKEND_SERVICE_TOKEN') return undefined;
        return undefined;
      }),
    } as unknown as ConfigService;

    const h = getAiServiceHeadersWithTenant(config, 't1');
    expect(h['X-Tenant-Id']).toBe('t1');
    expect(h['X-Tenant-Auth']).toBeUndefined();
  });
});
