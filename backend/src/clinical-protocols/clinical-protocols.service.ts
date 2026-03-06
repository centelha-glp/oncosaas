import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProtocolDto, UpdateProtocolDto } from './dto/protocol.dto';
import { COLORECTAL_PROTOCOL } from './templates/colorectal.protocol';
import { BLADDER_PROTOCOL } from './templates/bladder.protocol';
import { RENAL_PROTOCOL } from './templates/renal.protocol';
import { PROSTATE_PROTOCOL } from './templates/prostate.protocol';
import { BREAST_PROTOCOL } from './templates/breast.protocol';
import { LUNG_PROTOCOL } from './templates/lung.protocol';
import { OTHER_PROTOCOL } from './templates/other.protocol';

const PROTOCOL_TEMPLATES: Record<string, any> = {
  colorectal: COLORECTAL_PROTOCOL,
  bladder: BLADDER_PROTOCOL,
  renal: RENAL_PROTOCOL,
  prostate: PROSTATE_PROTOCOL,
  breast: BREAST_PROTOCOL,
  lung: LUNG_PROTOCOL,
  other: OTHER_PROTOCOL,
};

@Injectable()
export class ClinicalProtocolsService {
  private readonly logger = new Logger(ClinicalProtocolsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all protocols for a tenant
   */
  async findAll(tenantId: string) {
    return this.prisma.clinicalProtocol.findMany({
      where: { tenantId },
      orderBy: [{ cancerType: 'asc' }, { version: 'desc' }],
      take: 100,
    });
  }

  /**
   * Get active protocol for a specific cancer type
   */
  async findActive(tenantId: string, cancerType: string) {
    const protocol = await this.prisma.clinicalProtocol.findFirst({
      where: {
        tenantId,
        cancerType: cancerType.toLowerCase(),
        isActive: true,
      },
      orderBy: { version: 'desc' },
    });

    if (!protocol) {
      throw new NotFoundException(
        `No active protocol found for cancer type: ${cancerType}`
      );
    }

    return protocol;
  }

  /**
   * Get protocol by ID
   */
  async findOne(id: string, tenantId: string) {
    const protocol = await this.prisma.clinicalProtocol.findFirst({
      where: { id, tenantId },
    });

    if (!protocol) {
      throw new NotFoundException(`Protocol ${id} not found`);
    }

    return protocol;
  }

  /**
   * Create a custom protocol
   */
  async create(dto: CreateProtocolDto, tenantId: string) {
    return this.prisma.clinicalProtocol.create({
      data: {
        tenantId,
        cancerType: dto.cancerType.toLowerCase(),
        name: dto.name,
        version: dto.version || '1.0',
        definition: dto.definition,
        checkInRules: dto.checkInRules,
        criticalSymptoms: dto.criticalSymptoms,
      },
    });
  }

  /**
   * Update a protocol
   */
  async update(id: string, dto: UpdateProtocolDto, tenantId: string) {
    await this.findOne(id, tenantId);

    return this.prisma.clinicalProtocol.update({
      where: { id },
      data: dto,
    });
  }

  /**
   * Initialize default protocols for a tenant from templates
   */
  async initializeDefaultProtocols(tenantId: string) {
    const results = [];

    for (const [cancerType, template] of Object.entries(PROTOCOL_TEMPLATES)) {
      // Check if protocol already exists
      const existing = await this.prisma.clinicalProtocol.findFirst({
        where: { tenantId, cancerType },
      });

      if (existing) {
        this.logger.log(
          `Protocol for ${cancerType} already exists for tenant ${tenantId}`
        );
        results.push(existing);
        continue;
      }

      const protocol = await this.prisma.clinicalProtocol.create({
        data: {
          tenantId,
          cancerType,
          name: template.name,
          version: '1.0',
          isActive: true,
          definition: {
            journeyStages: template.journeyStages,
            riskAdjustment: template.riskAdjustment,
          },
          checkInRules: template.checkInRules,
          criticalSymptoms: template.criticalSymptoms,
        },
      });

      results.push(protocol);
      this.logger.log(
        `Created default ${cancerType} protocol for tenant ${tenantId}`
      );
    }

    return results;
  }

  /**
   * Get check-in rules for a cancer type (for proactive questionnaire scheduling).
   * Tries DB first, then falls back to template. Returns null if no protocol/template.
   */
  async getCheckInRules(
    tenantId: string,
    cancerType: string,
  ): Promise<Record<string, { frequency: string; questionnaire: string | null }> | null> {
    const protocol = await this.prisma.clinicalProtocol.findFirst({
      where: {
        tenantId,
        cancerType: cancerType.toLowerCase(),
        isActive: true,
      },
      orderBy: { version: 'desc' },
      select: { checkInRules: true },
    });

    if (protocol?.checkInRules && typeof protocol.checkInRules === 'object') {
      return protocol.checkInRules as Record<
        string,
        { frequency: string; questionnaire: string | null }
      >;
    }

    const template = PROTOCOL_TEMPLATES[cancerType.toLowerCase()];
    if (template?.checkInRules) {
      return template.checkInRules as Record<
        string,
        { frequency: string; questionnaire: string | null }
      >;
    }

    return null;
  }

  /**
   * Get available protocol templates
   */
  getAvailableTemplates() {
    return Object.entries(PROTOCOL_TEMPLATES).map(([type, template]) => ({
      cancerType: type,
      name: template.name,
      stages: Object.keys(template.journeyStages),
      criticalSymptomsCount: template.criticalSymptoms.length,
    }));
  }
}
