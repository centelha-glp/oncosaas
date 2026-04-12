import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Request } from 'express';
import { ThrottleGuard } from './throttle.guard';
import { RedisService } from '../../redis/redis.service';

const mockRedis = {
  isConnected: jest.fn().mockReturnValue(false), // usar in-memory para testes unitários
  increment: jest.fn(),
  ttl: jest.fn(),
};

function makeContext(path: string, ip = '127.0.0.1'): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        path,
        ip,
        socket: { remoteAddress: ip },
        headers: {},
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('ThrottleGuard', () => {
  let guard: ThrottleGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new ThrottleGuard(mockRedis as unknown as RedisService);
    // Limpar o fallbackStore interno
    (guard as any).fallbackStore.clear();
  });

  describe('health endpoints — sem rate limiting', () => {
    it.each(['/health', '/ready', '/api/v1/health', '/api/v1/ready'])(
      'deve permitir %s sem limite',
      async (path) => {
        const result = await guard.canActivate(makeContext(path));
        expect(result).toBe(true);
      }
    );
  });

  describe('auth endpoints — loginLimit (10 req/min)', () => {
    it.each([
      '/api/v1/auth/login',
      '/api/v1/auth/register',
      '/api/v1/auth/refresh',
      '/api/v1/auth/forgot-password',
      '/api/v1/auth/reset-password',
    ])('%s deve usar loginLimit (10 req/min)', async (path) => {
      // Fazer 10 requests deve passar
      for (let i = 0; i < 10; i++) {
        const result = await guard.canActivate(makeContext(path, `1.2.3.${i}`));
        expect(result).toBe(true);
      }
    });

    it('/auth/forgot-password deve bloquear apos o limite de loginLimit (10)', async () => {
      const path = '/api/v1/auth/forgot-password';
      // Verificar que getLimit retorna loginLimit para esse path
      const limit = (guard as any).getLimit(path);
      expect(limit).toBe((guard as any).loginLimit);

      const ip = '192.168.0.10';
      for (let i = 0; i < limit; i++) {
        await guard.canActivate(makeContext(path, ip));
      }

      await expect(guard.canActivate(makeContext(path, ip))).rejects.toThrow(HttpException);
    });

    it('/auth/reset-password deve bloquear apos o limite de loginLimit (10)', async () => {
      const path = '/api/v1/auth/reset-password';
      const limit = (guard as any).getLimit(path);
      expect(limit).toBe((guard as any).loginLimit);

      const ip = '10.0.0.50';
      for (let i = 0; i < limit; i++) {
        await guard.canActivate(makeContext(path, ip));
      }

      await expect(guard.canActivate(makeContext(path, ip))).rejects.toThrow(HttpException);
    });

    it('/auth/forgot-password e /auth/reset-password devem ter o mesmo limite que /auth/login', () => {
      const loginLimit = (guard as any).getLimit('/api/v1/auth/login');
      const forgotLimit = (guard as any).getLimit('/api/v1/auth/forgot-password');
      const resetLimit = (guard as any).getLimit('/api/v1/auth/reset-password');

      expect(forgotLimit).toBe(loginLimit);
      expect(resetLimit).toBe(loginLimit);
      // Confirma que é loginLimit (10), não defaultLimit (100) nem webhookLimit (200)
      expect(forgotLimit).toBe((guard as any).loginLimit);
      expect(resetLimit).toBe((guard as any).loginLimit);
    });
  });

  describe('endpoint geral — defaultLimit (100 req/min)', () => {
    it('deve permitir 100 requests e bloquear na 101ª', async () => {
      const path = '/api/v1/patients';
      const ip = '5.6.7.8';

      for (let i = 0; i < 100; i++) {
        const result = await guard.canActivate(makeContext(path, ip));
        expect(result).toBe(true);
      }

      await expect(guard.canActivate(makeContext(path, ip))).rejects.toThrow(HttpException);
    });
  });

  describe('webhook — webhookLimit (200 req/min)', () => {
    it('deve permitir 200 requests no webhook antes de bloquear', async () => {
      const path = '/api/v1/channel-gateway/webhook';
      const ip = '3.4.5.6';

      for (let i = 0; i < 200; i++) {
        const result = await guard.canActivate(makeContext(path, ip));
        expect(result).toBe(true);
      }

      await expect(guard.canActivate(makeContext(path, ip))).rejects.toThrow(HttpException);
    });
  });

  describe('getClientIp — A-01', () => {
    it('deve preferir request.ip ao header X-Forwarded-For (anti-spoofing)', () => {
      const req = {
        ip: '10.0.0.1',
        socket: { remoteAddress: '127.0.0.1' },
        headers: { 'x-forwarded-for': '203.0.113.50' },
      } as unknown as Request;

      expect((guard as any).getClientIp(req)).toBe('10.0.0.1');
    });
  });

  describe('IPs distintos nao interferem entre si', () => {
    it('cada IP tem contador independente para forgot-password', async () => {
      const path = '/api/v1/auth/forgot-password';

      for (let i = 0; i < 10; i++) {
        await guard.canActivate(makeContext(path, '1.1.1.1'));
      }

      // IP diferente deve ainda ter permissão
      const result = await guard.canActivate(makeContext(path, '2.2.2.2'));
      expect(result).toBe(true);
    });
  });
});
