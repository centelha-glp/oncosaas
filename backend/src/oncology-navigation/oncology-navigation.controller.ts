import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { OncologyNavigationService } from './oncology-navigation.service';
import { CreateNavigationStepDto } from './dto/create-navigation-step.dto';
import { UpdateNavigationStepDto } from './dto/update-navigation-step.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole, JourneyStage } from '@prisma/client';

// Interface para o arquivo do Multer
interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination: string;
  filename: string;
  path: string;
  buffer: Buffer;
}

@Controller('oncology-navigation')
@UseGuards(JwtAuthGuard, TenantGuard)
export class OncologyNavigationController {
  constructor(private readonly navigationService: OncologyNavigationService) {}

  @Get('patients/:patientId/steps')
  async getPatientSteps(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Request() req: any
  ) {
    return this.navigationService.getPatientNavigationSteps(
      patientId,
      req.user.tenantId
    );
  }

  @Get('patients/:patientId/steps/:journeyStage')
  async getStepsByStage(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Param('journeyStage') journeyStage: JourneyStage,
    @Request() req: any
  ) {
    return this.navigationService.getStepsByJourneyStage(
      patientId,
      req.user.tenantId,
      journeyStage
    );
  }

  @Post('patients/:patientId/initialize')
  @Roles(UserRole.ADMIN, UserRole.COORDINATOR, UserRole.ONCOLOGIST)
  async initializeSteps(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Body() body: { cancerType: string; currentStage: JourneyStage },
    @Request() req: any
  ) {
    await this.navigationService.initializeNavigationSteps(
      patientId,
      req.user.tenantId,
      body.cancerType,
      body.currentStage
    );
    return { message: 'Navigation steps initialized successfully' };
  }

  @Post('steps')
  @Roles(UserRole.ADMIN, UserRole.COORDINATOR, UserRole.ONCOLOGIST)
  async createStep(
    @Body() createDto: CreateNavigationStepDto,
    @Request() req: any
  ) {
    return this.navigationService.createStep(createDto, req.user.tenantId);
  }

  @Patch('steps/:id')
  @Roles(UserRole.ADMIN, UserRole.COORDINATOR, UserRole.ONCOLOGIST)
  async updateStep(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateNavigationStepDto,
    @Request() req: any
  ) {
    // Adicionar userId ao completedBy se marcando como completa
    if (updateDto.isCompleted && !updateDto.completedBy) {
      updateDto.completedBy = req.user.id;
    }

    return this.navigationService.updateStep(id, updateDto, req.user.tenantId);
  }

  @Delete('steps/:id')
  @Roles(UserRole.ADMIN, UserRole.COORDINATOR, UserRole.ONCOLOGIST)
  async deleteStep(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any
  ) {
    await this.navigationService.deleteStep(id, req.user.tenantId);
    return { message: 'Etapa excluída com sucesso' };
  }

  @Post('steps/:id/upload')
  @Roles(
    UserRole.ADMIN,
    UserRole.COORDINATOR,
    UserRole.ONCOLOGIST,
    UserRole.NURSE
  )
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/navigation-steps',
        filename: (req, file, cb) => {
          const stepId = req.params.id;
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          cb(null, `step-${stepId}-${uniqueSuffix}${ext}`);
        },
      }),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
      fileFilter: (req, file, cb) => {
        // Aceitar apenas imagens, PDFs e documentos
        const allowedMimes = [
          'image/jpeg',
          'image/png',
          'image/gif',
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ];
        if (allowedMimes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException(
              'Tipo de arquivo não permitido. Use imagens, PDFs ou documentos.'
            ),
            false
          );
        }
      },
    })
  )
  async uploadFile(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: MulterFile | undefined,
    @Request() req: any
  ) {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo foi enviado');
    }

    // Obter a etapa atual
    const step = await this.navigationService.getStepById(
      id,
      req.user.tenantId
    );

    // Preparar metadata com informações do arquivo
    const fileMetadata = {
      filename: file.filename,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      path: `/api/v1/uploads/navigation-steps/${file.filename}`,
      uploadedAt: new Date().toISOString(),
      uploadedBy: req.user.id,
    };

    // Adicionar arquivo ao metadata existente
    const existingMetadata = step.metadata || {};
    const files = (existingMetadata.files || []) as any[];
    files.push(fileMetadata);

    // Atualizar a etapa com o novo arquivo
    return this.navigationService.updateStep(
      id,
      {
        metadata: {
          ...existingMetadata,
          files,
        },
      },
      req.user.tenantId
    );
  }

  @Post('initialize-all-patients')
  @Roles(UserRole.ADMIN, UserRole.COORDINATOR)
  async initializeAllPatients(@Request() req: any) {
    const result = await this.navigationService.initializeAllPatientsSteps(
      req.user.tenantId
    );
    return {
      message: 'Etapas de navegação inicializadas para pacientes existentes',
      ...result,
    };
  }

  @Post('check-overdue')
  @Roles(UserRole.ADMIN, UserRole.COORDINATOR, UserRole.ONCOLOGIST)
  async checkOverdue(@Request() req: any) {
    const result = await this.navigationService.checkOverdueSteps(
      req.user.tenantId
    );
    return {
      message: 'Overdue steps checked and alerts created',
      ...result,
    };
  }

  @Post('check-overdue/:patientId')
  @Roles(UserRole.ADMIN, UserRole.COORDINATOR, UserRole.ONCOLOGIST)
  async checkOverdueForPatient(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Request() req: any
  ) {
    // Verificar etapas atrasadas apenas para um paciente específico
    return this.navigationService.checkOverdueStepsForPatient(
      patientId,
      req.user.tenantId
    );
  }

  @Get('patients/:patientId/step-templates/:journeyStage')
  async getStepTemplates(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Param('journeyStage') journeyStage: JourneyStage,
    @Request() req: any
  ) {
    return this.navigationService.getAvailableStepTemplates(
      patientId,
      req.user.tenantId,
      journeyStage
    );
  }

  @Post('patients/:patientId/stages/:journeyStage/create-from-template')
  @Roles(UserRole.ADMIN, UserRole.COORDINATOR, UserRole.ONCOLOGIST)
  async createStepFromTemplate(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Param('journeyStage') journeyStage: JourneyStage,
    @Body('stepKey') stepKey: string,
    @Request() req: any
  ) {
    if (!stepKey) {
      throw new BadRequestException('stepKey is required');
    }
    const step = await this.navigationService.createStepFromTemplate(
      patientId,
      req.user.tenantId,
      journeyStage,
      stepKey
    );
    return step;
  }

  @Post('patients/:patientId/stages/:journeyStage/create-missing')
  @Roles(UserRole.ADMIN, UserRole.COORDINATOR, UserRole.ONCOLOGIST)
  async createMissingStepsForStage(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Param('journeyStage') journeyStage: JourneyStage,
    @Request() req: any
  ) {
    const result = await this.navigationService.createMissingStepsForStage(
      patientId,
      req.user.tenantId,
      journeyStage
    );
    return {
      message: `Etapas faltantes criadas para o estágio ${journeyStage}`,
      ...result,
    };
  }
}