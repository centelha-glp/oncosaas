import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePerformanceStatusDto } from './dto/create-performance-status.dto';

@Injectable()
export class PerformanceStatusService {
  private readonly logger = new Logger(PerformanceStatusService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(patientId: string, tenantId: string) {
    return this.prisma.performanceStatusHistory.findMany({
      where: { patientId, tenantId },
      orderBy: { assessedAt: 'desc' },
    });
  }

  async create(
    patientId: string,
    tenantId: string,
    dto: CreatePerformanceStatusDto,
  ) {
    const entry = await this.prisma.performanceStatusHistory.create({
      data: {
        patientId,
        tenantId,
        ecogScore: dto.ecogScore,
        assessedAt: dto.assessedAt ? new Date(dto.assessedAt) : new Date(),
        assessedBy: dto.assessedBy,
        source: dto.source ?? 'MANUAL',
        notes: dto.notes,
      },
    });

    // Sync Patient.performanceStatus with the latest value
    await this.prisma.patient.update({
      where: { id: patientId, tenantId },
      data: { performanceStatus: dto.ecogScore },
    });

    return entry;
  }

  /**
   * Returns the ECOG delta: difference between the latest and the previous entry.
   * Positive value means worsening (higher ECOG = worse function).
   */
  async getDelta(patientId: string, tenantId: string): Promise<number | null> {
    const history = await this.prisma.performanceStatusHistory.findMany({
      where: { patientId, tenantId },
      orderBy: { assessedAt: 'desc' },
      take: 2,
      select: { ecogScore: true },
    });

    if (history.length < 2) {return null;}
    return history[0].ecogScore - history[1].ecogScore;
  }
}
