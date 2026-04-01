import { Injectable, Logger } from '@nestjs/common';
import { AuditAction, AuditLog, Prisma } from '@generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateAuditLogParams {
  tenantId: string;
  userId?: string;
  action: AuditAction;
  resourceType: string;
  resourceId?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditLogFilters {
  resourceType?: string;
  resourceId?: string;
  userId?: string;
  action?: AuditAction;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(params: CreateAuditLogParams): Promise<AuditLog> {
    try {
      return await this.prisma.auditLog.create({
        data: {
          tenantId: params.tenantId,
          userId: params.userId,
          action: params.action,
          resourceType: params.resourceType,
          resourceId: params.resourceId,
          oldValues: params.oldValues as Prisma.InputJsonValue,
          newValues: params.newValues as Prisma.InputJsonValue,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
        },
      });
    } catch (error) {
      // Audit logging must never break the main flow
      this.logger.error('Failed to persist audit log', error);
      return null as unknown as AuditLog;
    }
  }

  async findAll(
    tenantId: string,
    filters: AuditLogFilters = {}
  ): Promise<{ data: AuditLog[]; total: number }> {
    const {
      resourceType,
      resourceId,
      userId,
      action,
      from,
      to,
      limit = 50,
      offset = 0,
    } = filters;

    const where = {
      tenantId,
      ...(resourceType && { resourceType }),
      ...(resourceId && { resourceId }),
      ...(userId && { userId }),
      ...(action && { action }),
      ...(from || to
        ? {
            createdAt: {
              ...(from && { gte: from }),
              ...(to && { lte: to }),
            },
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, 200),
        skip: offset,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { data, total };
  }

  async getSummary(
    tenantId: string,
    from: Date,
    to: Date
  ): Promise<{ action: string; count: number }[]> {
    const rows = await this.prisma.auditLog.groupBy({
      by: ['action'],
      where: { tenantId, createdAt: { gte: from, lte: to } },
      _count: { action: true },
    });

    return rows.map((r) => ({ action: r.action, count: r._count.action }));
  }
}
