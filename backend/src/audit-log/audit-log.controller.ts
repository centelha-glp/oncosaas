import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { AuditLogService } from './audit-log.service';
import { QueryAuditLogDto } from './dto/query-audit-log.dto';

@Controller('audit-logs')
@UseGuards(JwtAuthGuard, TenantGuard)
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  async findAll(@Request() req, @Query() query: QueryAuditLogDto) {
    return this.auditLogService.findAll(req.user.tenantId, {
      resourceType: query.resourceType,
      resourceId: query.resourceId,
      userId: query.userId,
      action: query.action,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      limit: query.limit ?? 50,
      offset: query.offset ?? 0,
    });
  }

  @Get('summary')
  async getSummary(
    @Request() req,
    @Query('from') from: string,
    @Query('to') to: string
  ) {
    const now = new Date();
    const fromDate = from
      ? new Date(from)
      : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const toDate = to ? new Date(to) : now;
    return this.auditLogService.getSummary(req.user.tenantId, fromDate, toDate);
  }
}
