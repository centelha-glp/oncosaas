import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUser as CurrentUserType } from '../auth/decorators/current-user.decorator';
import { ClinicalSubrole, UserRole } from '@generated/prisma/client';
import { ClinicalNoteOrdersService } from './clinical-note-orders.service';
import { CreateClinicalExamRequestDto } from './dto/create-clinical-exam-request.dto';
import { CreateClinicalPrescriptionLineDto } from './dto/create-clinical-prescription-line.dto';
import { UpdateClinicalPrescriptionLineDto } from './dto/update-clinical-prescription-line.dto';
import { SuggestClinicalOrdersFromEvolutionDto } from './dto/suggest-clinical-orders-from-evolution.dto';

const ORDERS_ROLES = [
  UserRole.NURSE,
  UserRole.NURSE_CHIEF,
  UserRole.DOCTOR,
  UserRole.ONCOLOGIST,
  UserRole.COORDINATOR,
  UserRole.ADMIN,
] as const;

@Controller(
  'patients/:patientId/clinical-notes/:clinicalNoteId/clinical-orders'
)
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class PatientClinicalNoteOrdersController {
  constructor(private readonly ordersService: ClinicalNoteOrdersService) {}

  private actor(user: CurrentUserType) {
    return {
      id: user.id,
      role: user.role as UserRole,
      clinicalSubrole: user.clinicalSubrole as ClinicalSubrole | null | undefined,
    };
  }

  @Post('suggest-from-evolution')
  @Roles(...ORDERS_ROLES)
  suggestOrdersFromEvolution(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Param('clinicalNoteId', ParseUUIDPipe) clinicalNoteId: string,
    @Body() dto: SuggestClinicalOrdersFromEvolutionDto,
    @CurrentUser() user: CurrentUserType
  ) {
    return this.ordersService.suggestOrdersFromEvolution(
      patientId,
      clinicalNoteId,
      user.tenantId,
      this.actor(user),
      dto.contentMarkdown
    );
  }

  @Get('exam-requests')
  @Roles(...ORDERS_ROLES)
  listExamRequests(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Param('clinicalNoteId', ParseUUIDPipe) clinicalNoteId: string,
    @CurrentUser() user: CurrentUserType
  ) {
    return this.ordersService.listExamRequests(
      patientId,
      clinicalNoteId,
      user.tenantId
    );
  }

  @Post('exam-requests')
  @Roles(...ORDERS_ROLES)
  createExamRequest(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Param('clinicalNoteId', ParseUUIDPipe) clinicalNoteId: string,
    @Body() dto: CreateClinicalExamRequestDto,
    @CurrentUser() user: CurrentUserType
  ) {
    return this.ordersService.createExamRequest(
      patientId,
      clinicalNoteId,
      user.tenantId,
      this.actor(user),
      dto
    );
  }

  @Delete('exam-requests/:requestId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(...ORDERS_ROLES)
  deleteExamRequest(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Param('clinicalNoteId', ParseUUIDPipe) clinicalNoteId: string,
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @CurrentUser() user: CurrentUserType
  ) {
    return this.ordersService.deleteExamRequest(
      patientId,
      clinicalNoteId,
      requestId,
      user.tenantId,
      this.actor(user)
    );
  }

  @Get('prescription-lines')
  @Roles(...ORDERS_ROLES)
  listPrescriptionLines(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Param('clinicalNoteId', ParseUUIDPipe) clinicalNoteId: string,
    @CurrentUser() user: CurrentUserType
  ) {
    return this.ordersService.listPrescriptionLines(
      patientId,
      clinicalNoteId,
      user.tenantId
    );
  }

  @Post('prescription-lines')
  @Roles(...ORDERS_ROLES)
  createPrescriptionLine(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Param('clinicalNoteId', ParseUUIDPipe) clinicalNoteId: string,
    @Body() dto: CreateClinicalPrescriptionLineDto,
    @CurrentUser() user: CurrentUserType
  ) {
    return this.ordersService.createPrescriptionLine(
      patientId,
      clinicalNoteId,
      user.tenantId,
      this.actor(user),
      dto
    );
  }

  @Patch('prescription-lines/:lineId')
  @Roles(...ORDERS_ROLES)
  updatePrescriptionLine(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Param('clinicalNoteId', ParseUUIDPipe) clinicalNoteId: string,
    @Param('lineId', ParseUUIDPipe) lineId: string,
    @Body() dto: UpdateClinicalPrescriptionLineDto,
    @CurrentUser() user: CurrentUserType
  ) {
    return this.ordersService.updatePrescriptionLine(
      patientId,
      clinicalNoteId,
      lineId,
      user.tenantId,
      this.actor(user),
      dto
    );
  }

  @Delete('prescription-lines/:lineId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(...ORDERS_ROLES)
  deletePrescriptionLine(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Param('clinicalNoteId', ParseUUIDPipe) clinicalNoteId: string,
    @Param('lineId', ParseUUIDPipe) lineId: string,
    @CurrentUser() user: CurrentUserType
  ) {
    return this.ordersService.deletePrescriptionLine(
      patientId,
      clinicalNoteId,
      lineId,
      user.tenantId,
      this.actor(user)
    );
  }
}
