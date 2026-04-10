import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMedicationDto } from './dto/create-medication.dto';
import { UpdateMedicationDto } from './dto/update-medication.dto';
import { MedicationCategory } from '@generated/prisma/client';
import {
  getMedicationCatalogEntry,
  isValidMedicationCatalogKey,
} from '../clinical-catalogs/medication-catalog';

/** Maps a MedicationCategory to its clinical risk boolean flags. */
function resolveClinicalFlags(category: MedicationCategory) {
  return {
    isAnticoagulant: category === MedicationCategory.ANTICOAGULANT,
    isAntiplatelet: category === MedicationCategory.ANTIPLATELET,
    isCorticosteroid: category === MedicationCategory.CORTICOSTEROID,
    isImmunosuppressant: category === MedicationCategory.IMMUNOSUPPRESSANT,
    isOpioid: category === MedicationCategory.OPIOID_ANALGESIC,
    isNSAID: category === MedicationCategory.NSAID,
    isGrowthFactor: category === MedicationCategory.GROWTH_FACTOR,
  };
}

@Injectable()
export class MedicationsService {
  private readonly logger = new Logger(MedicationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(patientId: string, tenantId: string) {
    return this.prisma.medication.findMany({
      where: { patientId, tenantId },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  }

  async findOne(id: string, tenantId: string) {
    const med = await this.prisma.medication.findFirst({
      where: { id, tenantId },
    });
    if (!med) {throw new NotFoundException(`Medication ${id} not found`);}
    return med;
  }

  async create(
    patientId: string,
    tenantId: string,
    dto: CreateMedicationDto,
  ) {
    let name = dto.name?.trim() ?? '';
    const catalogKey: string | null = dto.catalogKey?.trim() || null;
    let category: MedicationCategory;

    if (catalogKey) {
      if (!isValidMedicationCatalogKey(catalogKey)) {
        throw new BadRequestException(
          `Chave de medicamento inválida: ${catalogKey}`,
        );
      }
      const resolved = getMedicationCatalogEntry(catalogKey)!;
      if (catalogKey === 'OTHER') {
        if (!name) {
          throw new BadRequestException(
            'Para medicamento "Outro", informe o nome no campo livre.',
          );
        }
      } else {
        name = resolved.label;
      }
      category = resolved.category;
    } else {
      if (!name) {
        throw new BadRequestException(
          'Informe o nome do medicamento ou selecione no catálogo.',
        );
      }
      category = dto.category ?? MedicationCategory.OTHER;
    }

    const flags = resolveClinicalFlags(category);

    return this.prisma.medication.create({
      data: {
        patientId,
        tenantId,
        name,
        catalogKey,
        dosage: dto.dosage,
        frequency: dto.frequency,
        indication: dto.indication,
        route: dto.route,
        category,
        ...flags,
        isActive: dto.isActive ?? true,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        notes: dto.notes,
      },
    });
  }

  async update(id: string, tenantId: string, dto: UpdateMedicationDto) {
    await this.findOne(id, tenantId);

    const updateData: any = { ...dto };

    if (dto.catalogKey?.trim()) {
      const ck = dto.catalogKey.trim();
      if (!isValidMedicationCatalogKey(ck)) {
        throw new BadRequestException(`Chave de medicamento inválida: ${ck}`);
      }
      const resolved = getMedicationCatalogEntry(ck)!;
      updateData.catalogKey = ck;
      if (ck !== 'OTHER') {
        updateData.name = resolved.label;
      } else if (!dto.name?.trim()) {
        throw new BadRequestException(
          'Para medicamento "Outro", informe o nome no campo livre.',
        );
      }
      updateData.category = resolved.category;
      Object.assign(updateData, resolveClinicalFlags(resolved.category));
    } else if (dto.category) {
      Object.assign(updateData, resolveClinicalFlags(dto.category));
    }
    if (dto.startDate) {updateData.startDate = new Date(dto.startDate);}
    if (dto.endDate) {updateData.endDate = new Date(dto.endDate);}

    return this.prisma.medication.update({
      where: { id, tenantId },
      data: updateData,
    });
  }

  async remove(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    return this.prisma.medication.delete({ where: { id, tenantId } });
  }

  /** Returns active medications with any critical risk flag set — used by the risk engine. */
  async findCriticalFlags(patientId: string, tenantId: string) {
    return this.prisma.medication.findMany({
      where: {
        patientId,
        tenantId,
        isActive: true,
        OR: [
          { isAnticoagulant: true },
          { isAntiplatelet: true },
          { isCorticosteroid: true },
          { isImmunosuppressant: true },
          { isOpioid: true },
          { isNSAID: true },
          { isGrowthFactor: true },
        ],
      },
      select: {
        id: true,
        name: true,
        category: true,
        isAnticoagulant: true,
        isAntiplatelet: true,
        isCorticosteroid: true,
        isImmunosuppressant: true,
        isOpioid: true,
        isNSAID: true,
        isGrowthFactor: true,
      },
    });
  }
}
