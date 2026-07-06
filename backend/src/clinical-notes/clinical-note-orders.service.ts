import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ClinicalNoteStatus,
  ClinicalNoteType,
  Prisma,
} from '@generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ClinicalNotesService, type ClinicalNoteActor } from './clinical-notes.service';
import { CreateClinicalExamRequestDto } from './dto/create-clinical-exam-request.dto';
import { CreateClinicalPrescriptionLineDto } from './dto/create-clinical-prescription-line.dto';
import { MedicationCatalogService } from '../medication-catalog/medication-catalog.service';
import { isAllowedMedicationRoute } from '../medication-catalog/medication-catalog.routes';

@Injectable()
export class ClinicalNoteOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clinicalNotesService: ClinicalNotesService,
    private readonly medicationCatalogService: MedicationCatalogService
  ) {}

  private async resolveNoteForOrders(
    clinicalNoteId: string,
    patientId: string,
    tenantId: string
  ) {
    const note = await this.prisma.clinicalNote.findFirst({
      where: { id: clinicalNoteId, tenantId, patientId },
      select: {
        id: true,
        status: true,
        noteType: true,
        patientId: true,
      },
    });
    if (!note) {
      throw new NotFoundException('Evolução não encontrada para este paciente');
    }
    if (note.status !== ClinicalNoteStatus.DRAFT) {
      throw new BadRequestException(
        'Não é possível alterar pedidos em evolução não editável'
      );
    }
    return note;
  }

  private async latestVersionNumber(
    clinicalNoteId: string,
    tenantId: string
  ): Promise<number> {
    const v = await this.prisma.clinicalNoteVersion.findFirst({
      where: { clinicalNoteId, tenantId },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true },
    });
    if (!v) {
      throw new BadRequestException('Evolução sem versão de conteúdo');
    }
    return v.versionNumber;
  }

  private assertCanManageOrdersForNoteType(
    actor: ClinicalNoteActor,
    noteType: ClinicalNoteType
  ) {
    if (
      !this.clinicalNotesService.canCreateOrSignNoteType(
        actor.role,
        actor.clinicalSubrole,
        noteType
      )
    ) {
      throw new ForbiddenException('Sem permissão para gerir pedidos nesta evolução');
    }
  }

  async listExamRequests(
    patientId: string,
    clinicalNoteId: string,
    tenantId: string
  ) {
    const note = await this.prisma.clinicalNote.findFirst({
      where: { id: clinicalNoteId, tenantId, patientId },
      select: { id: true },
    });
    if (!note) {
      throw new NotFoundException('Evolução não encontrada para este paciente');
    }
    return this.prisma.clinicalExamRequest.findMany({
      where: { tenantId, clinicalNoteId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        clinicalNoteVersionNumber: true,
        displayName: true,
        code: true,
        loincCode: true,
        examCatalogCode: true,
        requestedBy: { select: { id: true, name: true } },
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async createExamRequest(
    patientId: string,
    clinicalNoteId: string,
    tenantId: string,
    actor: ClinicalNoteActor,
    dto: CreateClinicalExamRequestDto
  ) {
    const note = await this.resolveNoteForOrders(
      clinicalNoteId,
      patientId,
      tenantId
    );
    this.assertCanManageOrdersForNoteType(actor, note.noteType);
    const versionNumber = await this.latestVersionNumber(clinicalNoteId, tenantId);
    return this.prisma.clinicalExamRequest.create({
      data: {
        tenantId,
        patientId,
        clinicalNoteId,
        clinicalNoteVersionNumber: versionNumber,
        requestedById: actor.id,
        displayName: dto.displayName.trim(),
        code: dto.code?.trim() || null,
        loincCode: dto.loincCode?.trim() || null,
        examCatalogCode: dto.examCatalogCode?.trim() || null,
      },
      select: {
        id: true,
        clinicalNoteVersionNumber: true,
        displayName: true,
        code: true,
        loincCode: true,
        examCatalogCode: true,
        requestedBy: { select: { id: true, name: true } },
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async deleteExamRequest(
    patientId: string,
    clinicalNoteId: string,
    requestId: string,
    tenantId: string,
    actor: ClinicalNoteActor
  ) {
    const note = await this.resolveNoteForOrders(
      clinicalNoteId,
      patientId,
      tenantId
    );
    this.assertCanManageOrdersForNoteType(actor, note.noteType);
    const row = await this.prisma.clinicalExamRequest.findFirst({
      where: { id: requestId, tenantId, clinicalNoteId, patientId },
      select: { id: true },
    });
    if (!row) {
      throw new NotFoundException('Pedido de exame não encontrado');
    }
    await this.prisma.clinicalExamRequest.delete({
      where: { id: requestId, tenantId },
    });
  }

  async listPrescriptionLines(
    patientId: string,
    clinicalNoteId: string,
    tenantId: string
  ) {
    const note = await this.prisma.clinicalNote.findFirst({
      where: { id: clinicalNoteId, tenantId, patientId },
      select: { id: true },
    });
    if (!note) {
      throw new NotFoundException('Evolução não encontrada para este paciente');
    }
    return this.prisma.clinicalPrescriptionLine.findMany({
      where: { tenantId, clinicalNoteId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        clinicalNoteVersionNumber: true,
        medicationName: true,
        catalogKey: true,
        presentationCatalogCode: true,
        dosage: true,
        frequency: true,
        route: true,
        duration: true,
        indication: true,
        prescribedBy: { select: { id: true, name: true } },
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  private async resolvePrescriptionPayload(
    dto: CreateClinicalPrescriptionLineDto
  ): Promise<{
    medicationName: string;
    catalogKey: string | null;
    presentationCatalogCode: string | null;
    route: string | null;
  }> {
    const catalogKey = dto.catalogKey?.trim() || null;
    const presentationCatalogCode =
      dto.presentationCatalogCode?.trim() || null;
    const route = dto.route?.trim() || null;

    if (!catalogKey) {
      if (presentationCatalogCode) {
        throw new BadRequestException(
          'Apresentação do catálogo exige medicamento do catálogo'
        );
      }
      const name = dto.medicationName?.trim();
      if (!name) {
        throw new BadRequestException('Informe o nome do medicamento');
      }
      return {
        medicationName: name,
        catalogKey: null,
        presentationCatalogCode: null,
        route,
      };
    }

    const drug = await this.medicationCatalogService.findDrugByCode(catalogKey);
    if (!drug) {
      throw new BadRequestException('Medicamento não encontrado no catálogo');
    }

    let medicationName = drug.displayName;
    if (presentationCatalogCode) {
      const presentation =
        await this.medicationCatalogService.findPresentationByCode(
          presentationCatalogCode
        );
      if (!presentation || presentation.drugCode !== catalogKey) {
        throw new BadRequestException(
          'Apresentação inválida para o medicamento selecionado'
        );
      }
      medicationName = presentation.label;
    }

    if (route && !isAllowedMedicationRoute(route, drug.allowedRoutes)) {
      throw new BadRequestException(
        'Via de administração não permitida para este medicamento'
      );
    }

    return {
      medicationName,
      catalogKey,
      presentationCatalogCode,
      route,
    };
  }

  async createPrescriptionLine(
    patientId: string,
    clinicalNoteId: string,
    tenantId: string,
    actor: ClinicalNoteActor,
    dto: CreateClinicalPrescriptionLineDto
  ) {
    const note = await this.resolveNoteForOrders(
      clinicalNoteId,
      patientId,
      tenantId
    );
    if (note.noteType !== ClinicalNoteType.MEDICAL) {
      throw new BadRequestException(
        'Prescrições estruturadas só se aplicam à evolução médica'
      );
    }
    this.assertCanManageOrdersForNoteType(actor, ClinicalNoteType.MEDICAL);
    const versionNumber = await this.latestVersionNumber(clinicalNoteId, tenantId);
    const resolved = await this.resolvePrescriptionPayload(dto);

    return this.prisma.clinicalPrescriptionLine.create({
      data: {
        tenantId,
        patientId,
        clinicalNoteId,
        clinicalNoteVersionNumber: versionNumber,
        prescribedById: actor.id,
        medicationName: resolved.medicationName,
        catalogKey: resolved.catalogKey,
        presentationCatalogCode: resolved.presentationCatalogCode,
        dosage: dto.dosage?.trim() || null,
        frequency: dto.frequency?.trim() || null,
        route: resolved.route,
        duration: dto.duration?.trim() || null,
        indication: dto.indication?.trim() || null,
      },
      select: {
        id: true,
        clinicalNoteVersionNumber: true,
        medicationName: true,
        catalogKey: true,
        presentationCatalogCode: true,
        dosage: true,
        frequency: true,
        route: true,
        duration: true,
        indication: true,
        prescribedBy: { select: { id: true, name: true } },
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async deletePrescriptionLine(
    patientId: string,
    clinicalNoteId: string,
    lineId: string,
    tenantId: string,
    actor: ClinicalNoteActor
  ) {
    const note = await this.resolveNoteForOrders(
      clinicalNoteId,
      patientId,
      tenantId
    );
    if (note.noteType !== ClinicalNoteType.MEDICAL) {
      throw new BadRequestException(
        'Prescrições estruturadas só se aplicam à evolução médica'
      );
    }
    this.assertCanManageOrdersForNoteType(actor, ClinicalNoteType.MEDICAL);
    const row = await this.prisma.clinicalPrescriptionLine.findFirst({
      where: { id: lineId, tenantId, clinicalNoteId, patientId },
      select: { id: true },
    });
    if (!row) {
      throw new NotFoundException('Linha de prescrição não encontrada');
    }
    await this.prisma.clinicalPrescriptionLine.delete({
      where: { id: lineId, tenantId },
    });
  }

  async listPrescriptionHistory(
    patientId: string,
    tenantId: string,
    params: { q?: string; limit: number; offset: number }
  ) {
    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, tenantId },
      select: { id: true },
    });
    if (!patient) {
      throw new NotFoundException('Paciente não encontrado');
    }

    const { q, limit, offset } = params;
    const where: Prisma.ClinicalPrescriptionLineWhereInput = {
      tenantId,
      patientId,
      clinicalNote: { status: { not: ClinicalNoteStatus.VOIDED } },
    };
    const trimmed = q?.trim();
    if (trimmed) {
      where.OR = [
        { medicationName: { contains: trimmed, mode: 'insensitive' } },
        { dosage: { contains: trimmed, mode: 'insensitive' } },
        { frequency: { contains: trimmed, mode: 'insensitive' } },
        { route: { contains: trimmed, mode: 'insensitive' } },
        { indication: { contains: trimmed, mode: 'insensitive' } },
        { catalogKey: { contains: trimmed, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.clinicalPrescriptionLine.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: [{ createdAt: 'desc' }],
        select: {
          id: true,
          clinicalNoteId: true,
          clinicalNoteVersionNumber: true,
          medicationName: true,
          catalogKey: true,
          presentationCatalogCode: true,
          dosage: true,
          frequency: true,
          route: true,
          duration: true,
          indication: true,
          createdAt: true,
          prescribedBy: { select: { id: true, name: true } },
          clinicalNote: {
            select: {
              id: true,
              status: true,
              signedAt: true,
              noteType: true,
            },
          },
        },
      }),
      this.prisma.clinicalPrescriptionLine.count({ where }),
    ]);

    return { items, total, limit, offset };
  }
}
