import {
  Controller,
  Post,
  Get,
  Query,
  UseGuards,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { DispositionFeedbackService } from './disposition-feedback.service';
import { CreateDispositionFeedbackDto } from './dto/create-feedback.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '@generated/prisma/client';

@Controller('disposition-feedback')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class DispositionFeedbackController {
  constructor(private readonly service: DispositionFeedbackService) {}

  /**
   * Submit a nurse/oncologist correction of the AI-predicted disposition.
   * Used when the clinical team disagrees with the algorithm's recommendation.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.NURSE, UserRole.ONCOLOGIST, UserRole.ADMIN, UserRole.COORDINATOR)
  create(
    @Body() dto: CreateDispositionFeedbackDto,
    @CurrentUser() user: { tenantId: string; userId: string }
  ) {
    return this.service.create(dto, user.tenantId, user.userId);
  }

  /**
   * List all feedback records for the current tenant.
   */
  @Get()
  @Roles(UserRole.ADMIN, UserRole.COORDINATOR)
  findAll(@CurrentUser() user: { tenantId: string }) {
    return this.service.findByTenant(user.tenantId);
  }

  /**
   * Export anonymized training data (feature_snapshot + label) for ML retraining.
   * Used by the data science team to retrain the ordinal classifier.
   * Sempre escopo do tenant do JWT (sem export cross-tenant via query).
   */
  @Get('export')
  @Roles(UserRole.ADMIN)
  export(
    @CurrentUser() user: { tenantId: string },
    @Query('limit') limitStr?: string,
    @Query('offset') offsetStr?: string
  ) {
    const tenantId = user.tenantId;
    const parseOpt = (s?: string) => {
      if (s === undefined || s === null || s === '') {
        return undefined;
      }
      const n = Number(s);
      return Number.isFinite(n) && n >= 0 ? Math.floor(n) : undefined;
    };
    const limit = parseOpt(limitStr);
    const offset = parseOpt(offsetStr);
    const hasOpts = limit !== undefined || offset !== undefined;
    return this.service.exportTrainingData(
      tenantId,
      hasOpts ? { limit, offset } : undefined
    );
  }

  /**
   * Model accuracy stats per disposition class.
   */
  @Get('stats')
  @Roles(UserRole.ADMIN, UserRole.COORDINATOR)
  stats(@CurrentUser() user: { tenantId: string }) {
    return this.service.stats(user.tenantId);
  }
}
