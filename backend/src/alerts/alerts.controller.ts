import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { CreateAlertDto } from './dto/create-alert.dto';
import { UpdateAlertDto } from './dto/update-alert.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole, AlertStatus } from '@prisma/client';

@Controller('alerts')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get()
  @Roles(
    UserRole.ADMIN,
    UserRole.ONCOLOGIST,
    UserRole.NURSE,
    UserRole.COORDINATOR
  )
  findAll(
    @CurrentUser() user: any,
    @Query('patientId') patientId?: string,
    @Query('status') status?: AlertStatus
  ) {
    return this.alertsService.findAll(user.tenantId, patientId, status);
  }

  @Get('critical')
  @Roles(
    UserRole.ADMIN,
    UserRole.ONCOLOGIST,
    UserRole.NURSE,
    UserRole.COORDINATOR
  )
  getCriticalAlerts(@CurrentUser() user: any) {
    return this.alertsService.getCriticalAlerts(user.tenantId);
  }

  @Get('open/count')
  @Roles(
    UserRole.ADMIN,
    UserRole.ONCOLOGIST,
    UserRole.NURSE,
    UserRole.COORDINATOR
  )
  async getOpenAlertsCount(@CurrentUser() user: any) {
    const count = await this.alertsService.getOpenAlertsCount(user.tenantId);
    return { count };
  }

  @Get('critical/count')
  @Roles(
    UserRole.ADMIN,
    UserRole.ONCOLOGIST,
    UserRole.NURSE,
    UserRole.COORDINATOR
  )
  async getCriticalAlertsCount(@CurrentUser() user: any) {
    const count = await this.alertsService.getCriticalAlertsCount(
      user.tenantId,
    );
    return { count };
  }

  @Get(':id')
  @Roles(
    UserRole.ADMIN,
    UserRole.ONCOLOGIST,
    UserRole.NURSE,
    UserRole.COORDINATOR
  )
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any
  ) {
    return this.alertsService.findOne(id, user.tenantId);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.COORDINATOR) // Sistema/AI pode criar alertas
  async create(
    @Body() createAlertDto: CreateAlertDto,
    @CurrentUser() user: any
  ) {
    return this.alertsService.create(createAlertDto, user.tenantId);
  }

  @Patch(':id')
  @Roles(
    UserRole.ADMIN,
    UserRole.ONCOLOGIST,
    UserRole.NURSE,
    UserRole.COORDINATOR
  )
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateAlertDto: UpdateAlertDto,
    @CurrentUser() user: any
  ) {
    return this.alertsService.update(id, updateAlertDto, user.tenantId);
  }

  @Patch(':id/acknowledge')
  @Roles(
    UserRole.ADMIN,
    UserRole.ONCOLOGIST,
    UserRole.NURSE,
    UserRole.COORDINATOR
  )
  async acknowledge(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any
  ) {
    return this.alertsService.acknowledge(id, user.tenantId, user.id);
  }

  @Patch(':id/resolve')
  @Roles(
    UserRole.ADMIN,
    UserRole.ONCOLOGIST,
    UserRole.NURSE,
    UserRole.COORDINATOR
  )
  async resolve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any
  ) {
    return this.alertsService.resolve(id, user.tenantId, user.id);
  }
}
