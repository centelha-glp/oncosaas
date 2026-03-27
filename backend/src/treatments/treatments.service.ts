import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTreatmentDto } from './dto/create-treatment.dto';
import { UpdateTreatmentDto } from './dto/update-treatment.dto';

@Injectable()
export class TreatmentsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Cria um novo tratamento vinculado a um diagnóstico
   */
  async create(createDto: CreateTreatmentDto, tenantId: string): Promise<any> {
    // Verificar se o diagnóstico existe e pertence ao tenant
    const diagnosis = await this.prisma.cancerDiagnosis.findFirst({
      where: {
        id: createDto.diagnosisId,
        tenantId,
      },
      include: {
        patient: true,
      },
    });

    if (!diagnosis) {
      throw new NotFoundException('Cancer diagnosis not found');
    }

    // Preparar dados para criação
    const data: any = {
      tenantId,
      patientId: diagnosis.patientId,
      diagnosisId: createDto.diagnosisId,
      treatmentType: createDto.treatmentType,
      intent: createDto.intent || 'CURATIVE',
      status: createDto.status || 'PLANNED',
      isActive: createDto.isActive !== undefined ? createDto.isActive : true,
    };

    // Campos opcionais
    if (createDto.treatmentName) {
      data.treatmentName = createDto.treatmentName;
    }
    if (createDto.protocol) {
      data.protocol = createDto.protocol;
    }
    if (createDto.line !== undefined) {
      data.line = createDto.line;
    }
    if (createDto.startDate) {
      data.startDate = new Date(createDto.startDate);
    }
    if (createDto.plannedEndDate) {
      data.plannedEndDate = new Date(createDto.plannedEndDate);
    }
    if (createDto.actualEndDate) {
      data.actualEndDate = new Date(createDto.actualEndDate);
    }
    if (createDto.lastCycleDate) {
      data.lastCycleDate = new Date(createDto.lastCycleDate);
    }
    if (createDto.currentCycle !== undefined) {
      data.currentCycle = createDto.currentCycle;
    }
    if (createDto.totalCycles !== undefined) {
      data.totalCycles = createDto.totalCycles;
    }
    if (createDto.cyclesCompleted !== undefined) {
      data.cyclesCompleted = createDto.cyclesCompleted;
    }
    if (createDto.discontinuationReason) {
      data.discontinuationReason = createDto.discontinuationReason;
    }
    if (createDto.medications) {
      data.medications = createDto.medications;
    }
    if (createDto.frequency) {
      data.frequency = createDto.frequency;
    }
    if (createDto.administrationRoute) {
      data.administrationRoute = createDto.administrationRoute;
    }
    if (createDto.institutionName) {
      data.institutionName = createDto.institutionName;
    }
    if (createDto.physicianName) {
      data.physicianName = createDto.physicianName;
    }
    if (createDto.toxicities) {
      data.toxicities = createDto.toxicities;
    }
    if (createDto.doseReductions) {
      data.doseReductions = createDto.doseReductions;
    }
    if (createDto.delays) {
      data.delays = createDto.delays;
    }
    if (createDto.response) {
      data.response = createDto.response;
    }
    if (createDto.responseDate) {
      data.responseDate = new Date(createDto.responseDate);
    }
    if (createDto.responseNotes) {
      data.responseNotes = createDto.responseNotes;
    }
    if (createDto.notes) {
      data.notes = createDto.notes;
    }
    if (createDto.metadata) {
      data.metadata = createDto.metadata;
    }

    return this.prisma.treatment.create({
      data,
      include: {
        diagnosis: {
          select: {
            id: true,
            cancerType: true,
            stage: true,
          },
        },
      },
    });
  }

  /**
   * Lista todos os tratamentos de um paciente
   */
  async findAllByPatient(patientId: string, tenantId: string): Promise<any[]> {
    return this.prisma.treatment.findMany({
      where: {
        patientId,
        tenantId,
      },
      include: {
        diagnosis: {
          select: {
            id: true,
            cancerType: true,
            stage: true,
          },
        },
      },
      orderBy: {
        startDate: 'desc',
      },
    });
  }

  /**
   * Lista todos os tratamentos de um diagnóstico específico
   */
  async findAllByDiagnosis(
    diagnosisId: string,
    tenantId: string
  ): Promise<any[]> {
    return this.prisma.treatment.findMany({
      where: {
        diagnosisId,
        tenantId,
      },
      orderBy: {
        startDate: 'desc',
      },
    });
  }

  /**
   * Obtém um tratamento específico
   */
  async findOne(id: string, tenantId: string): Promise<any> {
    const treatment = await this.prisma.treatment.findFirst({
      where: {
        id,
        tenantId,
      },
      include: {
        diagnosis: {
          select: {
            id: true,
            cancerType: true,
            stage: true,
            tStage: true,
            nStage: true,
            mStage: true,
            grade: true,
          },
        },
      },
    });

    if (!treatment) {
      throw new NotFoundException('Treatment not found');
    }

    return treatment;
  }

  /**
   * Atualiza um tratamento
   */
  async update(
    id: string,
    updateDto: UpdateTreatmentDto,
    tenantId: string
  ): Promise<any> {
    const existing = await this.prisma.treatment.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!existing) {
      throw new NotFoundException('Treatment not found');
    }

    const updateData: any = {};

    // Campos que podem ser atualizados
    if (updateDto.treatmentType !== undefined) {
      updateData.treatmentType = updateDto.treatmentType;
    }
    if (updateDto.treatmentName !== undefined) {
      updateData.treatmentName = updateDto.treatmentName;
    }
    if (updateDto.protocol !== undefined) {
      updateData.protocol = updateDto.protocol;
    }
    if (updateDto.line !== undefined) {
      updateData.line = updateDto.line;
    }
    if (updateDto.intent !== undefined) {
      updateData.intent = updateDto.intent;
    }
    if (updateDto.startDate !== undefined) {
      updateData.startDate = updateDto.startDate
        ? new Date(updateDto.startDate)
        : null;
    }
    if (updateDto.plannedEndDate !== undefined) {
      updateData.plannedEndDate = updateDto.plannedEndDate
        ? new Date(updateDto.plannedEndDate)
        : null;
    }
    if (updateDto.actualEndDate !== undefined) {
      updateData.actualEndDate = updateDto.actualEndDate
        ? new Date(updateDto.actualEndDate)
        : null;
    }
    if (updateDto.lastCycleDate !== undefined) {
      updateData.lastCycleDate = updateDto.lastCycleDate
        ? new Date(updateDto.lastCycleDate)
        : null;
    }
    if (updateDto.currentCycle !== undefined) {
      updateData.currentCycle = updateDto.currentCycle;
    }
    if (updateDto.totalCycles !== undefined) {
      updateData.totalCycles = updateDto.totalCycles;
    }
    if (updateDto.cyclesCompleted !== undefined) {
      updateData.cyclesCompleted = updateDto.cyclesCompleted;
    }
    if (updateDto.status !== undefined) {
      updateData.status = updateDto.status;
    }
    if (updateDto.isActive !== undefined) {
      updateData.isActive = updateDto.isActive;
    }
    if (updateDto.discontinuationReason !== undefined) {
      updateData.discontinuationReason = updateDto.discontinuationReason;
    }
    if (updateDto.medications !== undefined) {
      updateData.medications = updateDto.medications;
    }
    if (updateDto.frequency !== undefined) {
      updateData.frequency = updateDto.frequency;
    }
    if (updateDto.administrationRoute !== undefined) {
      updateData.administrationRoute = updateDto.administrationRoute;
    }
    if (updateDto.institutionName !== undefined) {
      updateData.institutionName = updateDto.institutionName;
    }
    if (updateDto.physicianName !== undefined) {
      updateData.physicianName = updateDto.physicianName;
    }
    if (updateDto.toxicities !== undefined) {
      updateData.toxicities = updateDto.toxicities;
    }
    if (updateDto.doseReductions !== undefined) {
      updateData.doseReductions = updateDto.doseReductions;
    }
    if (updateDto.delays !== undefined) {
      updateData.delays = updateDto.delays;
    }
    if (updateDto.response !== undefined) {
      updateData.response = updateDto.response;
    }
    if (updateDto.responseDate !== undefined) {
      updateData.responseDate = updateDto.responseDate
        ? new Date(updateDto.responseDate)
        : null;
    }
    if (updateDto.responseNotes !== undefined) {
      updateData.responseNotes = updateDto.responseNotes;
    }
    if (updateDto.notes !== undefined) {
      updateData.notes = updateDto.notes;
    }
    if (updateDto.metadata !== undefined) {
      updateData.metadata = updateDto.metadata;
    }

    return this.prisma.treatment.update({
      where: { id, tenantId },
      data: updateData,
      include: {
        diagnosis: {
          select: {
            id: true,
            cancerType: true,
            stage: true,
          },
        },
      },
    });
  }

  /**
   * Remove um tratamento
   */
  async remove(id: string, tenantId: string): Promise<void> {
    const existing = await this.prisma.treatment.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!existing) {
      throw new NotFoundException('Treatment not found');
    }

    await this.prisma.treatment.delete({
      where: { id, tenantId },
    });
  }
}
