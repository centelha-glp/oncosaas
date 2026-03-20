import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { MedicationsService } from './medications.service';
import { CreateMedicationDto } from './dto/create-medication.dto';
import { UpdateMedicationDto } from './dto/update-medication.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('patients/:patientId/medications')
export class MedicationsController {
  constructor(private readonly service: MedicationsService) {}

  @Get()
  findAll(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @CurrentUser() user: { tenantId: string },
  ) {
    return this.service.findAll(patientId, user.tenantId);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.ONCOLOGIST, UserRole.DOCTOR, UserRole.NURSE_CHIEF, UserRole.NURSE, UserRole.COORDINATOR)
  create(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Body() dto: CreateMedicationDto,
    @CurrentUser() user: { tenantId: string },
  ) {
    return this.service.create(patientId, user.tenantId, dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.ONCOLOGIST, UserRole.DOCTOR, UserRole.NURSE_CHIEF, UserRole.NURSE, UserRole.COORDINATOR)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMedicationDto,
    @CurrentUser() user: { tenantId: string },
  ) {
    return this.service.update(id, user.tenantId, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.ONCOLOGIST, UserRole.DOCTOR, UserRole.NURSE_CHIEF, UserRole.COORDINATOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { tenantId: string },
  ) {
    return this.service.remove(id, user.tenantId);
  }
}
