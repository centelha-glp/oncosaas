import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateConsentDto } from './dto/create-consent.dto';
import { RevokeConsentDto } from './dto/revoke-consent.dto';

@Injectable()
export class ConsentService {
  private readonly logger = new Logger(ConsentService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registra o consentimento de um paciente para uma versão específica do TCLE.
   * Não permite duplo consentimento da mesma versão (sem revogação prévia).
   */
  async createConsent(
    patientId: string,
    dto: CreateConsentDto,
    tenantId: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, tenantId },
    });
    if (!patient) {
      throw new NotFoundException(`Paciente ${patientId} não encontrado`);
    }

    // Verificar se já existe consentimento ativo para esta versão
    const existing = await this.prisma.patientConsent.findFirst({
      where: {
        patientId,
        tenantId,
        version: dto.version,
        revokedAt: null,
      },
    });
    if (existing) {
      throw new ConflictException(
        `Paciente já possui consentimento ativo para a versão ${dto.version}`,
      );
    }

    const consent = await this.prisma.patientConsent.create({
      data: {
        tenantId,
        patientId,
        version: dto.version,
        ipAddress,
        userAgent,
      },
      select: {
        id: true,
        tenantId: true,
        patientId: true,
        version: true,
        consentedAt: true,
        revokedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    this.logger.log(
      `Consentimento registrado: paciente=${patientId} versão=${dto.version} tenant=${tenantId}`,
    );

    return consent;
  }

  /**
   * Revoga o consentimento ativo de um paciente para uma versão do TCLE.
   * Apenas ADMIN pode invocar este método (verificado no controller).
   */
  async revokeConsent(
    patientId: string,
    dto: RevokeConsentDto,
    tenantId: string,
  ) {
    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, tenantId },
    });
    if (!patient) {
      throw new NotFoundException(`Paciente ${patientId} não encontrado`);
    }

    const consent = await this.prisma.patientConsent.findFirst({
      where: {
        patientId,
        tenantId,
        version: dto.version,
        revokedAt: null,
      },
    });
    if (!consent) {
      throw new NotFoundException(
        `Consentimento ativo para versão ${dto.version} não encontrado`,
      );
    }

    const revoked = await this.prisma.patientConsent.update({
      where: { id: consent.id, tenantId },
      data: { revokedAt: new Date() },
      select: {
        id: true,
        tenantId: true,
        patientId: true,
        version: true,
        consentedAt: true,
        revokedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    this.logger.log(
      `Consentimento revogado: paciente=${patientId} versão=${dto.version} tenant=${tenantId}`,
    );

    return revoked;
  }

  /**
   * Retorna o status de consentimento do paciente: todos os registros (ativos e revogados).
   */
  async getConsentStatus(patientId: string, tenantId: string) {
    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, tenantId },
    });
    if (!patient) {
      throw new NotFoundException(`Paciente ${patientId} não encontrado`);
    }

    const consents = await this.prisma.patientConsent.findMany({
      where: { patientId, tenantId },
      orderBy: { consentedAt: 'desc' },
      select: {
        id: true,
        tenantId: true,
        patientId: true,
        version: true,
        consentedAt: true,
        revokedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const activeConsents = consents.filter((c) => c.revokedAt === null);

    return {
      hasActiveConsent: activeConsents.length > 0,
      activeVersions: activeConsents.map((c) => c.version),
      history: consents,
    };
  }

  /**
   * Verifica se o paciente possui consentimento ativo para uma versão específica.
   * Levanta ForbiddenException se não houver consentimento ativo (útil para guards de fluxo clínico).
   */
  async assertConsented(
    patientId: string,
    version: string,
    tenantId: string,
  ): Promise<void> {
    const consent = await this.prisma.patientConsent.findFirst({
      where: { patientId, tenantId, version, revokedAt: null },
    });
    if (!consent) {
      throw new ForbiddenException(
        `Paciente ${patientId} não possui consentimento ativo para a versão ${version}`,
      );
    }
  }
}
