import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditAction } from '@prisma/client';
import { AuditLogService } from './audit-log.service';

const METHOD_TO_ACTION: Record<string, AuditAction> = {
  POST: AuditAction.CREATE,
  PUT: AuditAction.UPDATE,
  PATCH: AuditAction.UPDATE,
  DELETE: AuditAction.DELETE,
};

/**
 * Automatically logs CREATE / UPDATE / DELETE actions on all mutating endpoints.
 * Apply globally via APP_INTERCEPTOR or selectively with @UseInterceptors.
 */
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLogInterceptor.name);

  constructor(private readonly auditLogService: AuditLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const action = METHOD_TO_ACTION[req.method as string];

    if (!action) {
      return next.handle();
    }

    const tenantId: string | undefined = req.user?.tenantId;
    const userId: string | undefined = req.user?.sub ?? req.user?.id;

    if (!tenantId) {
      return next.handle();
    }

    const resourceType = this.extractResourceType(req.path as string);
    const ipAddress = (
      req.headers['x-forwarded-for'] ||
      req.socket?.remoteAddress ||
      ''
    )
      .toString()
      .split(',')[0]
      .trim();
    const userAgent = (req.headers['user-agent'] || '') as string;

    return next.handle().pipe(
      tap((responseBody) => {
        const resourceId = this.extractResourceId(responseBody);

        setImmediate(() => {
          this.auditLogService
            .log({
              tenantId,
              userId,
              action,
              resourceType,
              resourceId,
              newValues:
                action !== AuditAction.DELETE
                  ? this.sanitize(responseBody)
                  : undefined,
              ipAddress,
              userAgent,
            })
            .catch((err) => this.logger.error('Async audit log failed', err));
        });
      })
    );
  }

  private extractResourceType(path: string): string {
    // e.g. /api/v1/patients/123  → "patients"
    const segments = path.replace(/^\/api\/v1\//, '').split('/');
    return segments[0] ?? 'unknown';
  }

  private extractResourceId(body: unknown): string | undefined {
    if (body && typeof body === 'object') {
      const obj = body as Record<string, unknown>;
      return (obj['id'] ?? obj['_id'])?.toString();
    }
    return undefined;
  }

  /** Strip large/sensitive fields before storing */
  private sanitize(data: unknown): Record<string, unknown> | undefined {
    if (!data || typeof data !== 'object') {
      return undefined;
    }
    const { password, apiToken, oauthAccessToken, appSecret, ...safe } =
      data as Record<string, unknown>;
    void password;
    void apiToken;
    void oauthAccessToken;
    void appSecret;
    return safe as Record<string, unknown>;
  }
}
