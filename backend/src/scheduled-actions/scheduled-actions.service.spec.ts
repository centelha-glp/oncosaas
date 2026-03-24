import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ScheduledActionsService } from './scheduled-actions.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  ChannelType,
  ScheduledActionStatus,
  ScheduledActionType,
} from '@prisma/client';
import { CreateScheduledActionDto } from './dto/create-scheduled-action.dto';

const mockPrisma = {
  scheduledAction: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

describe('ScheduledActionsService', () => {
  let service: ScheduledActionsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScheduledActionsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ScheduledActionsService>(ScheduledActionsService);
  });

  it('should reject create when scheduledAt is not in the future', async () => {
    await expect(
      service.create(
        {
          patientId: 'patient-1',
          conversationId: 'conv-1',
          actionType: ScheduledActionType.CHECK_IN,
          channel: ChannelType.WHATSAPP,
          scheduledAt: new Date(Date.now() - 60_000).toISOString(),
          payload: {},
        } as CreateScheduledActionDto,
        'tenant-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject cancel for completed/cancelled actions', async () => {
    mockPrisma.scheduledAction.findFirst.mockResolvedValue({
      id: 'a1',
      tenantId: 'tenant-1',
      status: ScheduledActionStatus.COMPLETED,
    });

    await expect(service.cancel('a1', 'tenant-1')).rejects.toThrow(BadRequestException);
  });

  it('should scope cancel write by tenant', async () => {
    mockPrisma.scheduledAction.findFirst.mockResolvedValue({
      id: 'a2',
      tenantId: 'tenant-1',
      status: ScheduledActionStatus.PENDING,
    });
    mockPrisma.scheduledAction.update.mockResolvedValue({ id: 'a2' });

    await service.cancel('a2', 'tenant-1');

    expect(mockPrisma.scheduledAction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'a2', tenantId: 'tenant-1' },
        data: { status: ScheduledActionStatus.CANCELLED },
      }),
    );
  });
});
