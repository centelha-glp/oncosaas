import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAlertDto } from './dto/create-alert.dto';
import { UpdateAlertDto } from './dto/update-alert.dto';
import { Alert, AlertStatus } from '@prisma/client';
import { AlertsGateway } from '../gateways/alerts.gateway';

/** Forward-only status transitions. A terminal state (RESOLVED/DISMISSED) cannot be left. */
const VALID_TRANSITIONS: Partial<Record<AlertStatus, AlertStatus[]>> = {
  PENDING: ['ACKNOWLEDGED', 'RESOLVED', 'DISMISSED'],
  ACKNOWLEDGED: ['RESOLVED', 'DISMISSED'],
};

@Injectable()
export class AlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly alertsGateway: AlertsGateway
  ) {}

  async findAll(
    tenantId: string,
    patientId?: string,
    status?: AlertStatus,
    options?: { limit?: number; offset?: number }
  ): Promise<Alert[]> {
    const where: any = { tenantId };
    if (patientId) {
      where.patientId = patientId;
    }
    if (status) {
      where.status = status;
    }

    // Limite padrão de 100 registros para evitar problemas de performance
    const limit =
      options?.limit && options.limit > 0 ? Math.min(options.limit, 500) : 100;
    const offset = options?.offset && options.offset > 0 ? options.offset : 0;

    return this.prisma.alert.findMany({
      where,
      orderBy: [
        { severity: 'desc' }, // Críticos primeiro
        { createdAt: 'desc' },
      ],
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            phone: true,
            priorityScore: true, // Campo correto do schema
          },
        },
      },
      take: limit,
      skip: offset,
    });
  }

  async findOne(id: string, tenantId: string): Promise<Alert> {
    const alert = await this.prisma.alert.findFirst({
      where: {
        id,
        tenantId, // SEMPRE incluir tenantId
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

    if (!alert) {
      throw new NotFoundException(`Alert with ID ${id} not found`);
    }

    return alert;
  }

  async create(
    createAlertDto: CreateAlertDto,
    tenantId: string
  ): Promise<Alert> {
    // Verificar se paciente existe e pertence ao tenant
    const patient = await this.prisma.patient.findFirst({
      where: {
        id: createAlertDto.patientId,
        tenantId,
      },
    });

    if (!patient) {
      throw new NotFoundException(
        `Patient with ID ${createAlertDto.patientId} not found`
      );
    }

    // Deduplication: return the existing open alert rather than creating a duplicate
    const existingOpenAlert = await this.prisma.alert.findFirst({
      where: {
        patientId: createAlertDto.patientId,
        type: createAlertDto.type,
        tenantId,
        status: { in: ['PENDING', 'ACKNOWLEDGED'] },
      },
      include: {
        patient: {
          select: { id: true, name: true, phone: true },
        },
      },
    });

    if (existingOpenAlert) {
      return existingOpenAlert;
    }

    const alert = await this.prisma.alert.create({
      data: {
        ...createAlertDto,
        tenantId, // SEMPRE incluir tenantId
        status: 'PENDING', // Status inicial sempre PENDING (conforme schema)
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

    // Emitir evento WebSocket para notificar clientes conectados
    if (alert.severity === 'CRITICAL') {
      this.alertsGateway.emitCriticalAlert(tenantId, alert);
    }
    this.alertsGateway.emitNewAlert(tenantId, alert);
    this.alertsGateway.emitOpenAlertsCount(
      tenantId,
      await this.getOpenAlertsCount(tenantId)
    );

    return alert;
  }

  async update(
    id: string,
    updateAlertDto: UpdateAlertDto,
    tenantId: string
  ): Promise<Alert> {
    const existingAlert = await this.prisma.alert.findFirst({
      where: { id, tenantId },
    });

    if (!existingAlert) {
      throw new NotFoundException(`Alert with ID ${id} not found`);
    }

    // Validate forward-only status transition
    if (updateAlertDto.status && updateAlertDto.status !== existingAlert.status) {
      const validNext = VALID_TRANSITIONS[existingAlert.status] ?? [];
      if (!validNext.includes(updateAlertDto.status)) {
        throw new BadRequestException(
          `Invalid status transition: ${existingAlert.status} → ${updateAlertDto.status}`
        );
      }
    }

    const updateData: any = { ...updateAlertDto };

    // Registrar timestamps de lifecycle
    if (
      updateAlertDto.status === 'RESOLVED' &&
      existingAlert.status !== 'RESOLVED'
    ) {
      updateData.resolvedAt = new Date();
    }

    if (
      updateAlertDto.status === 'ACKNOWLEDGED' &&
      existingAlert.status !== 'ACKNOWLEDGED'
    ) {
      updateData.acknowledgedAt = new Date();
    }

    if (updateAlertDto.status) {
      // Atomic conditional update: only applies if status has not changed since we read it
      const { count } = await this.prisma.alert.updateMany({
        where: { id, tenantId, status: existingAlert.status },
        data: updateData,
      });

      if (count === 0) {
        throw new ConflictException(
          'Alert status was modified by a concurrent request. Please refresh and retry.'
        );
      }
    } else {
      await this.prisma.alert.update({ where: { id, tenantId }, data: updateData });
    }

    // Re-fetch with full includes after update
    const updatedAlert = await this.findOne(id, tenantId);

    // Emitir evento WebSocket para notificar atualização
    this.alertsGateway.emitAlertUpdate(tenantId, updatedAlert);
    this.alertsGateway.emitOpenAlertsCount(
      tenantId,
      await this.getOpenAlertsCount(tenantId)
    );

    return updatedAlert;
  }

  async acknowledge(
    id: string,
    tenantId: string,
    acknowledgedBy: string
  ): Promise<Alert> {
    return this.update(
      id,
      {
        status: 'ACKNOWLEDGED',
        acknowledgedBy,
      },
      tenantId
    );
  }

  async resolve(
    id: string,
    tenantId: string,
    resolvedBy: string
  ): Promise<Alert> {
    return this.update(
      id,
      {
        status: 'RESOLVED',
        resolvedBy,
      },
      tenantId
    );
  }

  async getCriticalAlerts(tenantId: string): Promise<Alert[]> {
    return this.prisma.alert.findMany({
      where: {
        tenantId,
        severity: 'CRITICAL',
        status: { not: 'RESOLVED' },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            phone: true,
            priorityScore: true,
          },
        },
      },
    });
  }

  async getOpenAlertsCount(tenantId: string): Promise<number> {
    return this.prisma.alert.count({
      where: {
        tenantId,
        status: { not: 'RESOLVED' },
      },
    });
  }

  async getCriticalAlertsCount(tenantId: string): Promise<number> {
    return this.prisma.alert.count({
      where: {
        tenantId,
        severity: 'CRITICAL',
        status: { not: 'RESOLVED' },
      },
    });
  }

  /**
   * Cria alerta específico para piora de sintomas em paciente paliativo
   */
  async createPalliativeSymptomWorseningAlert(
    patientId: string,
    tenantId: string,
    symptoms: string[],
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' = 'HIGH'
  ): Promise<Alert> {
    return this.create(
      {
        patientId,
        type: 'PALLIATIVE_SYMPTOM_WORSENING',
        severity: severity as any,
        message: `Piora de sintomas em paciente paliativo: ${symptoms.join(', ')}`,
        context: {
          symptoms,
          alertType: 'palliative_symptom_worsening',
        },
      },
      tenantId
    );
  }

  /**
   * Cria alerta específico para necessidade de ajuste de medicação em paciente paliativo
   */
  async createPalliativeMedicationAdjustmentAlert(
    patientId: string,
    tenantId: string,
    medication: string,
    reason: string,
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' = 'MEDIUM'
  ): Promise<Alert> {
    return this.create(
      {
        patientId,
        type: 'PALLIATIVE_MEDICATION_ADJUSTMENT',
        severity: severity as any,
        message: `Necessidade de ajuste de medicação: ${medication} - ${reason}`,
        context: {
          medication,
          reason,
          alertType: 'palliative_medication_adjustment',
        },
      },
      tenantId
    );
  }

  /**
   * Cria alerta específico para necessidade de suporte familiar em paciente paliativo
   */
  async createPalliativeFamilySupportAlert(
    patientId: string,
    tenantId: string,
    reason: string,
    severity: 'HIGH' | 'MEDIUM' = 'MEDIUM'
  ): Promise<Alert> {
    return this.create(
      {
        patientId,
        type: 'PALLIATIVE_FAMILY_SUPPORT',
        severity: severity as any,
        message: `Necessidade de suporte familiar: ${reason}`,
        context: {
          reason,
          alertType: 'palliative_family_support',
        },
      },
      tenantId
    );
  }

  /**
   * Cria alerta específico para necessidade de avaliação psicossocial em paciente paliativo
   */
  async createPalliativePsychosocialAlert(
    patientId: string,
    tenantId: string,
    reason: string,
    severity: 'HIGH' | 'MEDIUM' = 'MEDIUM'
  ): Promise<Alert> {
    return this.create(
      {
        patientId,
        type: 'PALLIATIVE_PSYCHOSOCIAL',
        severity: severity as any,
        message: `Necessidade de avaliação psicossocial: ${reason}`,
        context: {
          reason,
          alertType: 'palliative_psychosocial',
        },
      },
      tenantId
    );
  }
}
