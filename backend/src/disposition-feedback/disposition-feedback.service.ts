import { Injectable, Logger } from '@nestjs/common';
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
    return this.prisma.clinicalDispositionFeedback.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Export anonymized training data for ML retraining.
   * Returns feature_snapshot + corrected_disposition (ground truth label).
   * No patient IDs or names included.
   */
  async exportTrainingData(tenantId?: string) {
    const where = tenantId ? { tenantId } : {};
    const rows = await this.prisma.clinicalDispositionFeedback.findMany({
      where,
      select: {
        featureSnapshot: true,
        correctedDisposition: true,
        predictionSource: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return rows.map((r) => ({
      ...((r.featureSnapshot as Record<string, any>) || {}),
      label: r.correctedDisposition,
      prediction_source: r.predictionSource,
    }));
  }

  async stats(tenantId: string) {
    const rows = await this.prisma.clinicalDispositionFeedback.findMany({
      where: { tenantId },
      select: {
        predictedDisposition: true,
        correctedDisposition: true,
      },
    });

    const total = rows.length;
    const corrections = rows.filter(
      (r) => r.predictedDisposition !== r.correctedDisposition
    ).length;

    const classAccuracy: Record<string, { correct: number; total: number }> = {};
    for (const r of rows) {
      if (!classAccuracy[r.predictedDisposition]) {
        classAccuracy[r.predictedDisposition] = { correct: 0, total: 0 };
      }
      classAccuracy[r.predictedDisposition].total++;
      if (r.predictedDisposition === r.correctedDisposition) {
        classAccuracy[r.predictedDisposition].correct++;
      }
    }

    return {
      total,
      corrections,
      accuracy: total > 0 ? ((total - corrections) / total) : null,
      classAccuracy,
    };
  }
}
