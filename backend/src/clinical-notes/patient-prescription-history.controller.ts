import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUser as CurrentUserType } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@generated/prisma/client';
import { ClinicalNoteOrdersService } from './clinical-note-orders.service';

const ORDERS_ROLES = [
  UserRole.NURSE,
  UserRole.NURSE_CHIEF,
  UserRole.DOCTOR,
  UserRole.ONCOLOGIST,
  UserRole.COORDINATOR,
  UserRole.ADMIN,
] as const;

@Controller('patients/:patientId/prescription-history')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class PatientPrescriptionHistoryController {
  constructor(private readonly ordersService: ClinicalNoteOrdersService) {}

  @Get()
  @Roles(...ORDERS_ROLES)
  list(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Query('q') q?: string,
    @Query('limit', new DefaultValuePipe(30), ParseIntPipe) limit?: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset?: number,
    @CurrentUser() user?: CurrentUserType
  ) {
    const safeLimit = Math.min(Math.max(limit ?? 30, 1), 100);
    const safeOffset = Math.max(offset ?? 0, 0);
    return this.ordersService.listPrescriptionHistory(
      patientId,
      user!.tenantId,
      { q, limit: safeLimit, offset: safeOffset }
    );
  }
}
