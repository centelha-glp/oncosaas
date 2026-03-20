import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertEmergencyReferenceDto } from './dto/upsert-emergency-reference.dto';

@Injectable()
export class EmergencyReferencesService {
  private readonly logger = new Logger(EmergencyReferencesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findByTenant(tenantId: string) {
    return this.prisma.emergencyReference.findUnique({ where: { tenantId } });
  }

  async upsert(tenantId: string, dto: UpsertEmergencyReferenceDto) {
    return this.prisma.emergencyReference.upsert({
      where: { tenantId },
      create: { tenantId, ...dto },
      update: { ...dto },
    });
  }

  async remove(tenantId: string) {
    return this.prisma.emergencyReference.deleteMany({ where: { tenantId } });
  }
}
