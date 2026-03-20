import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  ParseUUIDPipe,
} from '@nestjs/common';
import { PerformanceStatusService } from './performance-status.service';
import { CreatePerformanceStatusDto } from './dto/create-performance-status.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('patients/:patientId/performance-status')
export class PerformanceStatusController {
  constructor(private readonly service: PerformanceStatusService) {}

  @Get()
  findAll(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @CurrentUser() user: { tenantId: string },
  ) {
    return this.service.findAll(patientId, user.tenantId);
  }

  @Get('delta')
  getDelta(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @CurrentUser() user: { tenantId: string },
  ) {
    return this.service.getDelta(patientId, user.tenantId);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.ONCOLOGIST, UserRole.DOCTOR, UserRole.NURSE_CHIEF, UserRole.NURSE, UserRole.COORDINATOR)
  create(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Body() dto: CreatePerformanceStatusDto,
    @CurrentUser() user: { tenantId: string },
  ) {
    return this.service.create(patientId, user.tenantId, dto);
  }
}
