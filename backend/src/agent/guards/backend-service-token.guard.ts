import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';

@Injectable()
export class BackendServiceTokenGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const expectedToken = this.configService
      .get<string>('BACKEND_SERVICE_TOKEN')
      ?.trim();

    if (!expectedToken) {
      throw new ServiceUnavailableException('Service token not configured');
    }

    const authHeader = req.headers.authorization;
    const providedToken =
      typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
        ? authHeader.slice(7).trim()
        : '';

    if (!this.safeEqual(providedToken, expectedToken)) {
      throw new UnauthorizedException('Invalid service token');
    }

    const tenantId = this.headerValue(req, 'x-tenant-id');
    const tenantAuth = this.headerValue(req, 'x-tenant-auth');
    if (!tenantId || !tenantAuth) {
      throw new UnauthorizedException('Tenant service proof required');
    }

    const expectedTenantAuth = createHmac('sha256', expectedToken)
      .update(tenantId, 'utf8')
      .digest('hex');

    if (!this.safeEqual(tenantAuth.trim(), expectedTenantAuth)) {
      throw new UnauthorizedException('Invalid tenant service proof');
    }

    (req as Request & { internalTenantId?: string }).internalTenantId = tenantId;
    return true;
  }

  private headerValue(req: Request, name: string): string {
    const value = req.headers[name];
    return Array.isArray(value) ? value[0] || '' : value || '';
  }

  private safeEqual(a: string, b: string): boolean {
    const left = Buffer.from(a);
    const right = Buffer.from(b);
    return left.length === right.length && timingSafeEqual(left, right);
  }
}
