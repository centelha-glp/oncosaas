import {
  Controller,
  Post,
  Get,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../auth/guards/tenant.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '@generated/prisma/client';
import { FHIRSyncService } from './services/fhir-sync.service';
import { FHIRConfigService } from './services/fhir-config.service';

@Controller('fhir')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles(
  UserRole.ADMIN,
  UserRole.ONCOLOGIST,
  UserRole.DOCTOR,
  UserRole.NURSE_CHIEF,
  UserRole.NURSE,
  UserRole.COORDINATOR
)
export class FHIRController {
  constructor(
    private readonly fhirSyncService: FHIRSyncService,
    private readonly fhirConfigService: FHIRConfigService
  ) {}

  /**
   * Sincronizar observação específica com EHR
   */
  @Post('observations/:id/sync')
  @HttpCode(HttpStatus.OK)
  async syncObservation(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req
  ) {
    const config = await this.fhirConfigService.getConfig(req.user.tenantId);
    if (!config || !config.enabled) {
      throw new Error('Integração FHIR não habilitada para este tenant');
    }

    return this.fhirSyncService.syncObservationToEHR(config, id);
  }

  /**
   * Sincronizar paciente específico com EHR
   */
  @Post('patients/:id/sync')
  @HttpCode(HttpStatus.OK)
  async syncPatient(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    const config = await this.fhirConfigService.getConfig(req.user.tenantId);
    if (!config || !config.enabled) {
      throw new Error('Integração FHIR não habilitada para este tenant');
    }

    await this.fhirSyncService.syncPatientToEHR(config, id);
    return { message: 'Paciente sincronizado com sucesso' };
  }

  /**
   * Sincronizar todas as observações não sincronizadas
   */
  @Post('observations/sync-all')
  @HttpCode(HttpStatus.OK)
  async syncAllObservations(@Request() req) {
    const config = await this.fhirConfigService.getConfig(req.user.tenantId);
    if (!config || !config.enabled) {
      throw new Error('Integração FHIR não habilitada para este tenant');
    }

    // [M-03] Mesmo limite que o scheduler horário (50) para evitar timeouts e carga no EHR
    return this.fhirSyncService.syncUnsyncedObservations(config, 50);
  }

  /**
   * Fazer pull de observações do EHR para um paciente
   */
  @Post('patients/:id/pull')
  @HttpCode(HttpStatus.OK)
  async pullPatientObservations(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req
  ) {
    const config = await this.fhirConfigService.getConfig(req.user.tenantId);
    if (!config || !config.enabled) {
      throw new Error('Integração FHIR não habilitada para este tenant');
    }

    const count = await this.fhirSyncService.pullObservationsFromEHR(
      config,
      id
    );
    return {
      message: `Pull concluído`,
      observationsCreated: count,
    };
  }
}
