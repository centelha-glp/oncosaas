import { BadRequestException, Injectable } from '@nestjs/common';
import { NavigationStepStatus, Prisma } from '@generated/prisma/client';
import { formatInTimeZone } from 'date-fns-tz';
import { PrismaService } from '../prisma/prisma.service';
import { CONSULTATION_STEP_KEYS } from './consultation-step-keys';
import {
  CONSULTATION_AGENDA_TIMEZONE,
  CONSULTATION_AVAILABLE_SLOTS_MAX_RANGE_DAYS,
  type ConsultationWeeklyPattern,
  type IntervalUtc,
  consultationIntervalBounds,
  eachCalendarYmdInUtcRange,
  filterSlotsByOccupiedAndBlocks,
  generateCandidateSlotStarts,
  intervalsOverlapSemiOpen,
  LEGACY_CONSULTATION_SLOT_MINUTES,
  MAX_CONSULTATION_DURATION_MINUTES,
  parseWeeklyPatternJson,
  slotFullyInsideShiftWindow,
  zonedDayBounds,
} from './consultation-agenda-slot.utils';

/** Estado de um dia civil na grelha de consultas (fuso America/Sao_Paulo). */
export type ConsultationAgendaDayOverviewStatus = 'HAS_SLOTS' | 'FULL' | 'UNAVAILABLE';

@Injectable()
export class ConsultationAgendaAvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  parseWeeklyPatternOrThrow(raw: Prisma.JsonValue): ConsultationWeeklyPattern {
    try {
      return parseWeeklyPatternJson(raw);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'weeklyPattern inválido';
      throw new BadRequestException(msg);
    }
  }

  async getConfigForProfessional(
    tenantId: string,
    userId: string
  ): Promise<{
    defaultConsultationDurationMinutes: number;
    maxConsultationsPerDay: number | null;
    weeklyPattern: ConsultationWeeklyPattern;
  } | null> {
    const row = await this.prisma.consultationAgendaConfig.findFirst({
      where: { tenantId, userId },
    });
    if (!row) {return null;}
    const weeklyPattern = this.parseWeeklyPatternOrThrow(row.weeklyPattern);
    return {
      defaultConsultationDurationMinutes: row.defaultConsultationDurationMinutes,
      maxConsultationsPerDay: row.maxConsultationsPerDay,
      weeklyPattern,
    };
  }

  /** Duração em minutos para conflitos e grelha: config ou 1 (legacy). */
  async getConsultationDurationMinutes(
    tenantId: string,
    professionalId: string
  ): Promise<number> {
    const cfg = await this.getConfigForProfessional(tenantId, professionalId);
    if (!cfg) {return LEGACY_CONSULTATION_SLOT_MINUTES;}
    const d = cfg.defaultConsultationDurationMinutes;
    if (d < 5 || d > MAX_CONSULTATION_DURATION_MINUTES) {
      return LEGACY_CONSULTATION_SLOT_MINUTES;
    }
    return d;
  }

  assertValidConsultationSlotRange(from: Date, to: Date): void {
    if (from.getTime() > to.getTime()) {
      throw new BadRequestException('Intervalo inválido: from deve ser anterior ou igual a to');
    }
    const maxMs = CONSULTATION_AVAILABLE_SLOTS_MAX_RANGE_DAYS * 24 * 60 * 60 * 1000;
    if (to.getTime() - from.getTime() > maxMs) {
      throw new BadRequestException(
        `O intervalo não pode exceder ${CONSULTATION_AVAILABLE_SLOTS_MAX_RANGE_DAYS} dias`
      );
    }
  }

  /**
   * Grelha de candidatos após cap diário, mais bloqueios e reservas para filtros posteriores.
   * `null` quando não existe config de agenda para o profissional.
   */
  private async buildConsultationSlotComputation(
    tenantId: string,
    professionalId: string,
    from: Date,
    to: Date
  ): Promise<{
    D: number;
    blocks: IntervalUtc[];
    booked: IntervalUtc[];
    candidates: Date[];
  } | null> {
    const cfg = await this.getConfigForProfessional(tenantId, professionalId);
    if (!cfg) {
      return null;
    }
    const D = cfg.defaultConsultationDurationMinutes;

    const blocksRows = await this.prisma.consultationAgendaBlock.findMany({
      where: {
        tenantId,
        OR: [{ userId: null }, { userId: professionalId }],
        startsAt: { lt: to },
        endsAt: { gt: from },
      },
      select: { startsAt: true, endsAt: true },
    });
    const blocks: IntervalUtc[] = blocksRows.map((b) => ({
      start: b.startsAt,
      end: b.endsAt,
    }));

    const bookedLow = new Date(from.getTime() - MAX_CONSULTATION_DURATION_MINUTES * 60_000);
    const bookedHigh = to;

    const bookedRows = await this.prisma.navigationStep.findMany({
      where: {
        tenantId,
        scheduledProfessionalId: professionalId,
        status: { not: NavigationStepStatus.CANCELLED },
        stepKey: { in: [...CONSULTATION_STEP_KEYS] },
        expectedDate: { not: null, gt: bookedLow, lt: bookedHigh },
      },
      select: { expectedDate: true },
    });

    const booked: IntervalUtc[] = [];
    for (const row of bookedRows) {
      if (!row.expectedDate) {continue;}
      booked.push(consultationIntervalBounds(row.expectedDate, D));
    }

    const maxCap = cfg.maxConsultationsPerDay;
    const ymdsBlockedByCap = new Set<string>();
    if (maxCap !== null && maxCap !== undefined && maxCap > 0) {
      const ymds = eachCalendarYmdInUtcRange(from, to, CONSULTATION_AGENDA_TIMEZONE);
      for (const ymd of ymds) {
        const { start, end } = zonedDayBounds(ymd, CONSULTATION_AGENDA_TIMEZONE);
        const n = await this.prisma.navigationStep.count({
          where: {
            tenantId,
            scheduledProfessionalId: professionalId,
            status: { not: NavigationStepStatus.CANCELLED },
            stepKey: { in: [...CONSULTATION_STEP_KEYS] },
            expectedDate: { gte: start, lt: end },
          },
        });
        if (n >= maxCap) {
          ymdsBlockedByCap.add(ymd);
        }
      }
    }

    let candidates = generateCandidateSlotStarts({
      rangeFromUtc: from,
      rangeToUtc: to,
      pattern: cfg.weeklyPattern,
      durationMinutes: D,
      timeZone: CONSULTATION_AGENDA_TIMEZONE,
    });

    if (ymdsBlockedByCap.size > 0) {
      candidates = candidates.filter(
        (s) =>
          !ymdsBlockedByCap.has(
            formatInTimeZone(s, CONSULTATION_AGENDA_TIMEZONE, 'yyyy-MM-dd')
          )
      );
    }

    return { D, blocks, booked, candidates };
  }

  async listAvailableSlots(params: {
    tenantId: string;
    professionalId: string;
    from: Date;
    to: Date;
  }): Promise<{ slots: string[] }> {
    const { tenantId, professionalId, from, to } = params;
    this.assertValidConsultationSlotRange(from, to);

    const ctx = await this.buildConsultationSlotComputation(tenantId, professionalId, from, to);
    if (!ctx) {
      return { slots: [] };
    }
    const { D, candidates, booked, blocks } = ctx;

    const free = filterSlotsByOccupiedAndBlocks({
      candidates,
      durationMinutes: D,
      booked,
      blocks,
    });

    return { slots: free.map((d) => d.toISOString()) };
  }

  /**
   * Por dia civil (yyyy-MM-dd em America/Sao_Paulo): vagas livres, lotado só por reservas, ou indisponível.
   */
  async getDayAvailabilityOverview(params: {
    tenantId: string;
    professionalId: string;
    from: Date;
    to: Date;
  }): Promise<Record<string, ConsultationAgendaDayOverviewStatus>> {
    const { tenantId, professionalId, from, to } = params;
    this.assertValidConsultationSlotRange(from, to);

    const ymds = eachCalendarYmdInUtcRange(from, to, CONSULTATION_AGENDA_TIMEZONE);
    const out: Record<string, ConsultationAgendaDayOverviewStatus> = {};

    const ctx = await this.buildConsultationSlotComputation(tenantId, professionalId, from, to);
    if (!ctx) {
      for (const ymd of ymds) {
        out[ymd] = 'UNAVAILABLE';
      }
      return out;
    }

    const { D, candidates, booked, blocks } = ctx;

    for (const ymd of ymds) {
      const dayCandidates = candidates.filter(
        (s) => formatInTimeZone(s, CONSULTATION_AGENDA_TIMEZONE, 'yyyy-MM-dd') === ymd
      );
      if (dayCandidates.length === 0) {
        out[ymd] = 'UNAVAILABLE';
        continue;
      }

      const notBlocked = filterSlotsByOccupiedAndBlocks({
        candidates: dayCandidates,
        durationMinutes: D,
        booked: [],
        blocks,
      });
      if (notBlocked.length === 0) {
        out[ymd] = 'UNAVAILABLE';
        continue;
      }

      const free = filterSlotsByOccupiedAndBlocks({
        candidates: dayCandidates,
        durationMinutes: D,
        booked,
        blocks,
      });
      out[ymd] = free.length > 0 ? 'HAS_SLOTS' : 'FULL';
    }

    return out;
  }

  /**
   * Valida início de consulta quando existe config (legacy: sem config não chama).
   */
  async assertSlotWithinAgendaRules(params: {
    tenantId: string;
    professionalId: string;
    expectedDate: Date;
    durationMinutes: number;
    excludeStepId?: string;
  }): Promise<void> {
    const { tenantId, professionalId, expectedDate, durationMinutes, excludeStepId } =
      params;
    const cfg = await this.getConfigForProfessional(tenantId, professionalId);
    if (!cfg) {return;}

    const slot = consultationIntervalBounds(expectedDate, durationMinutes);
    if (
      !slotFullyInsideShiftWindow({
        slotStart: expectedDate,
        durationMinutes,
        pattern: cfg.weeklyPattern,
        timeZone: CONSULTATION_AGENDA_TIMEZONE,
      })
    ) {
      throw new BadRequestException(
        'Horário fora dos turnos configurados para este profissional'
      );
    }

    const blocksRows = await this.prisma.consultationAgendaBlock.findMany({
      where: {
        tenantId,
        OR: [{ userId: null }, { userId: professionalId }],
        startsAt: { lt: slot.end },
        endsAt: { gt: slot.start },
      },
      select: { id: true },
    });
    if (blocksRows.length > 0) {
      throw new BadRequestException('Horário indisponível (bloqueio na agenda)');
    }

    const maxCap = cfg.maxConsultationsPerDay;
    if (maxCap !== null && maxCap !== undefined && maxCap > 0) {
      const ymd = formatInTimeZone(
        expectedDate,
        CONSULTATION_AGENDA_TIMEZONE,
        'yyyy-MM-dd'
      );
      const { start, end } = zonedDayBounds(ymd, CONSULTATION_AGENDA_TIMEZONE);
      const n = await this.prisma.navigationStep.count({
        where: {
          tenantId,
          scheduledProfessionalId: professionalId,
          status: { not: NavigationStepStatus.CANCELLED },
          stepKey: { in: [...CONSULTATION_STEP_KEYS] },
          expectedDate: { gte: start, lt: end },
          ...(excludeStepId ? { NOT: { id: excludeStepId } } : {}),
        },
      });
      if (n >= maxCap) {
        throw new BadRequestException(
          'Limite diário de consultas atingido para este profissional'
        );
      }
    }
  }

  /**
   * Conflito com outras consultas do paciente ou do profissional (intervalo semiaberto).
   */
  async assertNoConsultationIntervalOverlap(params: {
    tenantId: string;
    patientId?: string;
    scheduledProfessionalId: string;
    expectedDate: Date;
    durationMinutes: number;
    excludeStepId?: string;
  }): Promise<void> {
    const {
      tenantId,
      patientId,
      scheduledProfessionalId,
      expectedDate,
      durationMinutes,
      excludeStepId,
    } = params;
    const newSlot = consultationIntervalBounds(expectedDate, durationMinutes);
    const low = new Date(expectedDate.getTime() - MAX_CONSULTATION_DURATION_MINUTES * 60_000);
    const high = new Date(expectedDate.getTime() + durationMinutes * 60_000);

    if (patientId) {
      const others = await this.prisma.navigationStep.findMany({
        where: {
          tenantId,
          patientId,
          status: { not: NavigationStepStatus.CANCELLED },
          stepKey: { in: [...CONSULTATION_STEP_KEYS] },
          expectedDate: { gt: low, lt: high },
          ...(excludeStepId ? { NOT: { id: excludeStepId } } : {}),
        },
        select: { id: true, expectedDate: true, scheduledProfessionalId: true },
      });
      for (const o of others) {
        if (!o.expectedDate || !o.scheduledProfessionalId) {continue;}
        const d = await this.getConsultationDurationMinutes(
          tenantId,
          o.scheduledProfessionalId
        );
        const existing = consultationIntervalBounds(o.expectedDate, d);
        if (intervalsOverlapSemiOpen(newSlot, existing)) {
          throw new BadRequestException(
            'Este paciente já tem consulta agendada a sobrepor-se a este horário'
          );
        }
      }
    }

    const profRows = await this.prisma.navigationStep.findMany({
      where: {
        tenantId,
        scheduledProfessionalId,
        status: { not: NavigationStepStatus.CANCELLED },
        stepKey: { in: [...CONSULTATION_STEP_KEYS] },
        expectedDate: { gt: low, lt: high },
        ...(excludeStepId ? { NOT: { id: excludeStepId } } : {}),
      },
      select: { id: true, expectedDate: true, scheduledProfessionalId: true },
    });
    for (const o of profRows) {
      if (!o.expectedDate || !o.scheduledProfessionalId) {continue;}
      const d = await this.getConsultationDurationMinutes(
        tenantId,
        o.scheduledProfessionalId
      );
      const existing = consultationIntervalBounds(o.expectedDate, d);
      if (intervalsOverlapSemiOpen(newSlot, existing)) {
        throw new BadRequestException(
          'Este profissional já tem consulta agendada a sobrepor-se a este horário'
        );
      }
    }
  }
}
