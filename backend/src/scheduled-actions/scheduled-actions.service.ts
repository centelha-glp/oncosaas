import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Prisma, ScheduledAction, ScheduledActionStatus } from '@generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateScheduledActionDto } from './dto/create-scheduled-action.dto';
import { QueryScheduledActionsDto } from './dto/query-scheduled-actions.dto';

@Injectable()
export class ScheduledActionsService {
  private readonly logger = new Logger(ScheduledActionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    tenantId: string,
    filters: QueryScheduledActionsDto = {}
  ): Promise<{ data: ScheduledAction[]; total: number }> {
    const { patientId, status, actionType, from, to } = filters;

    const where = {
      tenantId,
      ...(patientId && { patientId }),
      ...(status && { status }),
      ...(actionType && { actionType }),
      ...(from || to
        ? {
            scheduledAt: {
              ...(from && { gte: new Date(from) }),
              ...(to && { lte: new Date(to) }),
            },
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.scheduledAction.findMany({
        where,
        orderBy: { scheduledAt: 'asc' },
        take: 100,
      }),
      this.prisma.scheduledAction.count({ where }),
    ]);

    return { data, total };
  }

  async findOne(id: string, tenantId: string): Promise<ScheduledAction> {
    const action = await this.prisma.scheduledAction.findFirst({
      where: { id, tenantId },
    });

    if (!action) {
      throw new NotFoundException(`Scheduled action ${id} not found`);
    }

    return action;
  }

  async create(
    dto: CreateScheduledActionDto,
    tenantId: string
  ): Promise<ScheduledAction> {
    const scheduledAt = new Date(dto.scheduledAt);

    if (scheduledAt <= new Date()) {
      throw new BadRequestException('scheduledAt must be in the future');
    }

    return this.prisma.scheduledAction.create({
      data: {
        tenantId,
        patientId: dto.patientId,
        conversationId: dto.conversationId,
        actionType: dto.actionType,
        channel: dto.channel,
        scheduledAt,
        payload: dto.payload as Prisma.InputJsonValue,
        isRecurring: dto.isRecurring ?? false,
        recurrenceRule: dto.recurrenceRule,
      },
    });
  }

  async cancel(id: string, tenantId: string): Promise<ScheduledAction> {
    const action = await this.findOne(id, tenantId);

    if (
      action.status === ScheduledActionStatus.COMPLETED ||
      action.status === ScheduledActionStatus.CANCELLED
    ) {
      throw new BadRequestException(
        `Cannot cancel action with status ${action.status}`
      );
    }

    return this.prisma.scheduledAction.update({
      where: { id, tenantId },
      data: { status: ScheduledActionStatus.CANCELLED },
    });
  }

  async findUpcoming(
    tenantId: string,
    patientId?: string,
    withinHours = 24
  ): Promise<ScheduledAction[]> {
    const now = new Date();
    const until = new Date(now.getTime() + withinHours * 60 * 60 * 1000);

    return this.prisma.scheduledAction.findMany({
      where: {
        tenantId,
        ...(patientId && { patientId }),
        status: ScheduledActionStatus.PENDING,
        scheduledAt: { gte: now, lte: until },
      },
      orderBy: { scheduledAt: 'asc' },
    });
  }
}
