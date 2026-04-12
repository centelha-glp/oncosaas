import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, from } from 'rxjs';
import { tap, switchMap } from 'rxjs/operators';
import { AuditAction } from '@generated/prisma/client';
import { AuditLogService } from './audit-log.service';

const SENSITIVE_KEYS = new Set([
  'password',
  'apiToken',
  'oauthAccessToken',
  'appSecret',
  'mfaSecret',
  'cpf',
  'phone',
  'openaiApiKey',
  'anthropicApiKey',
  'apiKey',
  'sections',
  'sectionsPayloadEncrypted',
]);

const MAX_SANITIZE_DEPTH = 12;

const METHOD_TO_ACTION: Record<string, AuditAction> = {
  POST: AuditAction.CREATE,
  PUT: AuditAction.UPDATE,
  PATCH: AuditAction.UPDATE,
  DELETE: AuditAction.DELETE,
};

/**
 * Resource types that store PHI (Protected Health Information) or LGPD-sensitive data.
 * Audit writes for these resources are performed synchronously to guarantee delivery.
 */
const PHI_RESOURCE_TYPES = new Set([
  'patients',
  'cancer-diagnoses',
  'clinical-disposition',
  'medications',
  'performance-status',
  'observations',
  'questionnaire-responses',
]);

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
    const method = req.method as string;
    const tenantId: string | undefined = req.user?.tenantId;
    const userId: string | undefined = req.user?.sub ?? req.user?.id;

    // [A-07] Leituras GET em recursos PHI — audit VIEW síncrono (listagens e detalhe)
    if (method === 'GET') {
      if (!tenantId) {
        return next.handle();
      }
      const resourceType = this.extractResourceType(req.path as string);
      if (PHI_RESOURCE_TYPES.has(resourceType)) {
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
          switchMap((responseBody) => {
            const summary = this.summarizePhiReadResponse(responseBody);
            const pathId = this.extractResourceIdFromGetPath(req.path as string);
            const resourceId = summary.resourceId ?? pathId;
            return from(
              this.auditLogService
                .log({
                  tenantId,
                  userId,
                  action: AuditAction.VIEW,
                  resourceType,
                  resourceId,
                  newValues: summary.newValues,
                  ipAddress,
                  userAgent,
                })
                .catch((err) => {
                  this.logger.error('Sync PHI read audit log failed', err);
                })
            ).pipe(switchMap(() => from([responseBody])));
          })
        );
      }
      return next.handle();
    }

    const action = METHOD_TO_ACTION[method];

    if (!action) {
      return next.handle();
    }

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

    const isPhiResource = PHI_RESOURCE_TYPES.has(resourceType);

    if (isPhiResource) {
      // PHI mutations: synchronous audit — response waits for the log write
      return next.handle().pipe(
        switchMap((responseBody) => {
          const resourceId = this.extractResourceId(responseBody);
          return from(
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
              .catch((err) => {
                this.logger.error('Sync PHI audit log failed', err);
              })
          ).pipe(switchMap(() => from([responseBody])));
        })
      );
    }

    // Non-PHI mutations: fire-and-forget (preserves original latency)
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

  /** UUID no path (ex.: /patients/:id, /patients/:id/detail), exclui rotas reservadas. */
  private extractResourceIdFromGetPath(path: string): string | undefined {
    const segments = path
      .replace(/^\/api\/v1\//, '')
      .split('/')
      .filter(Boolean);
    if (segments.length < 2) {
      return undefined;
    }
    const cand = segments[1];
    const reserved = new Set(['by-phone', 'import']);
    if (reserved.has(cand)) {
      return undefined;
    }
    const uuidRe =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRe.test(cand)) {
      return cand;
    }
    return undefined;
  }

  /** Resumo mínimo da leitura (sem corpo PHI completo). */
  private summarizePhiReadResponse(body: unknown): {
    resourceId?: string;
    newValues: Record<string, unknown>;
  } {
    if (Array.isArray(body)) {
      return {
        newValues: { readType: 'list', itemCount: body.length },
      };
    }
    if (body && typeof body === 'object') {
      const o = body as Record<string, unknown>;
      if (Array.isArray(o['data'])) {
        const data = o['data'] as unknown[];
        return {
          newValues: { readType: 'list', itemCount: data.length },
        };
      }
      if (typeof o['id'] === 'string') {
        return {
          resourceId: o['id'],
          newValues: { readType: 'detail' },
        };
      }
    }
    return { newValues: { readType: 'view' } };
  }

  private extractResourceId(body: unknown): string | undefined {
    if (body && typeof body === 'object') {
      const obj = body as Record<string, unknown>;
      return (obj['id'] ?? obj['_id'])?.toString();
    }
    return undefined;
  }

  /** Strip large/sensitive fields before storing (recursive) */
  private sanitize(data: unknown): Record<string, unknown> | undefined {
    const sanitized = this.deepSanitize(data, 0);
    if (!sanitized || typeof sanitized !== 'object' || Array.isArray(sanitized)) {
      return undefined;
    }
    return sanitized as Record<string, unknown>;
  }

  private deepSanitize(data: unknown, depth: number): unknown {
    if (depth > MAX_SANITIZE_DEPTH) {
      return '[MaxDepth]';
    }
    if (data === null || data === undefined) {
      return data;
    }
    if (typeof data !== 'object') {
      return data;
    }
    if (data instanceof Date) {
      return data.toISOString();
    }
    if (Array.isArray(data)) {
      return data.map((item) => this.deepSanitize(item, depth + 1));
    }
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(key)) {
        out[key] = '[REDACTED]';
        continue;
      }
      out[key] = this.deepSanitize(value, depth + 1);
    }
    return out;
  }
}
