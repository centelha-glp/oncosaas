import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInternalNoteDto } from './dto/create-internal-note.dto';
import { UpdateInternalNoteDto } from './dto/update-internal-note.dto';
import { UserRole } from '@generated/prisma/client';

@Injectable()
export class InternalNotesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    createInternalNoteDto: CreateInternalNoteDto,
    tenantId: string,
    authorId: string
  ) {
    // Verificar se paciente existe e pertence ao tenant
    const patient = await this.prisma.patient.findFirst({
      where: {
        id: createInternalNoteDto.patientId,
        tenantId,
      },
    });

    if (!patient) {
      throw new NotFoundException(
        `Patient with ID ${createInternalNoteDto.patientId} not found`
      );
    }

    return this.prisma.internalNote.create({
      data: {
        ...createInternalNoteDto,
        tenantId,
        authorId,
      },
      include: {
        author: {
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
      },
    });
  }

  async findAll(
    tenantId: string,
    patientId?: string,
    options?: { limit?: number; offset?: number }
  ) {
    const where: any = { tenantId };
    if (patientId) {
      where.patientId = patientId;
    }

    // Limite padrão de 100 registros para evitar problemas de performance
    const limit =
      options?.limit && options.limit > 0 ? Math.min(options.limit, 500) : 100;
    const offset = options?.offset && options.offset > 0 ? options.offset : 0;

    return this.prisma.internalNote.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        author: {
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
      },
      take: limit,
      skip: offset,
    });
  }

  async findOne(id: string, tenantId: string) {
    const note = await this.prisma.internalNote.findFirst({
      where: {
        id,
        tenantId,
      },
      include: {
        author: {
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
      },
    });

    if (!note) {
      throw new NotFoundException(`Internal note with ID ${id} not found`);
    }

    return note;
  }

  async update(
    id: string,
    tenantId: string,
    updateInternalNoteDto: UpdateInternalNoteDto,
    userId: string,
    userRole: UserRole
  ) {
    const note = await this.prisma.internalNote.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!note) {
      throw new NotFoundException(`Internal note with ID ${id} not found`);
    }

    // Apenas autor ou ADMIN/NURSE_CHIEF pode atualizar
    if (
      note.authorId !== userId &&
      userRole !== UserRole.ADMIN &&
      userRole !== UserRole.NURSE_CHIEF
    ) {
      throw new ForbiddenException(
        'You can only update your own notes or you must be ADMIN/NURSE_CHIEF'
      );
    }

    return this.prisma.internalNote.update({
      where: { id, tenantId },
      data: updateInternalNoteDto,
      include: {
        author: {
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
      },
    });
  }

  async remove(
    id: string,
    tenantId: string,
    userId: string,
    userRole: UserRole
  ) {
    const note = await this.prisma.internalNote.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!note) {
      throw new NotFoundException(`Internal note with ID ${id} not found`);
    }

    // Apenas autor ou ADMIN/NURSE_CHIEF pode deletar
    if (
      note.authorId !== userId &&
      userRole !== UserRole.ADMIN &&
      userRole !== UserRole.NURSE_CHIEF
    ) {
      throw new ForbiddenException(
        'You can only delete your own notes or you must be ADMIN/NURSE_CHIEF'
      );
    }

    await this.prisma.internalNote.delete({
      where: { id, tenantId },
    });
  }
}
