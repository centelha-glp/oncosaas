import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ClinicalNoteStatus,
  ClinicalNoteType,
} from '@generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ClinicalNotesService, type ClinicalNoteActor } from './clinical-notes.service';
import { CreateClinicalExamRequestDto } from './dto/create-clinical-exam-request.dto';
import { CreateClinicalPrescriptionLineDto } from './dto/create-clinical-prescription-line.dto';

@Injectable()
export class ClinicalNoteOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clinicalNotesService: ClinicalNotesService
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
    if (note.status === ClinicalNoteStatus.VOIDED) {
      throw new BadRequestException('Não é possível alterar pedidos em evolução anulada');
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
    return this.prisma.clinicalPrescriptionLine.create({
      data: {
        tenantId,
        patientId,
        clinicalNoteId,
        clinicalNoteVersionNumber: versionNumber,
        prescribedById: actor.id,
        medicationName: dto.medicationName.trim(),
        catalogKey: dto.catalogKey?.trim() || null,
        dosage: dto.dosage?.trim() || null,
        frequency: dto.frequency?.trim() || null,
        route: dto.route?.trim() || null,
        duration: dto.duration?.trim() || null,
        indication: dto.indication?.trim() || null,
      },
      select: {
        id: true,
        clinicalNoteVersionNumber: true,
        medicationName: true,
        catalogKey: true,
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
}
