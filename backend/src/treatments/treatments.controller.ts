import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import { TreatmentsService } from './treatments.service';
import { CreateTreatmentDto } from './dto/create-treatment.dto';
import { UpdateTreatmentDto } from './dto/update-treatment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@generated/prisma/client';

@Controller('treatments')
@UseGuards(JwtAuthGuard, TenantGuard)
export class TreatmentsController {
  constructor(private readonly treatmentsService: TreatmentsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.ONCOLOGIST, UserRole.COORDINATOR)
  async create(@Body() createDto: CreateTreatmentDto, @Request() req: any) {
    return this.treatmentsService.create(createDto, req.user.tenantId);
  }

  @Get('patient/:patientId')
  async findAllByPatient(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Request() req: any
  ) {
    return this.treatmentsService.findAllByPatient(
      patientId,
      req.user.tenantId
    );
  }

  @Get('diagnosis/:diagnosisId')
  async findAllByDiagnosis(
    @Param('diagnosisId', ParseUUIDPipe) diagnosisId: string,
    @Request() req: any
  ) {
    return this.treatmentsService.findAllByDiagnosis(
      diagnosisId,
      req.user.tenantId
    );
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.treatmentsService.findOne(id, req.user.tenantId);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.ONCOLOGIST, UserRole.COORDINATOR)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateTreatmentDto,
    @Request() req: any
  ) {
    return this.treatmentsService.update(id, updateDto, req.user.tenantId);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.ONCOLOGIST)
  async remove(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    await this.treatmentsService.remove(id, req.user.tenantId);
    return { message: 'Treatment deleted successfully' };
  }
}
