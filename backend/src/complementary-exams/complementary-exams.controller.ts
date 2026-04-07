import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  ForbiddenException,
  DefaultValuePipe,
} from '@nestjs/common';
import { ComplementaryExamsService } from './complementary-exams.service';
import { CreateComplementaryExamDto } from './dto/create-complementary-exam.dto';
import { UpdateComplementaryExamDto } from './dto/update-complementary-exam.dto';
import { CreateComplementaryExamResultDto } from './dto/create-complementary-exam-result.dto';
import { UpdateComplementaryExamResultDto } from './dto/update-complementary-exam-result.dto';
import { SoftDeleteComplementaryExamResultDto } from './dto/soft-delete-complementary-exam-result.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole, ComplementaryExamType } from '@generated/prisma/client';

@Controller('patients/:patientId/complementary-exams')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.ONCOLOGIST, UserRole.DOCTOR, UserRole.NURSE_CHIEF, UserRole.NURSE, UserRole.COORDINATOR)
export class ComplementaryExamsController {
  constructor(
    private readonly complementaryExamsService: ComplementaryExamsService,
  ) {}

  @Get()
  findAll(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Request() req: { user: { tenantId: string } },
    @Query('type') type?: ComplementaryExamType,
  ) {
    return this.complementaryExamsService.findAllByPatient(
      patientId,
      req.user.tenantId,
      type,
    );
  }

  @Get(':examId')
  findOne(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Param('examId', ParseUUIDPipe) examId: string,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.complementaryExamsService.findOne(
      patientId,
      examId,
      req.user.tenantId,
    );
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Body() createDto: CreateComplementaryExamDto,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.complementaryExamsService.create(
      patientId,
      req.user.tenantId,
      createDto,
    );
  }

  @Patch(':examId')
  update(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Param('examId', ParseUUIDPipe) examId: string,
    @Body() updateDto: UpdateComplementaryExamDto,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.complementaryExamsService.update(
      patientId,
      examId,
      req.user.tenantId,
      updateDto,
    );
  }

  @Delete(':examId')
  @HttpCode(HttpStatus.OK)
  remove(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Param('examId', ParseUUIDPipe) examId: string,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.complementaryExamsService.remove(
      patientId,
      examId,
      req.user.tenantId,
    );
  }

  @Get(':examId/results')
  findResults(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Param('examId', ParseUUIDPipe) examId: string,
    @Request() req: { user: { tenantId: string; role: UserRole } },
    @Query('includeDeleted') includeDeleted?: string,
  ) {
    if (includeDeleted === 'true') {
      // Only ADMIN can view deleted results
      if (req.user.role !== UserRole.ADMIN) {
        throw new ForbiddenException('Apenas ADMIN pode visualizar resultados excluídos.');
      }
    }
    return this.complementaryExamsService.findResults(
      patientId,
      examId,
      req.user.tenantId,
      includeDeleted === 'true',
    );
  }

  @Post(':examId/results')
  @HttpCode(HttpStatus.CREATED)
  addResult(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Param('examId', ParseUUIDPipe) examId: string,
    @Body() createDto: CreateComplementaryExamResultDto,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.complementaryExamsService.addResult(
      patientId,
      examId,
      req.user.tenantId,
      createDto,
    );
  }

  @Patch(':examId/results/:resultId')
  updateResult(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Param('examId', ParseUUIDPipe) examId: string,
    @Param('resultId', ParseUUIDPipe) resultId: string,
    @Body() updateDto: UpdateComplementaryExamResultDto,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.complementaryExamsService.updateResult(
      patientId,
      examId,
      resultId,
      req.user.tenantId,
      updateDto,
    );
  }

  @Delete(':examId/results/:resultId')
  @HttpCode(HttpStatus.OK)
  removeResult(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Param('examId', ParseUUIDPipe) examId: string,
    @Param('resultId', ParseUUIDPipe) resultId: string,
    @Body(new DefaultValuePipe({})) body: SoftDeleteComplementaryExamResultDto,
    @CurrentUser() user: CurrentUser,
  ) {
    const payload = body ?? {};
    return this.complementaryExamsService.removeResult(
      patientId,
      examId,
      resultId,
      user.tenantId,
      { reason: payload.reason, deletedByUserId: user.id },
    );
  }

  @Post(':examId/results/:resultId/restore')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN)
  restoreResult(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Param('examId', ParseUUIDPipe) examId: string,
    @Param('resultId', ParseUUIDPipe) resultId: string,
    @CurrentUser() user: CurrentUser,
  ) {
    return this.complementaryExamsService.restoreResult(
      patientId,
      examId,
      resultId,
      user.tenantId,
      { restoredByUserId: user.id },
    );
  }
}
