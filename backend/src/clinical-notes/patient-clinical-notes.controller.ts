import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUser as CurrentUserType } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@generated/prisma/client';
import { ClinicalNotesService } from './clinical-notes.service';
import { ClinicalNoteSectionSuggestionService } from './clinical-note-section-suggestion.service';
import { CreateClinicalNoteDto } from './dto/clinical-note-sections.dto';

@Controller('patients/:patientId/clinical-notes')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class PatientClinicalNotesController {
  constructor(
    private readonly clinicalNotesService: ClinicalNotesService,
    private readonly sectionSuggestionService: ClinicalNoteSectionSuggestionService
  ) {}

  private actor(user: CurrentUserType) {
    return {
      id: user.id,
      role: user.role as UserRole,
      clinicalSubrole: user.clinicalSubrole as
        | import('@generated/prisma/client').ClinicalSubrole
        | null
        | undefined,
    };
  }

  @Post()
  @Roles(
    UserRole.NURSE,
    UserRole.NURSE_CHIEF,
    UserRole.DOCTOR,
    UserRole.ONCOLOGIST,
    UserRole.COORDINATOR,
    UserRole.ADMIN
  )
  create(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Body() dto: CreateClinicalNoteDto,
    @CurrentUser() user: CurrentUserType
  ) {
    return this.clinicalNotesService.create(
      patientId,
      dto,
      user.tenantId,
      this.actor(user)
    );
  }

  @Get('section-suggestions')
  @Roles(
    UserRole.NURSE,
    UserRole.NURSE_CHIEF,
    UserRole.DOCTOR,
    UserRole.ONCOLOGIST,
    UserRole.COORDINATOR,
    UserRole.ADMIN
  )
  getSectionSuggestions(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @CurrentUser() user: CurrentUserType
  ) {
    return this.sectionSuggestionService.getSectionSuggestions(
      patientId,
      user.tenantId
    );
  }

  @Get()
  @Roles(
    UserRole.NURSE,
    UserRole.NURSE_CHIEF,
    UserRole.DOCTOR,
    UserRole.ONCOLOGIST,
    UserRole.COORDINATOR,
    UserRole.ADMIN
  )
  findAll(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @CurrentUser() user: CurrentUserType,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number
  ) {
    return this.clinicalNotesService.findAllForPatient(
      patientId,
      user.tenantId,
      page,
      limit
    );
  }
}
