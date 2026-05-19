import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MedicationCatalogService } from './medication-catalog.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@generated/prisma/client';

@Controller('medication-catalog')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class MedicationCatalogController {
  constructor(
    private readonly medicationCatalogService: MedicationCatalogService
  ) {}

  @Get('routes')
  @Roles(
    UserRole.ADMIN,
    UserRole.ONCOLOGIST,
    UserRole.DOCTOR,
    UserRole.NURSE_CHIEF,
    UserRole.NURSE,
    UserRole.COORDINATOR
  )
  listRoutes() {
    return this.medicationCatalogService.listRoutes();
  }

  @Get('entries')
  @Roles(
    UserRole.ADMIN,
    UserRole.ONCOLOGIST,
    UserRole.DOCTOR,
    UserRole.NURSE_CHIEF,
    UserRole.NURSE,
    UserRole.COORDINATOR
  )
  searchEntries(
    @Query('q') q?: string,
    @Query('limit', new DefaultValuePipe(80), ParseIntPipe) limit?: number
  ) {
    const safeLimit = Math.min(Math.max(limit ?? 80, 1), 200);
    return this.medicationCatalogService.searchEntries({ q, limit: safeLimit });
  }

  @Get()
  @Roles(
    UserRole.ADMIN,
    UserRole.ONCOLOGIST,
    UserRole.DOCTOR,
    UserRole.NURSE_CHIEF,
    UserRole.NURSE,
    UserRole.COORDINATOR
  )
  search(
    @Query('q') q?: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit?: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset?: number
  ) {
    const safeLimit = Math.min(Math.max(limit ?? 50, 1), 500);
    const safeOffset = Math.max(offset ?? 0, 0);
    return this.medicationCatalogService.search({
      q,
      limit: safeLimit,
      offset: safeOffset,
    });
  }

  @Get(':drugCode/presentations')
  @Roles(
    UserRole.ADMIN,
    UserRole.ONCOLOGIST,
    UserRole.DOCTOR,
    UserRole.NURSE_CHIEF,
    UserRole.NURSE,
    UserRole.COORDINATOR
  )
  listPresentations(
    @Param('drugCode') drugCode: string,
    @Query('q') q?: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit?: number
  ) {
    const safeLimit = Math.min(Math.max(limit ?? 50, 1), 200);
    return this.medicationCatalogService.listPresentations(drugCode, {
      q,
      limit: safeLimit,
    });
  }
}
