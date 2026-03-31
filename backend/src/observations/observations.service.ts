import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PriorityRecalculationService } from '../oncology-navigation/priority-recalculation.service';
import { CreateObservationDto } from './dto/create-observation.dto';
import { UpdateObservationDto } from './dto/update-observation.dto';
import { Observation } from '@generated/prisma/client';
import { FHIRSyncService } from '../integrations/fhir/services/fhir-sync.service';
import { FHIRConfigService } from '../integrations/fhir/services/fhir-config.service';

@Injectable()
export class ObservationsService {
  private readonly logger = new Logger(ObservationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly priorityRecalculationService: PriorityRecalculationService,
    @Inject(forwardRef(() => FHIRSyncService))
    private readonly fhirSyncService: FHIRSyncService,
    @Inject(forwardRef(() => FHIRConfigService))
    private readonly fhirConfigService: FHIRConfigService
  ) {}

  async findAll(
    tenantId: string,
    patientId?: string,
    code?: string
  ): Promise<Observation[]> {
    const where: any = { tenantId };
    if (patientId) {
      where.patientId = patientId;
    }
    if (code) {
      where.code = code;
    }

    return this.prisma.observation.findMany({
      where,
      orderBy: { effectiveDateTime: 'desc' },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async findOne(id: string, tenantId: string): Promise<Observation> {
    const observation = await this.prisma.observation.findFirst({
      where: {
        id,
        tenantId, // SEMPRE incluir tenantId para isolamento
      },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
      },
    });

    if (!observation) {
      throw new NotFoundException(`Observation with ID ${id} not found`);
    }

    return observation;
  }

  async create(
    createObservationDto: CreateObservationDto,
    tenantId: string
  ): Promise<Observation> {
    // Validar que o paciente existe e pertence ao tenant
    const patient = await this.prisma.patient.findFirst({
      where: {
        id: createObservationDto.patientId,
        tenantId,
      },
    });

    if (!patient) {
      throw new NotFoundException(
        `Patient with ID ${createObservationDto.patientId} not found`
      );
    }

    // Validar messageId se fornecido
    if (createObservationDto.messageId) {
      const message = await this.prisma.message.findFirst({
        where: {
          id: createObservationDto.messageId,
          tenantId,
          patientId: createObservationDto.patientId,
        },
      });

      if (!message) {
        throw new NotFoundException(
          `Message with ID ${createObservationDto.messageId} not found`
        );
      }
    }

    const observation = await this.prisma.observation.create({
      data: {
        ...createObservationDto,
        tenantId, // SEMPRE incluir tenantId
        status: createObservationDto.status || 'final',
        effectiveDateTime: new Date(createObservationDto.effectiveDateTime),
      },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Sincronizar automaticamente com EHR se integração estiver habilitada
    this.syncToEHRIfEnabled(tenantId, observation.id).catch((error) => {
      this.logger.error(
        `Erro ao sincronizar observação ${observation.id} com EHR`,
        error
      );
      // Não falhar a criação se sincronização falhar
    });

    this.priorityRecalculationService.triggerRecalculation(
      createObservationDto.patientId,
      tenantId
    );

    return observation;
  }

  /**
   * Sincronizar observação com EHR se integração estiver habilitada
   */
  private async syncToEHRIfEnabled(
    tenantId: string,
    observationId: string
  ): Promise<void> {
    try {
      const isEnabled = await this.fhirConfigService.isEnabled(tenantId);
      if (!isEnabled) {
        return; // Integração não habilitada, pular
      }

      const config = await this.fhirConfigService.getConfig(tenantId);
      if (!config) {
        return;
      }

      // Sincronizar apenas se configurado para push ou bidirectional
      if (
        config.syncDirection === 'push' ||
        config.syncDirection === 'bidirectional'
      ) {
        // Se syncFrequency é realtime, sincronizar imediatamente
        if (config.syncFrequency === 'realtime') {
          await this.fhirSyncService.syncObservationToEHR(
            config,
            observationId
          );
        }
        // Caso contrário, será sincronizado pelo cron job
      }
    } catch (error) {
      // Log mas não propagar erro (não queremos falhar a criação da observação)
      this.logger.warn(
        `Não foi possível sincronizar observação ${observationId} com EHR`,
        error
      );
    }
  }

  async update(
    id: string,
    updateObservationDto: UpdateObservationDto,
    tenantId: string
  ): Promise<Observation> {
    // Verificar se a observação existe e pertence ao tenant
    const existing = await this.prisma.observation.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!existing) {
      throw new NotFoundException(`Observation with ID ${id} not found`);
    }

    // Validar patientId se fornecido
    if (updateObservationDto.patientId) {
      const patient = await this.prisma.patient.findFirst({
        where: {
          id: updateObservationDto.patientId,
          tenantId,
        },
      });

      if (!patient) {
        throw new NotFoundException(
          `Patient with ID ${updateObservationDto.patientId} not found`
        );
      }
    }

    // Preparar dados para atualização
    const updateData: any = { ...updateObservationDto };
    if (updateObservationDto.effectiveDateTime) {
      updateData.effectiveDateTime = new Date(
        updateObservationDto.effectiveDateTime
      );
    }

    return this.prisma.observation.update({
      where: { id, tenantId },
      data: updateData,
      include: {
        patient: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async remove(id: string, tenantId: string): Promise<void> {
    const observation = await this.prisma.observation.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!observation) {
      throw new NotFoundException(`Observation with ID ${id} not found`);
    }

    await this.prisma.observation.delete({
      where: { id, tenantId },
    });
  }

  /**
   * Marcar observação como sincronizada com EHR
   */
  async markAsSynced(
    id: string,
    tenantId: string,
    fhirResourceId: string
  ): Promise<Observation> {
    const observation = await this.prisma.observation.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!observation) {
      throw new NotFoundException(`Observation with ID ${id} not found`);
    }

    return this.prisma.observation.update({
      where: { id, tenantId },
      data: {
        syncedToEHR: true,
        syncedAt: new Date(),
        fhirResourceId,
      },
    });
  }

  /**
   * Buscar observações não sincronizadas com EHR
   */
  async findUnsynced(tenantId: string): Promise<Observation[]> {
    return this.prisma.observation.findMany({
      where: {
        tenantId,
        syncedToEHR: false,
      },
      orderBy: { effectiveDateTime: 'desc' },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }
}
