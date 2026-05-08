import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ClinicalNotesService, type ClinicalNoteActor } from '../clinical-notes/clinical-notes.service';
import { CreateTissSpsadtGuideDto } from './dto/create-tiss-spsadt-guide.dto';

const TISS_ROLES = [
  UserRole.NURSE,
  UserRole.NURSE_CHIEF,
  UserRole.DOCTOR,
  UserRole.ONCOLOGIST,
  UserRole.COORDINATOR,
  UserRole.ADMIN,
] as const;

@Injectable()
export class TissGuidesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clinicalNotesService: ClinicalNotesService
  ) {}

  private assertCanEmit(actor: ClinicalNoteActor) {
    if (!TISS_ROLES.includes(actor.role)) {
      throw new ForbiddenException('Sem permissão para emitir guia TISS');
    }
  }

  private normalizeGuideNumber(n: number): string {
    // MVP: sequência por tenant. Mantém como string para permitir futura formatação.
    return String(n);
  }

  private async nextGuideNumberInTx(
    tx: Prisma.TransactionClient,
    tenantId: string
  ): Promise<string> {
    const last = await tx.tissSpsadtGuide.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      select: { guideNumber: true },
    });
    const lastN = last?.guideNumber ? Number.parseInt(last.guideNumber, 10) : 0;
    const next = Number.isFinite(lastN) ? lastN + 1 : 1;
    return this.normalizeGuideNumber(next);
  }

  async emitSpsadtGuide(params: {
    patientId: string;
    clinicalNoteId: string;
    tenantId: string;
    actor: ClinicalNoteActor;
    dto: CreateTissSpsadtGuideDto;
  }) {
    const { patientId, clinicalNoteId, tenantId, actor, dto } = params;
    this.assertCanEmit(actor);

    const note = await this.prisma.clinicalNote.findFirst({
      where: { id: clinicalNoteId, tenantId, patientId },
      select: { id: true, noteType: true },
    });
    if (!note) {
      throw new NotFoundException('Evolução não encontrada para este paciente');
    }
    // Mantém a mesma regra de permissão do prontuário por tipo de evolução.
    if (
      !this.clinicalNotesService.canCreateOrSignNoteType(
        actor.role,
        actor.clinicalSubrole,
        note.noteType
      )
    ) {
      throw new ForbiddenException('Sem permissão para emitir guia nesta evolução');
    }

    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, tenantId },
      select: { id: true, name: true },
    });
    if (!patient) {
      throw new NotFoundException('Paciente não encontrado');
    }

    const examRequests = await this.prisma.clinicalExamRequest.findMany({
      where: { tenantId, patientId, clinicalNoteId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        displayName: true,
        examCatalogCode: true,
        code: true,
        loincCode: true,
      },
    });
    if (examRequests.length === 0) {
      throw new BadRequestException(
        'Não há solicitações de exame para emitir guia TISS nesta evolução'
      );
    }

    const operatorName = dto.operatorName.trim();
    const beneficiaryName = (dto.beneficiaryName?.trim() || patient.name).trim();
    const requestingProfessionalName = dto.requestingProfessionalName?.trim() || '';

    if (!operatorName) {
      throw new BadRequestException('Operadora é obrigatória');
    }
    if (!beneficiaryName) {
      throw new BadRequestException('Nome do beneficiário é obrigatório');
    }

    // Se não veio explicitamente do frontend, tenta inferir do usuário do sistema.
    let resolvedProfessionalName = requestingProfessionalName;
    if (!resolvedProfessionalName) {
      const user = await this.prisma.user.findFirst({
        where: { id: actor.id, tenantId },
        select: { name: true },
      });
      resolvedProfessionalName = user?.name?.trim() || 'Profissional';
    }

    // Gera sequência com retry em caso de conflito de unique(tenantId, guideNumber).
    const maxRetries = 5;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const guideNumber = await this.nextGuideNumberInTx(tx, tenantId);

          const guide = await tx.tissSpsadtGuide.create({
            data: {
              tenantId,
              patientId,
              clinicalNoteId,
              guideNumber,
              operatorName,
              operatorANSCode: dto.operatorANSCode?.trim() || null,
              beneficiaryName,
              beneficiaryCardNumber: dto.beneficiaryCardNumber?.trim() || null,
              requestingProfessionalName: resolvedProfessionalName,
              requestingProfessionalCouncil:
                dto.requestingProfessionalCouncil?.trim() || null,
              requestingProfessionalCouncilUf:
                dto.requestingProfessionalCouncilUf?.trim() || null,
              requestingProfessionalRegistration:
                dto.requestingProfessionalRegistration?.trim() || null,
              requestingFacilityCnes: dto.requestingFacilityCnes?.trim() || null,
              createdById: actor.id,
            },
            select: {
              id: true,
              guideNumber: true,
              operatorName: true,
              operatorANSCode: true,
              beneficiaryName: true,
              beneficiaryCardNumber: true,
              requestingProfessionalName: true,
              requestingProfessionalCouncil: true,
              requestingProfessionalCouncilUf: true,
              requestingProfessionalRegistration: true,
              requestingFacilityCnes: true,
              createdAt: true,
              patient: { select: { id: true, name: true } },
            },
          });

          await tx.tissSpsadtGuideItem.createMany({
            data: examRequests.map((r) => ({
              tenantId,
              guideId: guide.id,
              examRequestId: r.id,
              procedureName: r.displayName,
              procedureCode: r.examCatalogCode || r.code || r.loincCode || null,
              quantity: 1,
              notes: null,
            })),
          });

          const items = await tx.tissSpsadtGuideItem.findMany({
            where: { tenantId, guideId: guide.id },
            orderBy: { createdAt: 'asc' },
            select: {
              id: true,
              procedureName: true,
              procedureCode: true,
              quantity: true,
              notes: true,
              examRequestId: true,
            },
          });

          return { ...guide, items };
        });
      } catch (e: any) {
        // Unique constraint conflict: tenta novamente com novo número.
        const code = e?.code;
        if (code === 'P2002') {
          continue;
        }
        throw e;
      }
    }

    throw new ConflictException(
      'Não foi possível gerar número de guia TISS (conflito concorrente). Tente novamente.'
    );
  }

  async getSpsadtGuide(guideId: string, tenantId: string) {
    const guide = await this.prisma.tissSpsadtGuide.findFirst({
      where: { id: guideId, tenantId },
      select: {
        id: true,
        guideNumber: true,
        operatorName: true,
        operatorANSCode: true,
        beneficiaryName: true,
        beneficiaryCardNumber: true,
        requestingProfessionalName: true,
        requestingProfessionalCouncil: true,
        requestingProfessionalCouncilUf: true,
        requestingProfessionalRegistration: true,
        requestingFacilityCnes: true,
        createdAt: true,
        patient: { select: { id: true, name: true } },
        items: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            procedureName: true,
            procedureCode: true,
            quantity: true,
            notes: true,
            examRequestId: true,
          },
        },
      },
    });
    if (!guide) {
      throw new NotFoundException('Guia não encontrada');
    }
    return guide;
  }
}

