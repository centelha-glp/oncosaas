import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PriorityRecalculationService } from '../oncology-navigation/priority-recalculation.service';
import { ComplementaryExamType } from '@generated/prisma/client';
import { CreateComplementaryExamDto } from './dto/create-complementary-exam.dto';
import { UpdateComplementaryExamDto } from './dto/update-complementary-exam.dto';
import { CreateComplementaryExamResultDto } from './dto/create-complementary-exam-result.dto';
import { UpdateComplementaryExamResultDto } from './dto/update-complementary-exam-result.dto';
import { parsePerformedAtDateOnly } from '../common/utils/date-only.util';
import { isSpecimenAllowedForType } from './specimen-allowed.util';
import {
  computeIsAbnormalFromRange,
  enrichComponentsWithAbnormal,
  type ExamResultComponentInput,
} from './reference-range.util';

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

    if (!isSpecimenAllowedForType(dto.type, dto.specimen)) {
      throw new BadRequestException(
        'Espécime/amostra inválido para o tipo de exame selecionado.',
      );
    }

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
    const existing = await this.findOne(patientId, examId, tenantId);
    const nextType = dto.type ?? existing.type;
    if (
      dto.specimen !== undefined &&
      !isSpecimenAllowedForType(nextType, dto.specimen)
    ) {
      throw new BadRequestException(
        'Espécime/amostra inválido para o tipo de exame selecionado.',
      );
    }

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
    const exam = await this.findOne(patientId, examId, tenantId);

    let performedAt: Date;
    try {
      performedAt = parsePerformedAtDateOnly(dto.performedAt);
    } catch (e) {
      throw new BadRequestException(
        (e as Error).message || 'Data de realização inválida (use YYYY-MM-DD).',
      );
    }

    const unitFromExam =
      exam.unit != null && String(exam.unit).trim() !== ''
        ? exam.unit
        : dto.unit;
    const referenceFromExam =
      exam.referenceRange != null &&
      String(exam.referenceRange).trim() !== ''
        ? exam.referenceRange
        : dto.referenceRange;

    const componentsPayload = enrichComponentsWithAbnormal(
      dto.components as ExamResultComponentInput[] | undefined,
    );

    let isAbnormalResolved: boolean;
    if (componentsPayload?.length) {
      isAbnormalResolved = componentsPayload.some((c) => c.isAbnormal);
    } else {
      const computed = computeIsAbnormalFromRange(
        dto.valueNumeric,
        referenceFromExam,
      );
      isAbnormalResolved =
        computed !== null ? computed : (dto.isAbnormal ?? false);
    }

    const result = await this.prisma.complementaryExamResult.create({
      data: {
        examId,
        tenantId,
        performedAt,
        collectionId: dto.collectionId,
        valueNumeric: dto.valueNumeric,
        valueText: dto.valueText,
        unit: unitFromExam,
        referenceRange: referenceFromExam,
        isAbnormal: isAbnormalResolved,
        criticalHigh: dto.criticalHigh,
        criticalLow: dto.criticalLow,
        report: dto.report,
        components: componentsPayload
          ? (componentsPayload as object)
          : undefined,
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

    const exam = await this.findOne(patientId, examId, tenantId);

    let performedAtUpdate: Date | undefined;
    if (dto.performedAt !== undefined && dto.performedAt !== null) {
      try {
        performedAtUpdate = parsePerformedAtDateOnly(dto.performedAt);
      } catch (e) {
        throw new BadRequestException(
          (e as Error).message || 'Data de realização inválida (use YYYY-MM-DD).',
        );
      }
    }

    const unitResolved =
      exam.unit != null && String(exam.unit).trim() !== ''
        ? exam.unit
        : dto.unit !== undefined
          ? dto.unit
          : result.unit;
    const referenceResolved =
      exam.referenceRange != null &&
      String(exam.referenceRange).trim() !== ''
        ? exam.referenceRange
        : dto.referenceRange !== undefined
          ? dto.referenceRange
          : result.referenceRange;

    const valueNumericMerged =
      dto.valueNumeric !== undefined ? dto.valueNumeric : result.valueNumeric;

    const componentsPayload =
      dto.components !== undefined
        ? enrichComponentsWithAbnormal(
            dto.components as ExamResultComponentInput[],
          )
        : undefined;

    let isAbnormalResolved: boolean;
    if (componentsPayload?.length) {
      isAbnormalResolved = componentsPayload.some((c) => c.isAbnormal);
    } else if (
      dto.components === undefined &&
      result.components &&
      Array.isArray(result.components) &&
      (result.components as unknown as ExamResultComponentInput[]).length > 0
    ) {
      const enriched = enrichComponentsWithAbnormal(
        result.components as unknown as ExamResultComponentInput[],
      );
      isAbnormalResolved = enriched?.some((c) => c.isAbnormal) ?? false;
    } else {
      const computed = computeIsAbnormalFromRange(
        valueNumericMerged ?? undefined,
        referenceResolved,
      );
      isAbnormalResolved =
        computed !== null
          ? computed
          : (dto.isAbnormal ?? result.isAbnormal ?? false);
    }

    const updated = await this.prisma.complementaryExamResult.update({
      where: { id: resultId, tenantId },
      data: {
        performedAt: performedAtUpdate,
        collectionId: dto.collectionId,
        valueNumeric: dto.valueNumeric,
        valueText: dto.valueText,
        unit: unitResolved,
        referenceRange: referenceResolved,
        isAbnormal: isAbnormalResolved,
        criticalHigh: dto.criticalHigh,
        criticalLow: dto.criticalLow,
        report: dto.report,
        components:
          componentsPayload !== undefined
            ? (componentsPayload as object)
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
