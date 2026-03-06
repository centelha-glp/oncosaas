import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  NotFoundException,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PatientsService } from './patients.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { UpdatePriorityDto } from './dto/update-priority.dto';
import { CreateCancerDiagnosisDto } from './dto/create-cancer-diagnosis.dto';
import { UpdateCancerDiagnosisDto } from './dto/update-cancer-diagnosis.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Controller('patients')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Get()
  @Roles(
    UserRole.ADMIN,
    UserRole.ONCOLOGIST,
    UserRole.NURSE,
    UserRole.COORDINATOR
  )
  findAll(@CurrentUser() user: any) {
    return this.patientsService.findAll(user.tenantId);
  }

  @Get('by-phone/:phone')
  @Roles(
    UserRole.ADMIN,
    UserRole.ONCOLOGIST,
    UserRole.NURSE,
    UserRole.COORDINATOR
  )
  async findByPhone(@Param('phone') phone: string, @CurrentUser() user: any) {
    const patient = await this.patientsService.findByPhone(
      phone,
      user.tenantId
    );

    if (!patient) {
      throw new NotFoundException(
        `Patient with phone number ${phone} not found`
      );
    }

    return { data: patient };
  }

  @Post('import')
  @Roles(UserRole.ADMIN, UserRole.ONCOLOGIST, UserRole.COORDINATOR)
  @UseInterceptors(FileInterceptor('file'))
  async importPatients(
    @UploadedFile() file: MulterFile | undefined,
    @CurrentUser() user: any
  ) {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo foi enviado');
    }

    if (!file.mimetype.includes('csv') && !file.originalname.endsWith('.csv')) {
      throw new BadRequestException(
        'Arquivo deve ser CSV (formato .csv ou text/csv)'
      );
    }

    try {
      const result = await this.patientsService.importFromCsv(
        file.buffer,
        user.tenantId
      );

      return {
        message: `Importação concluída: ${result.success} pacientes criados, ${result.errors.length} erros`,
        success: result.success,
        errors: result.errors,
        created: result.created,
      };
    } catch (error) {
      throw new BadRequestException(
        `Erro ao processar arquivo CSV: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
      );
    }
  }

  @Get(':id/detail')
  @Roles(
    UserRole.ADMIN,
    UserRole.ONCOLOGIST,
    UserRole.NURSE,
    UserRole.COORDINATOR
  )
  async getDetail(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any
  ) {
    const patient = await this.patientsService.getDetail(id, user.tenantId);
    return { data: patient };
  }

  @Get(':id/cancer-diagnoses')
  @Roles(
    UserRole.ADMIN,
    UserRole.ONCOLOGIST,
    UserRole.NURSE,
    UserRole.COORDINATOR
  )
  async getCancerDiagnoses(
    @Param('id', ParseUUIDPipe) patientId: string,
    @CurrentUser() user: any
  ) {
    const diagnoses = await this.patientsService.getCancerDiagnoses(
      patientId,
      user.tenantId
    );
    return { data: diagnoses };
  }

  @Post(':id/cancer-diagnoses')
  @Roles(UserRole.ADMIN, UserRole.ONCOLOGIST, UserRole.COORDINATOR)
  async createCancerDiagnosis(
    @Param('id', ParseUUIDPipe) patientId: string,
    @Body() createDto: CreateCancerDiagnosisDto,
    @CurrentUser() user: any
  ) {
    const diagnosis = await this.patientsService.createCancerDiagnosis(
      patientId,
      user.tenantId,
      createDto
    );
    return { data: diagnosis };
  }

  @Patch(':id/cancer-diagnoses/:diagnosisId')
  @Roles(UserRole.ADMIN, UserRole.ONCOLOGIST, UserRole.COORDINATOR)
  async updateCancerDiagnosis(
    @Param('id', ParseUUIDPipe) patientId: string,
    @Param('diagnosisId', ParseUUIDPipe) diagnosisId: string,
    @Body() updateDto: UpdateCancerDiagnosisDto,
    @CurrentUser() user: any
  ) {
    const diagnosis = await this.patientsService.updateCancerDiagnosis(
      diagnosisId,
      patientId,
      user.tenantId,
      updateDto
    );
    return { data: diagnosis };
  }

  @Delete(':id/cancer-diagnoses/:diagnosisId')
  @Roles(UserRole.ADMIN, UserRole.ONCOLOGIST, UserRole.COORDINATOR)
  async deleteCancerDiagnosis(
    @Param('id', ParseUUIDPipe) patientId: string,
    @Param('diagnosisId', ParseUUIDPipe) diagnosisId: string,
    @CurrentUser() user: any
  ) {
    await this.patientsService.deleteCancerDiagnosis(
      diagnosisId,
      patientId,
      user.tenantId
    );
    return { data: { success: true } };
  }

  @Get(':id')
  @Roles(
    UserRole.ADMIN,
    UserRole.ONCOLOGIST,
    UserRole.NURSE,
    UserRole.COORDINATOR
  )
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.patientsService.findOne(id, user.tenantId);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.ONCOLOGIST, UserRole.NURSE, UserRole.COORDINATOR)
  create(@Body() createPatientDto: CreatePatientDto, @CurrentUser() user: any) {
    return this.patientsService.create(createPatientDto, user.tenantId);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.ONCOLOGIST, UserRole.NURSE, UserRole.COORDINATOR)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePatientDto: UpdatePatientDto,
    @CurrentUser() user: any
  ) {
    return this.patientsService.update(id, updatePatientDto, user.tenantId);
  }

  @Post(':id/priority')
  @Roles(UserRole.ADMIN, UserRole.COORDINATOR) // Sistema/AI pode atualizar prioridade
  async updatePriority(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePriorityDto: UpdatePriorityDto,
    @CurrentUser() user: any
  ) {
    return this.patientsService.updatePriority(
      id,
      updatePriorityDto,
      user.tenantId
    );
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.patientsService.remove(id, user.tenantId);
  }
}
