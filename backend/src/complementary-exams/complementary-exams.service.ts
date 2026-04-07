import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PriorityRecalculationService } from '../oncology-navigation/priority-recalculation.service';
import { ComplementaryExamType } from '@generated/prisma/client';
import { CreateComplementaryExamDto } from './dto/create-complementary-exam.dto';
import { UpdateComplementaryExamDto } from './dto/update-complementary-exam.dto';
import { CreateComplementaryExamResultDto } from './dto/create-complementary-exam-result.dto';
import { UpdateComplementaryExamResultDto } from './dto/update-complementary-exam-result.dto';

@Injectable()
export class ComplementaryExamsService {
  private readonly logger = new Logger(ComplementaryExamsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly priorityRecalculationService: PriorityRecalculationService
  ) {}

  async findAllByPatient(
    patientId: string,
    tenantId: string,
    type?: ComplementaryExamType,
  ) {
    await this.ensurePatientBelongsToTenant(patientId, tenantId);

    const where: { patientId: string; tenantId: string; type?: ComplementaryExamType } = {
      patientId,
      tenantId,
    };
    if (type) {
      where.type = type;
    }

    return this.prisma.complementaryExam.findMany({
      where,
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
      include: {
        results: {
          where: { deletedAt: null },
          orderBy: { performedAt: 'desc' },
          take: 50,
        },
      },
    });
  }

  async findOne(
    patientId: string,
    examId: string,
    tenantId: string,
  ) {
    await this.ensurePatientBelongsToTenant(patientId, tenantId);

    const exam = await this.prisma.complementaryExam.findFirst({
      where: {
        id: examId,
        patientId,
        tenantId,
      },
      include: {
        results: {
          where: { deletedAt: null },
          orderBy: { performedAt: 'desc' },
          take: 50,
        },
      },
    });

    if (!exam) {
      throw new NotFoundException(
        `Complementary exam with ID ${examId} not found for this patient`,
      );
    }

    return exam;
  }

  async create(
    patientId: string,
    tenantId: string,
    dto: CreateComplementaryExamDto,
  ) {
    await this.ensurePatientBelongsToTenant(patientId, tenantId);

    return this.prisma.complementaryExam.create({
      data: {
        ...dto,
        patientId,
        tenantId,
      },
      include: {
        results: true,
      },
    });
  }

  async update(
    patientId: string,
    examId: string,
    tenantId: string,
    dto: UpdateComplementaryExamDto,
  ) {
    await this.findOne(patientId, examId, tenantId);

    return this.prisma.complementaryExam.update({
      where: { id: examId, tenantId },
      data: dto,
      include: {
        results: { where: { deletedAt: null }, orderBy: { performedAt: 'desc' }, take: 50 },
      },
    });
  }

  async remove(patientId: string, examId: string, tenantId: string) {
    await this.findOne(patientId, examId, tenantId);

    await this.prisma.complementaryExam.delete({
      where: { id: examId, tenantId },
    });

    return { deleted: true };
  }

  // --- Results ---

  async findResults(
    patientId: string,
    examId: string,
    tenantId: string,
    includeDeleted = false,
  ) {
    await this.findOne(patientId, examId, tenantId);

    return this.prisma.complementaryExamResult.findMany({
      where: {
        examId,
        tenantId,
        ...(includeDeleted ? {} : { deletedAt: null }),
      },
      orderBy: { performedAt: 'desc' },
    });
  }

  async addResult(
    patientId: string,
    examId: string,
    tenantId: string,
    dto: CreateComplementaryExamResultDto,
  ) {
    await this.findOne(patientId, examId, tenantId);

    const result = await this.prisma.complementaryExamResult.create({
      data: {
        examId,
        tenantId,
        performedAt: new Date(dto.performedAt),
        collectionId: dto.collectionId,
        valueNumeric: dto.valueNumeric,
        valueText: dto.valueText,
        unit: dto.unit,
        referenceRange: dto.referenceRange,
        isAbnormal: dto.isAbnormal,
        criticalHigh: dto.criticalHigh,
        criticalLow: dto.criticalLow,
        report: dto.report,
        components: dto.components ? (dto.components as any) : undefined,
      },
    });

    this.priorityRecalculationService.triggerRecalculation(patientId, tenantId);

    return result;
  }

  async updateResult(
    patientId: string,
    examId: string,
    resultId: string,
    tenantId: string,
    dto: UpdateComplementaryExamResultDto,
  ) {
    await this.findOne(patientId, examId, tenantId);

    const result = await this.prisma.complementaryExamResult.findFirst({
      where: { id: resultId, examId, tenantId, deletedAt: null },
    });

    if (!result) {
      throw new NotFoundException(
        `Result with ID ${resultId} not found for this exam`,
      );
    }

    const updated = await this.prisma.complementaryExamResult.update({
      where: { id: resultId, tenantId },
      data: {
        performedAt: dto.performedAt ? new Date(dto.performedAt) : undefined,
        collectionId: dto.collectionId,
        valueNumeric: dto.valueNumeric,
        valueText: dto.valueText,
        unit: dto.unit,
        referenceRange: dto.referenceRange,
        isAbnormal: dto.isAbnormal,
        criticalHigh: dto.criticalHigh,
        criticalLow: dto.criticalLow,
        report: dto.report,
        components:
          dto.components !== undefined ? (dto.components as any) : undefined,
      },
    });

    this.priorityRecalculationService.triggerRecalculation(patientId, tenantId);

    return updated;
  }

  async removeResult(
    patientId: string,
    examId: string,
    resultId: string,
    tenantId: string,
    params?: { reason?: string; deletedByUserId?: string },
  ) {
    await this.findOne(patientId, examId, tenantId);

    const result = await this.prisma.complementaryExamResult.findFirst({
      where: { id: resultId, examId, tenantId, deletedAt: null },
    });

    if (!result) {
      throw new NotFoundException(
        `Result with ID ${resultId} not found for this exam`,
      );
    }

    const deleted = await this.prisma.complementaryExamResult.update({
      where: { id: resultId, tenantId },
      data: {
        deletedAt: new Date(),
        deletedByUserId: params?.deletedByUserId,
        deleteReason: params?.reason,
      },
    });

    return { deleted: true, result: deleted };
  }

  async restoreResult(
    patientId: string,
    examId: string,
    resultId: string,
    tenantId: string,
    _params?: { restoredByUserId?: string },
  ) {
    await this.findOne(patientId, examId, tenantId);

    const result = await this.prisma.complementaryExamResult.findFirst({
      where: { id: resultId, examId, tenantId },
    });

    if (!result) {
      throw new NotFoundException(
        `Result with ID ${resultId} not found for this exam`,
      );
    }

    const restored = await this.prisma.complementaryExamResult.update({
      where: { id: resultId, tenantId },
      data: {
        deletedAt: null,
        deletedByUserId: null,
        deleteReason: null,
      },
    });

    return { restored: true, result: restored };
  }

  private async ensurePatientBelongsToTenant(
    patientId: string,
    tenantId: string,
  ) {
    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, tenantId },
    });

    if (!patient) {
      throw new NotFoundException(
        `Patient with ID ${patientId} not found`,
      );
    }
  }
}
