import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@generated/prisma/client';
import { DashboardMetricsDto } from './dto/dashboard-metrics.dto';
import { DashboardStatisticsDto } from './dto/dashboard-statistics.dto';
import { NurseMetricsDto } from './dto/nurse-metrics.dto';
import { NavigationMetricsDto } from './dto/navigation-metrics.dto';
import { PatientWithCriticalStepDto } from './dto/patients-with-critical-steps.dto';
import { CriticalTimelinesDto } from './dto/critical-timelines.dto';
import { JourneyStage } from '@generated/prisma/client';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('metrics')
  @Roles(UserRole.ONCOLOGIST, UserRole.ADMIN, UserRole.COORDINATOR)
  async getMetrics(@CurrentUser() user: any): Promise<DashboardMetricsDto> {
    return this.dashboardService.getMetrics(user.tenantId);
  }

  @Get('statistics')
  @Roles(UserRole.ONCOLOGIST, UserRole.ADMIN, UserRole.COORDINATOR)
  async getStatistics(
    @CurrentUser() user: any,
    @Query('period') period?: '7d' | '30d' | '90d'
  ): Promise<DashboardStatisticsDto> {
    return this.dashboardService.getStatistics(user.tenantId, period || '7d');
  }

  @Get('nurse-metrics')
  @Roles(
    UserRole.NURSE,
    UserRole.NURSE_CHIEF,
    UserRole.COORDINATOR,
    UserRole.ADMIN,
    UserRole.ONCOLOGIST
  )
  async getNurseMetrics(@CurrentUser() user: any): Promise<NurseMetricsDto> {
    return this.dashboardService.getNurseMetrics(user.tenantId, user.id);
  }

  @Get('navigation-metrics')
  @Roles(
    UserRole.NURSE,
    UserRole.NURSE_CHIEF,
    UserRole.COORDINATOR,
    UserRole.ADMIN,
    UserRole.ONCOLOGIST
  )
  async getNavigationMetrics(
    @CurrentUser() user: any
  ): Promise<NavigationMetricsDto> {
    return this.dashboardService.getNavigationMetrics(user.tenantId);
  }

  @Get('patients-with-critical-steps')
  @Roles(
    UserRole.ONCOLOGIST,
    UserRole.ADMIN,
    UserRole.COORDINATOR,
    UserRole.NURSE,
    UserRole.NURSE_CHIEF
  )
  async getPatientsWithCriticalSteps(
    @CurrentUser() user: any,
    @Query('journeyStage') journeyStage?: JourneyStage,
    @Query('cancerType') cancerType?: string,
    @Query('maxResults') maxResults?: string
  ): Promise<PatientWithCriticalStepDto[]> {
    // Validar e converter maxResults com fallback seguro
    let parsedMaxResults: number | undefined;
    if (maxResults) {
      const parsed = parseInt(maxResults, 10);
      parsedMaxResults =
        !isNaN(parsed) && parsed > 0 ? Math.min(parsed, 100) : undefined;
    }

    return this.dashboardService.getPatientsWithCriticalSteps(user.tenantId, {
      journeyStage,
      cancerType,
      maxResults: parsedMaxResults,
    });
  }

  @Get('pending-alerts')
  @Roles(UserRole.ONCOLOGIST, UserRole.ADMIN, UserRole.COORDINATOR)
  async getPendingAlerts(
    @CurrentUser() user: any,
    @Query('maxResults') maxResults?: string,
  ) {
    let parsedMaxResults = 100;
    if (maxResults) {
      const parsed = parseInt(maxResults, 10);
      if (!isNaN(parsed) && parsed > 0) {
        parsedMaxResults = Math.min(parsed, 500);
      }
    }
    return this.dashboardService.getPendingAlerts(
      user.tenantId,
      parsedMaxResults,
    );
  }

  @Get('patients-by-indicator')
  @Roles(UserRole.ONCOLOGIST, UserRole.ADMIN, UserRole.COORDINATOR)
  async getPatientsByIndicator(
    @CurrentUser() user: any,
    @Query('indicator') indicator?: string,
    @Query('maxResults') maxResults?: string,
  ) {
    const validIndicators = ['messages', 'biomarkers'];
    if (!indicator || !validIndicators.includes(indicator)) {
      return [];
    }
    let parsedMaxResults = 100;
    if (maxResults) {
      const parsed = parseInt(maxResults, 10);
      if (!isNaN(parsed) && parsed > 0) {
        parsedMaxResults = Math.min(parsed, 500);
      }
    }
    return this.dashboardService.getPatientsByIndicator(
      user.tenantId,
      indicator as 'messages' | 'biomarkers',
      parsedMaxResults,
    );
  }

  @Get('critical-timelines')
  @Roles(UserRole.ONCOLOGIST, UserRole.ADMIN, UserRole.COORDINATOR)
  async getCriticalTimelines(
    @CurrentUser() user: any,
  ): Promise<CriticalTimelinesDto> {
    return this.dashboardService.getCriticalTimelines(user.tenantId);
  }
}