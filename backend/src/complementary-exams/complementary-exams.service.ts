import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PriorityRecalculationService } from '../oncology-navigation/priority-recalculation.service';
import { ComplementaryExamType } from '@prisma/client';
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
          orderBy: { performedAt: 'desc' },
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
          orderBy: { performedAt: 'desc' },
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
        results: { orderBy: { performedAt: 'desc' } },
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

  async findResults(patientId: string, examId: string, tenantId: string) {
    await this.findOne(patientId, examId, tenantId);

    return this.prisma.complementaryExamResult.findMany({
      where: { examId, tenantId },
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
        valueNumeric: dto.valueNumeric,
        valueText: dto.valueText,
        unit: dto.unit,
        referenceRange: dto.referenceRange,
        isAbnormal: dto.isAbnormal,
        report: dto.report,
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
      where: { id: resultId, examId, tenantId },
    });

    if (!result) {
      throw new NotFoundException(
        `Result with ID ${resultId} not found for this exam`,
      );
    }

    const updated = await this.prisma.complementaryExamResult.update({
      where: { id: resultId, tenantId },
      data: {
        ...dto,
        performedAt: dto.performedAt
          ? new Date(dto.performedAt)
          : undefined,
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

    await this.prisma.complementaryExamResult.delete({
      where: { id: resultId, tenantId },
    });

    return { deleted: true };
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
