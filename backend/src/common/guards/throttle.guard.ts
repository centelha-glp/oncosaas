import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { RedisService } from '../../redis/redis.service';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

/**
 * Guard de Rate Limiting com Redis como store primário.
 * Faz fallback para in-memory quando Redis não está disponível.
 *
 * Limites:
 * - 100 req/min para endpoints gerais
 * - 10 req/min para login/register
 * - 200 req/min para webhooks WhatsApp
 * - 30 req/min para health checks
 */
@Injectable()
export class ThrottleGuard implements CanActivate {
  private readonly fallbackStore = new Map<string, RateLimitRecord>();
  private readonly defaultLimit = 100;
  private readonly defaultTtl = 60; // segundos
  private readonly loginLimit = 10;
  private readonly webhookLimit = 200;

  constructor(private readonly redisService: RedisService) {
    // Limpeza periódica do fallback in-memory
    setInterval(() => {
      const now = Date.now();
      for (const [key, record] of this.fallbackStore.entries()) {
        if (now > record.resetTime) {
          this.fallbackStore.delete(key);
        }
      }
    }, 60000);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const path = request.path;

    // Health/readiness probes must never be rate-limited (Docker health checks would self-block)
    if (
      path === '/health' ||
      path === '/ready' ||
      path === '/api/v1/health' ||
      path === '/api/v1/ready'
    ) {
      return true;
    }

    const ip = this.getClientIp(request);
    const limit = this.getLimit(path);
    const key = `rl:${ip}:${path}`;

    if (this.redisService.isConnected()) {
      return this.checkRedis(key, limit);
    }

    return this.checkMemory(key, limit);
  }

  private async checkRedis(key: string, limit: number): Promise<boolean> {
    const count = await this.redisService.increment(key, this.defaultTtl);

    if (count > limit) {
      const remaining = await this.redisService.ttl(key);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Muitas requisições. Tente novamente em alguns segundos.',
          retryAfter: remaining > 0 ? remaining : this.defaultTtl,
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    return true;
  }

  private checkMemory(key: string, limit: number): boolean {
    const now = Date.now();
    const record = this.fallbackStore.get(key);

    if (!record || now > record.resetTime) {
      this.fallbackStore.set(key, {
        count: 1,
        resetTime: now + this.defaultTtl * 1000,
      });
      return true;
    }

    if (record.count >= limit) {
      const retryAfter = Math.ceil((record.resetTime - now) / 1000);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Muitas requisições. Tente novamente em alguns segundos.',
          retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    record.count++;
    return true;
  }

  private getLimit(path: string): number {
    if (path.includes('/auth/login') || path.includes('/auth/register')) {
      return this.loginLimit;
    }
    if (
      path.includes('/webhook') ||
      (path.includes('/whatsapp-connections') && path.includes('/webhook'))
    ) {
      return this.webhookLimit;
    }
    return this.defaultLimit;
  }

  private getClientIp(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (forwarded) {
      const ips = Array.isArray(forwarded)
        ? forwarded[0]
        : forwarded.split(',')[0];
      return ips.trim();
    }
    return request.ip || request.socket.remoteAddress || 'unknown';
  }
}
