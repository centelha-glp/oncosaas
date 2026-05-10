import { ConflictException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import type { CouncilFields } from './professional-council';

export async function assertCouncilUniqueInTenant(
  prisma: PrismaService,
  tenantId: string,
  councils: CouncilFields,
  excludeUserId?: string
): Promise<void> {
  if (councils.crmUf && councils.crmNumber) {
    const dup = await prisma.user.findFirst({
      where: {
        tenantId,
        crmUf: councils.crmUf,
        crmNumber: councils.crmNumber,
        ...(excludeUserId ? { NOT: { id: excludeUserId } } : {}),
      },
    });
    if (dup) {
      throw new ConflictException(
        'Já existe um usuário com este CRM neste hospital.'
      );
    }
  }
  if (councils.corenUf && councils.corenNumber) {
    const dup = await prisma.user.findFirst({
      where: {
        tenantId,
        corenUf: councils.corenUf,
        corenNumber: councils.corenNumber,
        ...(excludeUserId ? { NOT: { id: excludeUserId } } : {}),
      },
    });
    if (dup) {
      throw new ConflictException(
        'Já existe um usuário com este COREN neste hospital.'
      );
    }
  }
}
