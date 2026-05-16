import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { memoryStorage } from 'multer';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUser as CurrentUserType } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@generated/prisma/client';
import { ExamIngestService } from './exam-ingest.service';
import { CreateExamIngestSessionDto, ExamIngestExtractDto } from './dto/exam-ingest.dto';
import {
  EXAM_INGEST_MAX_FILE_BYTES,
  EXAM_INGEST_MAX_FILES_PER_SESSION,
  isExamIngestMimeAllowed,
} from './exam-ingest.constants';

const CLINICAL_WRITE_ROLES = [
  UserRole.NURSE,
  UserRole.NURSE_CHIEF,
  UserRole.DOCTOR,
  UserRole.ONCOLOGIST,
  UserRole.COORDINATOR,
  UserRole.ADMIN,
] as const;

@Controller('patients/:patientId/exam-ingest')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class ExamIngestController {
  constructor(private readonly examIngest: ExamIngestService) {}

  @Post('sessions')
  @Roles(...CLINICAL_WRITE_ROLES)
  createSession(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Body() dto: CreateExamIngestSessionDto,
    @CurrentUser() user: CurrentUserType
  ) {
    return this.examIngest.createSession(
      user.tenantId,
      user.id,
      patientId,
      dto.clinicalNoteId
    );
  }

  @Get('sessions/:sessionId')
  @Roles(...CLINICAL_WRITE_ROLES)
  getSession(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @CurrentUser() user: CurrentUserType
  ) {
    return this.examIngest.getSessionStatus(
      sessionId,
      user.tenantId,
      patientId
    );
  }

  @Post('sessions/:sessionId/files')
  @Roles(...CLINICAL_WRITE_ROLES)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: EXAM_INGEST_MAX_FILE_BYTES },
      fileFilter: (_req, file, cb) => {
        if (isExamIngestMimeAllowed(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException('Tipo de ficheiro não permitido'),
            false
          );
        }
      },
    })
  )
  async uploadDesktop(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: CurrentUserType
  ) {
    if (!file?.buffer) {
      throw new BadRequestException('Ficheiro em falta');
    }
    return this.examIngest.appendFileFromBuffer({
      sessionId,
      tenantId: user.tenantId,
      patientId,
      mimeType: file.mimetype,
      buffer: file.buffer,
    });
  }

  @Post('extract')
  @Roles(...CLINICAL_WRITE_ROLES)
  @UseInterceptors(
    FilesInterceptor('files', EXAM_INGEST_MAX_FILES_PER_SESSION, {
      storage: memoryStorage(),
      limits: { fileSize: EXAM_INGEST_MAX_FILE_BYTES },
      fileFilter: (_req, file, cb) => {
        if (isExamIngestMimeAllowed(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException('Tipo de ficheiro não permitido'),
            false
          );
        }
      },
    })
  )
  async extract(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Body() dto: ExamIngestExtractDto,
    @UploadedFiles() files: Express.Multer.File[] | undefined,
    @CurrentUser() user: CurrentUserType
  ) {
    const uploaded =
      files
        ?.filter((f) => f?.buffer && f.mimetype)
        .map((f) => ({ mimeType: f.mimetype, buffer: f.buffer })) ?? [];
    return this.examIngest.extract(user.tenantId, user.id, {
      patientId,
      plainText: dto.plainText,
      sessionId: dto.sessionId,
      uploadedFiles: uploaded.length > 0 ? uploaded : undefined,
    });
  }
}
