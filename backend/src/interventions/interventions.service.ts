import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInterventionDto } from './dto/create-intervention.dto';
import { UserRole, InterventionType } from '@generated/prisma/client';

@Injectable()
export class InterventionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    createInterventionDto: CreateInterventionDto,
    tenantId: string,
    userId: string
  ) {
    // Verificar se paciente existe e pertence ao tenant
    const patient = await this.prisma.patient.findFirst({
      where: {
        id: createInterventionDto.patientId,
        tenantId,
      },
    });

    if (!patient) {
      throw new NotFoundException(
        `Patient with ID ${createInterventionDto.patientId} not found`
      );
    }

    // Verificar se mensagem existe (se fornecida)
    if (createInterventionDto.messageId) {
      const message = await this.prisma.message.findFirst({
        where: {
          id: createInterventionDto.messageId,
          tenantId,
          patientId: createInterventionDto.patientId,
        },
      });

      if (!message) {
        throw new NotFoundException(
          `Message with ID ${createInterventionDto.messageId} not found`
        );
      }
    }

    return this.prisma.intervention.create({
      data: {
        ...createInterventionDto,
        tenantId,
        userId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        patient: {
          select: {
            id: true,
            name: true,
          },
        },
        message: {
          select: {
            id: true,
            content: true,
            direction: true,
            createdAt: true,
          },
        },
      },
    });
  }

  async findAll(tenantId: string, userId?: string, patientId?: string) {
    const where: any = { tenantId };
    if (userId) {
      where.userId = userId;
    }
    if (patientId) {
      where.patientId = patientId;
    }

    return this.prisma.intervention.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        patient: {
          select: {
            id: true,
            name: true,
          },
        },
        message: {
          select: {
            id: true,
            content: true,
            direction: true,
            createdAt: true,
          },
        },
      },
    });
  }

  async findOne(id: string, tenantId: string) {
    const intervention = await this.prisma.intervention.findFirst({
      where: {
        id,
        tenantId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        patient: {
          select: {
            id: true,
            name: true,
          },
        },
        message: {
          select: {
            id: true,
            content: true,
            direction: true,
            createdAt: true,
          },
        },
      },
    });

    if (!intervention) {
      throw new NotFoundException(`Intervention with ID ${id} not found`);
    }

    return intervention;
  }

  async findByUser(tenantId: string, userId: string) {
    return this.prisma.intervention.findMany({
      where: {
        tenantId,
        userId,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        patient: {
          select: {
            id: true,
            name: true,
          },
        },
        message: {
          select: {
            id: true,
            content: true,
            direction: true,
            createdAt: true,
          },
        },
      },
    });
  }
}
