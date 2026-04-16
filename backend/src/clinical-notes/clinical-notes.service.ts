import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import {
  ClinicalNoteStatus,
  ClinicalNoteType,
  ClinicalNoteVersionChangeType,
  ClinicalSubrole,
  UserRole,
} from '@generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditAction } from '@generated/prisma/client';
import {
  encryptSensitiveData,
  decryptSensitiveData,
} from '../whatsapp-connections/utils/encryption.util';
import {
  CLINICAL_NOTE_NAVIGATION_STEP_KEY,
  CLINICAL_NOTE_SECTION_KEYS,
  CLINICAL_NOTE_SECTION_MAX_LENGTH,
} from './clinical-notes.constants';
import {
  CreateClinicalNoteDto,
  UpdateClinicalNoteDto,
  AddendumClinicalNoteDto,
  VoidClinicalNoteDto,
} from './dto/clinical-note-sections.dto';

export interface ClinicalNoteActor {
  id: string;
  role: UserRole;
  clinicalSubrole?: ClinicalSubrole | null;
}

@Injectable()
export class ClinicalNotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditLogService: AuditLogService
  ) {}

  private get encryptionKey(): string {
    const k = this.configService.get<string>('ENCRYPTION_KEY');
    if (!k) {
      throw new Error('ENCRYPTION_KEY is not configured');
    }
    return k;
  }

  private hashPlaintext(plaintext: string): string {
    return crypto.createHash('sha256').update(plaintext, 'utf8').digest('hex');
  }

  normalizeAndValidateSections(raw: Record<string, string>): Record<string, string> {
    const out: Record<string, string> = {};
    for (const key of CLINICAL_NOTE_SECTION_KEYS) {
      const v = raw[key];
      const s = v === undefined || v === null ? '' : String(v);
      if (s.length > CLINICAL_NOTE_SECTION_MAX_LENGTH) {
        throw new BadRequestException(
          `Seção "${key}" excede ${CLINICAL_NOTE_SECTION_MAX_LENGTH} caracteres`
        );
      }
      out[key] = s;
    }
    for (const k of Object.keys(raw)) {
      if (!CLINICAL_NOTE_SECTION_KEYS.includes(k as (typeof CLINICAL_NOTE_SECTION_KEYS)[number])) {
        throw new BadRequestException(`Chave de seção desconhecida: ${k}`);
      }
    }
    return out;
  }

  private encryptSectionsJson(sections: Record<string, string>): {
    encrypted: string;
    hash: string;
  } {
    const plaintext = JSON.stringify(sections);
    const hash = this.hashPlaintext(plaintext);
    const encrypted = encryptSensitiveData(plaintext, this.encryptionKey);
    return { encrypted, hash };
  }

  private decryptSectionsJson(encrypted: string): Record<string, string> {
    const plaintext = decryptSensitiveData(encrypted, this.encryptionKey);
    const parsed = JSON.parse(plaintext) as Record<string, string>;
    return this.normalizeAndValidateSections(parsed);
  }

  /** Garante que a etapa pertence ao paciente/tenant e corresponde ao tipo de evolução. */
  async validateNavigationStepForEvolution(
    navigationStepId: string,
    patientId: string,
    tenantId: string,
    noteType: ClinicalNoteType
  ): Promise<void> {
    const expectedKey =
      noteType === ClinicalNoteType.MEDICAL
        ? CLINICAL_NOTE_NAVIGATION_STEP_KEY.MEDICAL
        : CLINICAL_NOTE_NAVIGATION_STEP_KEY.NURSING;
    const step = await this.prisma.navigationStep.findFirst({
      where: { id: navigationStepId, tenantId, patientId },
      select: { id: true, stepKey: true },
    });
    if (!step) {
      throw new NotFoundException(
        'Etapa de navegação não encontrada para este paciente'
      );
    }
    if (step.stepKey !== expectedKey) {
      throw new BadRequestException(
        noteType === ClinicalNoteType.MEDICAL
          ? 'A evolução médica deve ser vinculada à etapa de consulta especializada.'
          : 'A evolução de enfermagem deve ser vinculada à etapa de consulta de navegação oncológica.'
      );
    }
  }

  canCreateOrSignNoteType(
    role: UserRole,
    clinicalSubrole: ClinicalSubrole | null | undefined,
    noteType: ClinicalNoteType
  ): boolean {
    if (noteType === ClinicalNoteType.NURSING) {
      return (
        role === UserRole.NURSE ||
        role === UserRole.NURSE_CHIEF ||
        (role === UserRole.COORDINATOR &&
          clinicalSubrole === ClinicalSubrole.NURSING) ||
        (role === UserRole.ADMIN &&
          clinicalSubrole === ClinicalSubrole.NURSING)
      );
    }
    return (
      role === UserRole.DOCTOR ||
      role === UserRole.ONCOLOGIST ||
      (role === UserRole.COORDINATOR &&
        clinicalSubrole === ClinicalSubrole.MEDICAL) ||
      (role === UserRole.ADMIN &&
        clinicalSubrole === ClinicalSubrole.MEDICAL)
    );
  }

  canEditDraft(
    role: UserRole,
    clinicalSubrole: ClinicalSubrole | null | undefined,
    noteType: ClinicalNoteType,
    userId: string,
    createdById: string
  ): boolean {
    if (userId === createdById) {
      return true;
    }
    if (
      noteType === ClinicalNoteType.NURSING &&
      role === UserRole.NURSE_CHIEF
    ) {
      return true;
    }
    if (
      noteType === ClinicalNoteType.MEDICAL &&
      role === UserRole.ONCOLOGIST
    ) {
      return true;
    }
    return this.canCreateOrSignNoteType(role, clinicalSubrole, noteType);
  }

  canVoidNote(
    role: UserRole,
    clinicalSubrole: ClinicalSubrole | null | undefined,
    noteType: ClinicalNoteType,
    status: ClinicalNoteStatus,
    userId: string,
    createdById: string
  ): boolean {
    if (status === ClinicalNoteStatus.VOIDED) {
      return false;
    }
    if (status === ClinicalNoteStatus.DRAFT) {
      return this.canEditDraft(
        role,
        clinicalSubrole,
        noteType,
        userId,
        createdById
      );
    }
    if (noteType === ClinicalNoteType.NURSING) {
      return (
        role === UserRole.NURSE_CHIEF ||
        (role === UserRole.COORDINATOR &&
          clinicalSubrole === ClinicalSubrole.NURSING) ||
        (role === UserRole.ADMIN &&
          clinicalSubrole === ClinicalSubrole.NURSING)
      );
    }
    return (
      role === UserRole.ONCOLOGIST ||
      role === UserRole.DOCTOR ||
      (role === UserRole.COORDINATOR &&
        clinicalSubrole === ClinicalSubrole.MEDICAL) ||
      (role === UserRole.ADMIN &&
        clinicalSubrole === ClinicalSubrole.MEDICAL)
    );
  }

  toMutationResponse(note: {
    id: string;
    patientId: string;
    status: ClinicalNoteStatus;
    noteType: ClinicalNoteType;
    amendsClinicalNoteId: string | null;
    navigationStepId: string | null;
    updatedAt: Date;
    versions: { versionNumber: number; sectionsContentHash: string }[];
  }) {
    const latest = note.versions[0];
    return {
      id: note.id,
      patientId: note.patientId,
      status: note.status,
      noteType: note.noteType,
      latestVersionNumber: latest?.versionNumber ?? 0,
      sectionsContentHash: latest?.sectionsContentHash ?? '',
      amendsClinicalNoteId: note.amendsClinicalNoteId,
      navigationStepId: note.navigationStepId,
      updatedAt: note.updatedAt,
    };
  }

  async create(
    patientId: string,
    dto: CreateClinicalNoteDto,
    tenantId: string,
    actor: ClinicalNoteActor
  ) {
    if (!this.canCreateOrSignNoteType(actor.role, actor.clinicalSubrole, dto.noteType)) {
      throw new ForbiddenException(
        'Sem permissão para criar este tipo de nota clínica'
      );
    }

    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, tenantId },
    });
    if (!patient) {
      throw new NotFoundException(`Patient ${patientId} not found`);
    }

    await this.validateNavigationStepForEvolution(
      dto.navigationStepId,
      patientId,
      tenantId,
      dto.noteType
    );

    const sections = this.normalizeAndValidateSections(dto.sections);
    const { encrypted, hash } = this.encryptSectionsJson(sections);

    const row = await this.prisma.$transaction(async (tx) => {
      const note = await tx.clinicalNote.create({
        data: {
          tenantId,
          patientId,
          noteType: dto.noteType,
          status: ClinicalNoteStatus.DRAFT,
          createdById: actor.id,
          navigationStepId: dto.navigationStepId,
        },
      });
      await tx.clinicalNoteVersion.create({
        data: {
          tenantId,
          clinicalNoteId: note.id,
          versionNumber: 1,
          sectionsPayloadEncrypted: encrypted,
          sectionsContentHash: hash,
          authorId: actor.id,
          changeType: ClinicalNoteVersionChangeType.CREATE,
        },
      });
      return tx.clinicalNote.findFirstOrThrow({
        where: { id: note.id, tenantId },
        include: {
          versions: {
            orderBy: { versionNumber: 'desc' },
            take: 1,
            select: { versionNumber: true, sectionsContentHash: true },
          },
        },
      });
    });

    return this.toMutationResponse(row);
  }

  async findAllForPatient(
    patientId: string,
    tenantId: string,
    page = 1,
    limit = 20,
    navigationStepId?: string
  ) {
    const take = Math.min(Math.max(limit, 1), 100);
    const skip = (Math.max(page, 1) - 1) * take;

    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, tenantId },
      select: { id: true },
    });
    if (!patient) {
      throw new NotFoundException(`Patient ${patientId} not found`);
    }

    const listWhere = {
      tenantId,
      patientId,
      status: { not: ClinicalNoteStatus.VOIDED },
      ...(navigationStepId ? { navigationStepId } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.clinicalNote.findMany({
        where: listWhere,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          createdBy: { select: { id: true, name: true, role: true } },
          signedBy: { select: { id: true, name: true, role: true } },
          navigationStep: {
            select: {
              id: true,
              stepKey: true,
              stepName: true,
              journeyStage: true,
            },
          },
          versions: {
            orderBy: { versionNumber: 'desc' },
            take: 1,
            select: {
              versionNumber: true,
              sectionsContentHash: true,
              createdAt: true,
              author: { select: { id: true, name: true, role: true } },
            },
          },
        },
      }),
      this.prisma.clinicalNote.count({ where: listWhere }),
    ]);

    return {
      data: items.map((n) => ({
        id: n.id,
        patientId: n.patientId,
        noteType: n.noteType,
        status: n.status,
        amendsClinicalNoteId: n.amendsClinicalNoteId,
        navigationStepId: n.navigationStepId,
        navigationStep: n.navigationStep,
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
        createdBy: n.createdBy,
        signedBy: n.signedBy,
        signedAt: n.signedAt,
        lastEditedBy: n.versions[0]?.author ?? null,
        latestVersion: n.versions[0]
          ? {
              versionNumber: n.versions[0].versionNumber,
              sectionsContentHash: n.versions[0].sectionsContentHash,
              createdAt: n.versions[0].createdAt,
            }
          : null,
      })),
      total,
      page: Math.max(page, 1),
      limit: take,
    };
  }

  async findOne(
    id: string,
    tenantId: string,
    actor: ClinicalNoteActor,
    auditContext?: { ipAddress?: string; userAgent?: string }
  ) {
    const note = await this.prisma.clinicalNote.findFirst({
      where: { id, tenantId },
      include: {
        createdBy: { select: { id: true, name: true, role: true } },
        signedBy: { select: { id: true, name: true, role: true } },
        voidedBy: { select: { id: true, name: true, role: true } },
        navigationStep: {
          select: {
            id: true,
            stepKey: true,
            stepName: true,
            journeyStage: true,
          },
        },
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
          include: {
            author: { select: { id: true, name: true, role: true } },
          },
        },
      },
    });

    if (!note) {
      throw new NotFoundException(`Clinical note ${id} not found`);
    }

    const latest = note.versions[0];
    if (!latest) {
      throw new NotFoundException(`Clinical note ${id} has no versions`);
    }

    const sections = this.decryptSectionsJson(latest.sectionsPayloadEncrypted);

    await this.auditLogService.log({
      tenantId,
      userId: actor.id,
      action: AuditAction.VIEW,
      resourceType: 'clinical-notes',
      resourceId: id,
      newValues: {
        clinicalNoteId: id,
        patientId: note.patientId,
        versionNumber: latest.versionNumber,
        sectionsContentHash: latest.sectionsContentHash,
      },
      ipAddress: auditContext?.ipAddress,
      userAgent: auditContext?.userAgent,
    });

    return {
      id: note.id,
      patientId: note.patientId,
      noteType: note.noteType,
      status: note.status,
      amendsClinicalNoteId: note.amendsClinicalNoteId,
      navigationStepId: note.navigationStepId,
      navigationStep: note.navigationStep,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
      createdBy: note.createdBy,
      lastEditedBy: latest.author,
      signedBy: note.signedBy,
      signedAt: note.signedAt,
      voidedBy: note.voidedBy,
      voidedAt: note.voidedAt,
      voidReason: note.voidReason,
      latestVersionNumber: latest.versionNumber,
      sectionsContentHash: latest.sectionsContentHash,
      sections,
    };
  }

  async findVersions(id: string, tenantId: string) {
    const note = await this.prisma.clinicalNote.findFirst({
      where: { id, tenantId },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          include: {
            author: { select: { id: true, name: true, role: true } },
          },
        },
      },
    });
    if (!note) {
      throw new NotFoundException(`Clinical note ${id} not found`);
    }

    return {
      clinicalNoteId: note.id,
      versions: note.versions.map((v) => ({
        id: v.id,
        versionNumber: v.versionNumber,
        changeType: v.changeType,
        changeReason: v.changeReason,
        sectionsContentHash: v.sectionsContentHash,
        createdAt: v.createdAt,
        author: v.author,
      })),
    };
  }

  async update(
    id: string,
    dto: UpdateClinicalNoteDto,
    tenantId: string,
    actor: ClinicalNoteActor
  ) {
    const note = await this.prisma.clinicalNote.findFirst({
      where: { id, tenantId },
      include: {
        versions: { orderBy: { versionNumber: 'desc' }, take: 1 },
      },
    });

    if (!note) {
      throw new NotFoundException(`Clinical note ${id} not found`);
    }
    if (note.status !== ClinicalNoteStatus.DRAFT) {
      throw new BadRequestException(
        'Somente notas em rascunho podem ser editadas'
      );
    }
    if (
      !this.canEditDraft(
        actor.role,
        actor.clinicalSubrole,
        note.noteType,
        actor.id,
        note.createdById
      )
    ) {
      throw new ForbiddenException('Sem permissão para editar esta nota');
    }

    if (dto.navigationStepId !== undefined) {
      await this.validateNavigationStepForEvolution(
        dto.navigationStepId,
        note.patientId,
        tenantId,
        note.noteType
      );
    }

    const sections = this.normalizeAndValidateSections(dto.sections);
    const { encrypted, hash } = this.encryptSectionsJson(sections);
    const nextVersion = (note.versions[0]?.versionNumber ?? 0) + 1;

    const row = await this.prisma.$transaction(async (tx) => {
      await tx.clinicalNoteVersion.create({
        data: {
          tenantId,
          clinicalNoteId: note.id,
          versionNumber: nextVersion,
          sectionsPayloadEncrypted: encrypted,
          sectionsContentHash: hash,
          authorId: actor.id,
          changeType: ClinicalNoteVersionChangeType.EDIT,
          changeReason: dto.changeReason,
        },
      });
      await tx.clinicalNote.update({
        where: { id: note.id, tenantId },
        data: {
          updatedAt: new Date(),
          ...(dto.navigationStepId !== undefined
            ? { navigationStepId: dto.navigationStepId }
            : {}),
        },
      });
      return tx.clinicalNote.findFirstOrThrow({
        where: { id: note.id, tenantId },
        include: {
          versions: {
            orderBy: { versionNumber: 'desc' },
            take: 1,
            select: { versionNumber: true, sectionsContentHash: true },
          },
        },
      });
    });

    return this.toMutationResponse(row);
  }

  async sign(id: string, tenantId: string, actor: ClinicalNoteActor) {
    const note = await this.prisma.clinicalNote.findFirst({
      where: { id, tenantId },
      include: {
        versions: { orderBy: { versionNumber: 'desc' }, take: 1 },
      },
    });

    if (!note) {
      throw new NotFoundException(`Clinical note ${id} not found`);
    }
    if (note.status !== ClinicalNoteStatus.DRAFT) {
      throw new BadRequestException('Somente rascunhos podem ser assinados');
    }
    if (!this.canCreateOrSignNoteType(actor.role, actor.clinicalSubrole, note.noteType)) {
      throw new ForbiddenException('Sem permissão para assinar este tipo de nota');
    }

    const row = await this.prisma.clinicalNote.update({
      where: { id: note.id, tenantId },
      data: {
        status: ClinicalNoteStatus.SIGNED,
        signedById: actor.id,
        signedAt: new Date(),
      },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
          select: { versionNumber: true, sectionsContentHash: true },
        },
      },
    });

    return this.toMutationResponse(row);
  }

  async addendum(
    signedNoteId: string,
    dto: AddendumClinicalNoteDto,
    tenantId: string,
    actor: ClinicalNoteActor
  ) {
    const parent = await this.prisma.clinicalNote.findFirst({
      where: { id: signedNoteId, tenantId },
    });
    if (!parent) {
      throw new NotFoundException(`Clinical note ${signedNoteId} not found`);
    }
    if (parent.status !== ClinicalNoteStatus.SIGNED) {
      throw new BadRequestException(
        'Adendo só pode ser criado a partir de nota assinada'
      );
    }
    if (!this.canCreateOrSignNoteType(actor.role, actor.clinicalSubrole, parent.noteType)) {
      throw new ForbiddenException(
        'Sem permissão para criar adendo deste tipo de nota'
      );
    }

    const raw = dto.sections ?? {};
    const sections = this.normalizeAndValidateSections(
      Object.fromEntries(
        CLINICAL_NOTE_SECTION_KEYS.map((k) => [k, raw[k] ?? ''])
      ) as Record<string, string>
    );
    const { encrypted, hash } = this.encryptSectionsJson(sections);

    const row = await this.prisma.$transaction(async (tx) => {
      const note = await tx.clinicalNote.create({
        data: {
          tenantId,
          patientId: parent.patientId,
          noteType: parent.noteType,
          status: ClinicalNoteStatus.DRAFT,
          createdById: actor.id,
          amendsClinicalNoteId: parent.id,
          navigationStepId: parent.navigationStepId,
        },
      });
      await tx.clinicalNoteVersion.create({
        data: {
          tenantId,
          clinicalNoteId: note.id,
          versionNumber: 1,
          sectionsPayloadEncrypted: encrypted,
          sectionsContentHash: hash,
          authorId: actor.id,
          changeType: ClinicalNoteVersionChangeType.CREATE,
        },
      });
      return tx.clinicalNote.findFirstOrThrow({
        where: { id: note.id, tenantId },
        include: {
          versions: {
            orderBy: { versionNumber: 'desc' },
            take: 1,
            select: { versionNumber: true, sectionsContentHash: true },
          },
        },
      });
    });

    return this.toMutationResponse(row);
  }

  async voidNote(
    id: string,
    dto: VoidClinicalNoteDto,
    tenantId: string,
    actor: ClinicalNoteActor
  ) {
    const note = await this.prisma.clinicalNote.findFirst({
      where: { id, tenantId },
      include: {
        versions: { orderBy: { versionNumber: 'desc' }, take: 1 },
      },
    });

    if (!note) {
      throw new NotFoundException(`Clinical note ${id} not found`);
    }
    if (
      !this.canVoidNote(
        actor.role,
        actor.clinicalSubrole,
        note.noteType,
        note.status,
        actor.id,
        note.createdById
      )
    ) {
      throw new ForbiddenException('Sem permissão para anular esta nota');
    }

    const row = await this.prisma.clinicalNote.update({
      where: { id: note.id, tenantId },
      data: {
        status: ClinicalNoteStatus.VOIDED,
        voidedById: actor.id,
        voidedAt: new Date(),
        voidReason: dto.voidReason,
      },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
          select: { versionNumber: true, sectionsContentHash: true },
        },
      },
    });

    return this.toMutationResponse(row);
  }

  async getThread(id: string, tenantId: string) {
    const note = await this.prisma.clinicalNote.findFirst({
      where: { id, tenantId },
    });
    if (!note) {
      throw new NotFoundException(`Clinical note ${id} not found`);
    }

    let current = note;
    const visited = new Set<string>();
    while (current.amendsClinicalNoteId && !visited.has(current.id)) {
      visited.add(current.id);
      const parent = await this.prisma.clinicalNote.findFirst({
        where: { id: current.amendsClinicalNoteId, tenantId },
      });
      if (!parent) {
        break;
      }
      current = parent;
    }
    const rootId = current.id;

    const allInPatient = await this.prisma.clinicalNote.findMany({
      where: { tenantId, patientId: note.patientId },
      include: {
        createdBy: { select: { id: true, name: true, role: true } },
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
          select: { versionNumber: true, sectionsContentHash: true },
        },
      },
    });

    const subtreeIds = new Set<string>();
    function collectFromRoot(rid: string) {
      subtreeIds.add(rid);
      for (const n of allInPatient) {
        if (n.amendsClinicalNoteId === rid) {
          collectFromRoot(n.id);
        }
      }
    }
    collectFromRoot(rootId);

    const chain = allInPatient.filter((n) => subtreeIds.has(n.id));

    const byParent = new Map<string | null, typeof chain>();
    for (const n of chain) {
      const k = n.amendsClinicalNoteId;
      if (!byParent.has(k)) {
        byParent.set(k, []);
      }
      byParent.get(k)!.push(n);
    }

    function walk(parentKey: string | null): unknown[] {
      const kids = (byParent.get(parentKey) ?? []).sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
      );
      return kids.map((n) => ({
        id: n.id,
        noteType: n.noteType,
        status: n.status,
        createdAt: n.createdAt,
        createdBy: n.createdBy,
        amendsClinicalNoteId: n.amendsClinicalNoteId,
        latestVersion: n.versions[0] ?? null,
        children: walk(n.id),
      }));
    }

    return { rootId, tree: walk(null) };
  }
}
