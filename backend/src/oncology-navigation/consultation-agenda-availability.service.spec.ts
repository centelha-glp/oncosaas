import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConsultationAgendaAvailabilityService } from './consultation-agenda-availability.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CONSULTATION_AGENDA_TIMEZONE,
  generateCandidateSlotStarts,
  parseWeeklyPatternJson,
} from './consultation-agenda-slot.utils';

describe('ConsultationAgendaAvailabilityService', () => {
  let service: ConsultationAgendaAvailabilityService;

  const mockPrisma = {
    consultationAgendaConfig: { findFirst: jest.fn() },
    consultationAgendaBlock: { findMany: jest.fn() },
    navigationStep: { findMany: jest.fn(), count: jest.fn() },
  };

  const weeklyPattern = parseWeeklyPatternJson({
    activeWeekdays: [1, 2, 3, 4, 5],
    shifts: [{ startLocal: '9:00', endLocal: '12:00' }],
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConsultationAgendaAvailabilityService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get(ConsultationAgendaAvailabilityService);
  });

  it('getDayAvailabilityOverview: sem config marca UNAVAILABLE em todos os dias', async () => {
    mockPrisma.consultationAgendaConfig.findFirst.mockResolvedValue(null);
    const from = new Date('2026-05-11T08:00:00.000Z');
    const to = new Date('2026-05-13T08:00:00.000Z');
    const out = await service.getDayAvailabilityOverview({
      tenantId: 't1',
      professionalId: 'p1',
      from,
      to,
    });
    expect(Object.keys(out).length).toBeGreaterThan(0);
    for (const v of Object.values(out)) {
      expect(v).toBe('UNAVAILABLE');
    }
  });

  it('getDayAvailabilityOverview: dia útil com grelha e sem reservas tem HAS_SLOTS', async () => {
    mockPrisma.consultationAgendaConfig.findFirst.mockResolvedValue({
      weeklyPattern,
      defaultConsultationDurationMinutes: 30,
      maxConsultationsPerDay: null,
    });
    mockPrisma.consultationAgendaBlock.findMany.mockResolvedValue([]);
    mockPrisma.navigationStep.findMany.mockResolvedValue([]);
    mockPrisma.navigationStep.count.mockResolvedValue(0);

    const from = new Date('2026-05-11T12:00:00.000Z');
    const to = new Date('2026-05-12T12:00:00.000Z');
    const out = await service.getDayAvailabilityOverview({
      tenantId: 't1',
      professionalId: 'p1',
      from,
      to,
    });

    const ymdMonday = '2026-05-11';
    expect(out[ymdMonday]).toBe('HAS_SLOTS');
  });

  it('getDayAvailabilityOverview: único slot do dia ocupado fica FULL', async () => {
    const patternOneSlot = parseWeeklyPatternJson({
      activeWeekdays: [1],
      shifts: [{ startLocal: '9:00', endLocal: '9:30' }],
    });
    const rangeFrom = new Date('2026-05-11T12:00:00.000Z');
    const rangeTo = new Date('2026-05-12T12:00:00.000Z');
    const [onlySlot] = generateCandidateSlotStarts({
      rangeFromUtc: rangeFrom,
      rangeToUtc: rangeTo,
      pattern: patternOneSlot,
      durationMinutes: 30,
      timeZone: CONSULTATION_AGENDA_TIMEZONE,
    });
    expect(onlySlot).toBeDefined();

    mockPrisma.consultationAgendaConfig.findFirst.mockResolvedValue({
      weeklyPattern: patternOneSlot,
      defaultConsultationDurationMinutes: 30,
      maxConsultationsPerDay: null,
    });
    mockPrisma.consultationAgendaBlock.findMany.mockResolvedValue([]);
    mockPrisma.navigationStep.findMany.mockResolvedValue([
      { expectedDate: onlySlot },
    ]);
    mockPrisma.navigationStep.count.mockResolvedValue(0);

    const out = await service.getDayAvailabilityOverview({
      tenantId: 't1',
      professionalId: 'p1',
      from: rangeFrom,
      to: rangeTo,
    });
    expect(out['2026-05-11']).toBe('FULL');
  });

  it('getDayAvailabilityOverview: bloqueio cobre todos os candidatos fica UNAVAILABLE', async () => {
    mockPrisma.consultationAgendaConfig.findFirst.mockResolvedValue({
      weeklyPattern,
      defaultConsultationDurationMinutes: 30,
      maxConsultationsPerDay: null,
    });
    mockPrisma.consultationAgendaBlock.findMany.mockResolvedValue([
      {
        startsAt: new Date('2026-01-01T00:00:00.000Z'),
        endsAt: new Date('2030-01-01T00:00:00.000Z'),
      },
    ]);
    mockPrisma.navigationStep.findMany.mockResolvedValue([]);
    mockPrisma.navigationStep.count.mockResolvedValue(0);

    const from = new Date('2026-05-11T12:00:00.000Z');
    const to = new Date('2026-05-12T12:00:00.000Z');
    const out = await service.getDayAvailabilityOverview({
      tenantId: 't1',
      professionalId: 'p1',
      from,
      to,
    });
    expect(out['2026-05-11']).toBe('UNAVAILABLE');
  });

  it('assertValidConsultationSlotRange rejeita intervalo > 60 dias', () => {
    const from = new Date('2026-01-01T00:00:00.000Z');
    const to = new Date('2026-03-15T00:00:00.000Z');
    expect(() => service.assertValidConsultationSlotRange(from, to)).toThrow(
      BadRequestException
    );
  });
});
