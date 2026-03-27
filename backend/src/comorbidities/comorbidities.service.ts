import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateComorbidityDto } from './dto/create-comorbidity.dto';
import { UpdateComorbidityDto } from './dto/update-comorbidity.dto';
import { ComorbidityType, ComorbiditySeverity } from '@prisma/client';

/** Derives risk flags from ComorbidityType. */
function resolveRiskFlags(type: ComorbidityType) {
  const sepsisRiskTypes: ComorbidityType[] = [
    ComorbidityType.DIABETES_TYPE_1,
    ComorbidityType.DIABETES_TYPE_2,
    ComorbidityType.CHRONIC_KIDNEY_DISEASE,
    ComorbidityType.HEART_FAILURE,
    ComorbidityType.HIV_AIDS,
    ComorbidityType.LIVER_CIRRHOSIS,
    ComorbidityType.AUTOIMMUNE_DISEASE,
  ];
  const bleedingRiskTypes: ComorbidityType[] = [
    // Trombocitopenia pode ser registrada como OTHER; coagulopatias
  ];
  const thrombosisRiskTypes: ComorbidityType[] = [
    ComorbidityType.ATRIAL_FIBRILLATION,
    ComorbidityType.DEEP_VEIN_THROMBOSIS,
    ComorbidityType.PULMONARY_EMBOLISM,
  ];
  const renalClearanceTypes: ComorbidityType[] = [
    ComorbidityType.CHRONIC_KIDNEY_DISEASE,
  ];
  const pulmonaryTypes: ComorbidityType[] = [
    ComorbidityType.COPD,
    ComorbidityType.ASTHMA,
    ComorbidityType.HEART_FAILURE,
  ];

  return {
    increasesSepsisRisk: sepsisRiskTypes.includes(type),
    increasesBleedingRisk: bleedingRiskTypes.includes(type),
    increasesThrombosisRisk: thrombosisRiskTypes.includes(type),
    affectsRenalClearance: renalClearanceTypes.includes(type),
    affectsPulmonaryReserve: pulmonaryTypes.includes(type),
  };
}

@Injectable()
export class ComorbiditiesService {
  private readonly logger = new Logger(ComorbiditiesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(patientId: string, tenantId: string) {
    return this.prisma.comorbidity.findMany({
      where: { patientId, tenantId },
      orderBy: [{ severity: 'desc' }, { name: 'asc' }],
    });
  }

  async findOne(id: string, tenantId: string) {
    const item = await this.prisma.comorbidity.findFirst({
      where: { id, tenantId },
    });
    if (!item) {throw new NotFoundException(`Comorbidity ${id} not found`);}
    return item;
  }

  async create(patientId: string, tenantId: string, dto: CreateComorbidityDto) {
    const type = dto.type ?? ComorbidityType.OTHER;
    const flags = resolveRiskFlags(type);

    return this.prisma.comorbidity.create({
      data: {
        patientId,
        tenantId,
        name: dto.name,
        type,
        severity: dto.severity ?? ComorbiditySeverity.MODERATE,
        controlled: dto.controlled ?? false,
        ...flags,
        diagnosedAt: dto.diagnosedAt ? new Date(dto.diagnosedAt) : undefined,
        notes: dto.notes,
      },
    });
  }

  async update(id: string, tenantId: string, dto: UpdateComorbidityDto) {
    await this.findOne(id, tenantId);

    const updateData: any = { ...dto };
    if (dto.type) {Object.assign(updateData, resolveRiskFlags(dto.type));}
    if (dto.diagnosedAt) {updateData.diagnosedAt = new Date(dto.diagnosedAt);}

    return this.prisma.comorbidity.update({
      where: { id, tenantId },
      data: updateData,
    });
  }

  async remove(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    return this.prisma.comorbidity.delete({ where: { id, tenantId } });
  }

  /** Returns comorbidities with any risk flag — used by the risk engine. */
  async findRiskFlags(patientId: string, tenantId: string) {
    return this.prisma.comorbidity.findMany({
      where: {
        patientId,
        tenantId,
        OR: [
          { increasesSepsisRisk: true },
          { increasesBleedingRisk: true },
          { increasesThrombosisRisk: true },
          { affectsRenalClearance: true },
          { affectsPulmonaryReserve: true },
        ],
      },
      select: {
        id: true,
        name: true,
        type: true,
        severity: true,
        controlled: true,
        increasesSepsisRisk: true,
        increasesBleedingRisk: true,
        increasesThrombosisRisk: true,
        affectsRenalClearance: true,
        affectsPulmonaryReserve: true,
      },
    });
  }
}
