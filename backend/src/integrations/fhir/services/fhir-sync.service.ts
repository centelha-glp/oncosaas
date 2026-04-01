import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { FHIRClientService } from './fhir-client.service';
import { FHIRTransformerService } from './fhir-transformer.service';
import { FHIRIntegrationConfig } from '../interfaces/fhir-config.interface';
import { Observation } from '@generated/prisma/client';

@Injectable()
export class FHIRSyncService {
  private readonly logger = new Logger(FHIRSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fhirClient: FHIRClientService,
    private readonly transformer: FHIRTransformerService
  ) {}

  /**
   * Sincronizar observação para EHR (PUSH)
   */
  async syncObservationToEHR(
    config: FHIRIntegrationConfig,
    observationId: string
  ): Promise<Observation> {
    // Buscar observação com paciente
    const observation = await this.prisma.observation.findFirst({
      where: {
        id: observationId,
        tenantId: config.tenantId,
      },
      include: {
        patient: {
          select: {
            id: true,
            ehrPatientId: true,
          },
        },
      },
    });

    if (!observation) {
      throw new NotFoundException(`Observação ${observationId} não encontrada`);
    }

    // Verificar se paciente tem ehrPatientId
    if (!observation.patient.ehrPatientId) {
      this.logger.warn(
        `Paciente ${observation.patientId} não tem ehrPatientId. Tentando sincronizar paciente primeiro...`
      );
      // Tentar sincronizar paciente primeiro
      await this.syncPatientToEHR(config, observation.patientId);
      // Buscar novamente para pegar ehrPatientId atualizado
      const updatedPatient = await this.prisma.patient.findUnique({
        where: { id: observation.patientId },
        select: { ehrPatientId: true },
      });
      if (!updatedPatient?.ehrPatientId) {
        throw new BadRequestException(
          'Não foi possível sincronizar paciente no EHR'
        );
      }
    }

    try {
      // Transformar para FHIR
      const fhirObservation = this.transformer.toFHIRObservation(observation);

      // Enviar para EHR
      const createdObservation = await this.fhirClient.createObservation(
        config,
        fhirObservation
      );

      // Atualizar observação com fhirResourceId
      const updated = await this.prisma.observation.update({
        where: { id: observationId, tenantId: config.tenantId },
        data: {
          fhirResourceId: createdObservation.id,
          syncedToEHR: true,
          syncedAt: new Date(),
        },
      });

      this.logger.log(
        `Observação ${observationId} sincronizada com EHR: ${createdObservation.id}`
      );

      return updated;
    } catch (error) {
      this.logger.error(
        `Erro ao sincronizar observação ${observationId}`,
        error
      );
      throw error;
    }
  }

  /**
   * Sincronizar paciente para EHR (PUSH)
   */
  async syncPatientToEHR(
    config: FHIRIntegrationConfig,
    patientId: string
  ): Promise<void> {
    const patient = await this.prisma.patient.findFirst({
      where: {
        id: patientId,
        tenantId: config.tenantId,
      },
    });

    if (!patient) {
      throw new NotFoundException(`Paciente ${patientId} não encontrado`);
    }

    try {
      // Transformar para FHIR
      const fhirPatient = this.transformer.toFHIRPatient(patient);

      // Enviar para EHR
      const createdPatient = await this.fhirClient.upsertPatient(
        config,
        fhirPatient
      );

      // Atualizar paciente com ehrPatientId
      await this.prisma.patient.update({
        where: { id: patientId, tenantId: config.tenantId },
        data: {
          ehrPatientId: createdPatient.id,
        },
      });

      this.logger.log(
        `Paciente ${patientId} sincronizado com EHR: ${createdPatient.id}`
      );
    } catch (error) {
      this.logger.error(`Erro ao sincronizar paciente ${patientId}`, error);
      throw error;
    }
  }

  /**
   * Buscar observações não sincronizadas e sincronizar em lote
   */
  async syncUnsyncedObservations(
    config: FHIRIntegrationConfig,
    limit: number = 50
  ): Promise<{ synced: number; failed: number }> {
    const unsynced = await this.prisma.observation.findMany({
      where: {
        tenantId: config.tenantId,
        syncedToEHR: false,
      },
      take: limit,
      include: {
        patient: {
          select: {
            id: true,
            ehrPatientId: true,
          },
        },
      },
      orderBy: {
        effectiveDateTime: 'asc', // Mais antigas primeiro
      },
    });

    let synced = 0;
    let failed = 0;

    for (const observation of unsynced) {
      try {
        await this.syncObservationToEHR(config, observation.id);
        synced++;
      } catch (error) {
        this.logger.error(
          `Falha ao sincronizar observação ${observation.id}`,
          error
        );
        failed++;
      }
    }

    this.logger.log(
      `Sincronização em lote concluída: ${synced} sincronizadas, ${failed} falhas`
    );

    return { synced, failed };
  }

  /**
   * Buscar observações do EHR para um paciente (PULL)
   */
  async pullObservationsFromEHR(
    config: FHIRIntegrationConfig,
    patientId: string
  ): Promise<number> {
    const patient = await this.prisma.patient.findFirst({
      where: {
        id: patientId,
        tenantId: config.tenantId,
      },
      select: {
        ehrPatientId: true,
      },
    });

    if (!patient?.ehrPatientId) {
      this.logger.warn(
        `Paciente ${patientId} não tem ehrPatientId. Não é possível fazer pull.`
      );
      return 0;
    }

    try {
      // Buscar observações do EHR
      const bundle = await this.fhirClient.searchObservations(config, {
        patient: patient.ehrPatientId,
        _count: 100,
      });

      if (!bundle.entry || bundle.entry.length === 0) {
        return 0;
      }

      let created = 0;

      for (const entry of bundle.entry) {
        if (entry.resource?.resourceType === 'Observation') {
          const fhirObservation = entry.resource;

          // Verificar se já existe (por fhirResourceId)
          if (fhirObservation.id) {
            const existing = await this.prisma.observation.findFirst({
              where: {
                tenantId: config.tenantId,
                fhirResourceId: fhirObservation.id,
              },
            });

            if (existing) {
              continue; // Já existe, pular
            }
          }

          // Transformar e criar
          const observationData = this.transformer.fromFHIRObservation(
            fhirObservation,
            config.tenantId,
            patientId
          );

          await this.prisma.observation.create({
            data: observationData as any,
          });

          created++;
        }
      }

      this.logger.log(
        `Pull de observações concluído: ${created} novas observações criadas`
      );

      return created;
    } catch (error) {
      this.logger.error(
        `Erro ao fazer pull de observações do paciente ${patientId}`,
        error
      );
      throw error;
    }
  }
}
