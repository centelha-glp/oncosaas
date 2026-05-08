import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
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
import { TissGuidesService } from './tiss-guides.service';
import { CreateTissSpsadtGuideDto } from './dto/create-tiss-spsadt-guide.dto';

const TISS_ROLES = [
  UserRole.NURSE,
  UserRole.NURSE_CHIEF,
  UserRole.DOCTOR,
  UserRole.ONCOLOGIST,
  UserRole.COORDINATOR,
  UserRole.ADMIN,
] as const;

@Controller()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class TissGuidesController {
  constructor(private readonly tissGuidesService: TissGuidesService) {}

  private actor(user: CurrentUserType) {
    return {
      id: user.id,
      role: user.role as UserRole,
      clinicalSubrole: user.clinicalSubrole as ClinicalSubrole | null | undefined,
    };
  }

  @Post('patients/:patientId/clinical-notes/:clinicalNoteId/tiss/sp-sadt')
  @Roles(...TISS_ROLES)
  emitSpsadtGuide(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Param('clinicalNoteId', ParseUUIDPipe) clinicalNoteId: string,
    @Body() dto: CreateTissSpsadtGuideDto,
    @CurrentUser() user: CurrentUserType
  ) {
    return this.tissGuidesService.emitSpsadtGuide({
      patientId,
      clinicalNoteId,
      tenantId: user.tenantId,
      actor: this.actor(user),
      dto,
    });
  }

  @Get('tiss/sp-sadt/:guideId')
  @Roles(...TISS_ROLES)
  getSpsadtGuide(
    @Param('guideId', ParseUUIDPipe) guideId: string,
    @CurrentUser() user: CurrentUserType
  ) {
    return this.tissGuidesService.getSpsadtGuide(guideId, user.tenantId);
  }
}

