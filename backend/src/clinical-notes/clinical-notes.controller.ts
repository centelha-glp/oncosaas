import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUser as CurrentUserType } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@generated/prisma/client';
import { ClinicalNotesService } from './clinical-notes.service';
import { ClinicalNoteExtractionService } from '../clinical-note-extraction/clinical-note-extraction.service';
import { RejectClinicalExtractionDto } from './dto/reject-clinical-extraction.dto';
import {
  UpdateClinicalNoteDto,
  AddendumClinicalNoteDto,
  VoidClinicalNoteDto,
} from './dto/clinical-note-sections.dto';
import { ClinicalSubrole } from '@generated/prisma/client';

const CLINICAL_READ_ROLES = [
  UserRole.NURSE,
  UserRole.NURSE_CHIEF,
  UserRole.DOCTOR,
  UserRole.ONCOLOGIST,
  UserRole.COORDINATOR,
  UserRole.ADMIN,
] as const;

@Controller('clinical-notes')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class ClinicalNotesController {
  constructor(
    private readonly clinicalNotesService: ClinicalNotesService,
    private readonly clinicalNoteExtractionService: ClinicalNoteExtractionService
  ) {}

  private actor(user: CurrentUserType) {
    return {
      id: user.id,
      role: user.role as UserRole,
      clinicalSubrole: user.clinicalSubrole as ClinicalSubrole | null | undefined,
    };
  }

  private auditCtx(req: Request) {
    const ip = (
      req.headers['x-forwarded-for'] ||
      req.socket?.remoteAddress ||
      ''
    )
      .toString()
      .split(',')[0]
      .trim();
    return {
      ipAddress: ip || undefined,
      userAgent: (req.headers['user-agent'] || '') as string,
    };
  }

  @Get(':id/versions')
  @Roles(...CLINICAL_READ_ROLES)
  findVersions(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserType
  ) {
    return this.clinicalNotesService.findVersions(id, user.tenantId);
  }

  @Get(':id/thread')
  @Roles(...CLINICAL_READ_ROLES)
  getThread(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserType
  ) {
    return this.clinicalNotesService.getThread(id, user.tenantId);
  }

  @Get(':id/extraction-status')
  @Roles(...CLINICAL_READ_ROLES)
  getExtractionStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserType
  ) {
    return this.clinicalNoteExtractionService.getExtractionStatus(
      id,
      user.tenantId
    );
  }

  @Post(':id/extraction-undo')
  @Roles(
    UserRole.NURSE,
    UserRole.NURSE_CHIEF,
    UserRole.DOCTOR,
    UserRole.ONCOLOGIST,
    UserRole.COORDINATOR,
    UserRole.ADMIN
  )
  undoExtraction(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserType
  ) {
    return this.clinicalNoteExtractionService.undoExtraction(
      id,
      user.tenantId,
      this.actor(user)
    );
  }

  @Post(':id/extraction-approve')
  @Roles(
    UserRole.NURSE,
    UserRole.NURSE_CHIEF,
    UserRole.DOCTOR,
    UserRole.ONCOLOGIST,
    UserRole.COORDINATOR,
    UserRole.ADMIN
  )
  approveExtraction(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserType
  ) {
    return this.clinicalNoteExtractionService.approveExtraction(
      id,
      user.tenantId,
      this.actor(user)
    );
  }

  @Post(':id/extraction-reject')
  @Roles(
    UserRole.NURSE,
    UserRole.NURSE_CHIEF,
    UserRole.DOCTOR,
    UserRole.ONCOLOGIST,
    UserRole.COORDINATOR,
    UserRole.ADMIN
  )
  rejectExtraction(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectClinicalExtractionDto,
    @CurrentUser() user: CurrentUserType
  ) {
    return this.clinicalNoteExtractionService.rejectExtraction(
      id,
      user.tenantId,
      this.actor(user),
      dto.reason
    );
  }

  @Post(':id/extraction-retry')
  @Roles(
    UserRole.NURSE,
    UserRole.NURSE_CHIEF,
    UserRole.DOCTOR,
    UserRole.ONCOLOGIST,
    UserRole.COORDINATOR,
    UserRole.ADMIN
  )
  retryStructureExtraction(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserType
  ) {
    return this.clinicalNotesService.retryStructureExtraction(
      id,
      user.tenantId,
      this.actor(user)
    );
  }

  @Get(':id')
  @Roles(...CLINICAL_READ_ROLES)
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserType,
    @Req() req: Request
  ) {
    return this.clinicalNotesService.findOne(
      id,
      user.tenantId,
      this.actor(user),
      this.auditCtx(req)
    );
  }

  @Patch(':id')
  @Roles(
    UserRole.NURSE,
    UserRole.NURSE_CHIEF,
    UserRole.DOCTOR,
    UserRole.ONCOLOGIST,
    UserRole.COORDINATOR,
    UserRole.ADMIN
  )
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClinicalNoteDto,
    @CurrentUser() user: CurrentUserType
  ) {
    return this.clinicalNotesService.update(
      id,
      dto,
      user.tenantId,
      this.actor(user)
    );
  }

  @Post(':id/sign')
  @Roles(
    UserRole.NURSE,
    UserRole.NURSE_CHIEF,
    UserRole.DOCTOR,
    UserRole.ONCOLOGIST,
    UserRole.COORDINATOR,
    UserRole.ADMIN
  )
  sign(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserType
  ) {
    return this.clinicalNotesService.sign(id, user.tenantId, this.actor(user));
  }

  @Post(':id/addendum')
  @Roles(
    UserRole.NURSE,
    UserRole.NURSE_CHIEF,
    UserRole.DOCTOR,
    UserRole.ONCOLOGIST,
    UserRole.COORDINATOR,
    UserRole.ADMIN
  )
  addendum(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddendumClinicalNoteDto,
    @CurrentUser() user: CurrentUserType
  ) {
    return this.clinicalNotesService.addendum(
      id,
      dto,
      user.tenantId,
      this.actor(user)
    );
  }

  @Post(':id/void')
  @Roles(
    UserRole.NURSE,
    UserRole.NURSE_CHIEF,
    UserRole.DOCTOR,
    UserRole.ONCOLOGIST,
    UserRole.COORDINATOR,
    UserRole.ADMIN
  )
  voidNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VoidClinicalNoteDto,
    @CurrentUser() user: CurrentUserType
  ) {
    return this.clinicalNotesService.voidNote(
      id,
      dto,
      user.tenantId,
      this.actor(user)
    );
  }
}
