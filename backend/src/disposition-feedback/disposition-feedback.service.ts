import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDispositionFeedbackDto } from './dto/create-feedback.dto';

@Injectable()
export class DispositionFeedbackService {
  private readonly logger = new Logger(DispositionFeedbackService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(
    dto: CreateDispositionFeedbackDto,
    tenantId: string,
    correctedBy: string
  ) {
    const patient = await this.prisma.patient.findFirst({
      where: { id: dto.patientId, tenantId },
      select: { id: true },
    });
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    this.logger.log(
      `Feedback: patient ${dto.patientId} predicted=${dto.predictedDisposition} corrected=${dto.correctedDisposition} by ${correctedBy}`
    );

    return this.prisma.clinicalDispositionFeedback.create({
      data: {
        tenantId,
        patientId: dto.patientId,
        conversationId: dto.conversationId,
        predictedDisposition: dto.predictedDisposition,
        predictionSource: dto.predictionSource,
        predictionConfidence: dto.predictionConfidence,
        rulesFindings: dto.rulesFindings as any,
        correctedDisposition: dto.correctedDisposition,
        correctedBy,
        correctionReason: dto.correctionReason,
        featureSnapshot: dto.featureSnapshot as any,
      },
    });
  }

  async findByTenant(tenantId: string, limit = 200) {
    const take = limit > 0 ? Math.min(limit, 500) : 200;
    return this.prisma.clinicalDispositionFeedback.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  /**
   * Export anonymized training data for ML retraining.
   * Returns feature_snapshot + corrected_disposition (ground truth label).
   * No patient IDs or names included.
   */
  async exportTrainingData(
    tenantId: string,
    options?: { limit?: number; offset?: number }
  ) {
    const where = { tenantId };
    const take =
      options?.limit && options.limit > 0
        ? Math.min(options.limit, 50_000)
        : 10_000;
    const skip = options?.offset && options.offset > 0 ? options.offset : 0;

    const rows = await this.prisma.clinicalDispositionFeedback.findMany({
      where,
      select: {
        featureSnapshot: true,
        correctedDisposition: true,
        predictionSource: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
      take,
      skip,
    });

    return rows.map((r) => ({
      ...((r.featureSnapshot as Record<string, any>) || {}),
      label: r.correctedDisposition,
      prediction_source: r.predictionSource,
    }));
  }

  async stats(tenantId: string) {
    const [agg] = await this.prisma.$queryRaw<
      Array<{ total: bigint; corrections: bigint }>
    >(Prisma.sql`
      SELECT
        COUNT(*)::bigint AS total,
        COUNT(*) FILTER (WHERE "predictedDisposition" <> "correctedDisposition")::bigint AS corrections
      FROM clinical_disposition_feedback
      WHERE "tenantId" = ${tenantId}
    `);

    const total = Number(agg?.total ?? 0);
    const corrections = Number(agg?.corrections ?? 0);

    const classRows = await this.prisma.$queryRaw<
      Array<{
        predictedDisposition: string;
        total: bigint;
        correct: bigint;
      }>
    >(Prisma.sql`
      SELECT
        "predictedDisposition",
        COUNT(*)::bigint AS total,
        COUNT(*) FILTER (WHERE "predictedDisposition" = "correctedDisposition")::bigint AS correct
      FROM clinical_disposition_feedback
      WHERE "tenantId" = ${tenantId}
      GROUP BY "predictedDisposition"
    `);

    const classAccuracy: Record<string, { correct: number; total: number }> =
      {};
    for (const r of classRows) {
      classAccuracy[r.predictedDisposition] = {
        total: Number(r.total),
        correct: Number(r.correct),
      };
    }

    return {
      total,
      corrections,
      accuracy: total > 0 ? (total - corrections) / total : null,
      classAccuracy,
    };
  }
}
