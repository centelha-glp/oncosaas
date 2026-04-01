import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Query,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import { InterventionsService } from './interventions.service';
import { CreateInterventionDto } from './dto/create-intervention.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@generated/prisma/client';

@Controller('interventions')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class InterventionsController {
  constructor(private readonly interventionsService: InterventionsService) {}

  @Post()
  @Roles(
    UserRole.NURSE,
    UserRole.NURSE_CHIEF,
    UserRole.COORDINATOR,
    UserRole.ONCOLOGIST,
    UserRole.ADMIN
  )
  async create(
    @Body() createInterventionDto: CreateInterventionDto,
    @Request() req
  ) {
    return this.interventionsService.create(
      createInterventionDto,
      req.user.tenantId,
      req.user.id
    );
  }

  @Get('me')
  @Roles(
    UserRole.NURSE,
    UserRole.NURSE_CHIEF,
    UserRole.COORDINATOR,
    UserRole.ONCOLOGIST,
    UserRole.ADMIN
  )
  async findMyInterventions(@Request() req) {
    return this.interventionsService.findByUser(req.user.tenantId, req.user.id);
  }

  @Get('patient/:patientId')
  @Roles(
    UserRole.NURSE,
    UserRole.NURSE_CHIEF,
    UserRole.COORDINATOR,
    UserRole.ONCOLOGIST,
    UserRole.ADMIN
  )
  async findByPatient(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Request() req
  ) {
    return this.interventionsService.findAll(
      req.user.tenantId,
      undefined,
      patientId
    );
  }

  @Get(':id')
  @Roles(
    UserRole.NURSE,
    UserRole.NURSE_CHIEF,
    UserRole.COORDINATOR,
    UserRole.ONCOLOGIST,
    UserRole.ADMIN
  )
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.interventionsService.findOne(id, req.user.tenantId);
  }
}
