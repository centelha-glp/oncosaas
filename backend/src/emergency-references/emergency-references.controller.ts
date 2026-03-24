import {
  Controller,
  Get,
  Put,
  Delete,
  UseGuards,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { EmergencyReferencesService } from './emergency-references.service';
import { UpsertEmergencyReferenceDto } from './dto/upsert-emergency-reference.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '@prisma/client';

@Controller('emergency-reference')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class EmergencyReferencesController {
  constructor(private readonly service: EmergencyReferencesService) {}

  @Get()
  find(@CurrentUser() user: { tenantId: string }) {
    return this.service.findByTenant(user.tenantId);
  }

  @Put()
  @Roles(UserRole.ADMIN, UserRole.COORDINATOR)
  upsert(
    @Body() dto: UpsertEmergencyReferenceDto,
    @CurrentUser() user: { tenantId: string },
  ) {
    return this.service.upsert(user.tenantId, dto);
  }

  @Delete()
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: { tenantId: string }) {
    return this.service.remove(user.tenantId);
  }
}
