import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';
import { ClinicalSubrole, UserRole } from '@generated/prisma/client';
import {
  councilFieldsForRole,
  councilValidationMessage,
} from './utils/professional-council';
import { assertCouncilUniqueInTenant } from './utils/professional-council-unique';

const userPublicSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  clinicalSubrole: true,
  mfaEnabled: true,
  crmUf: true,
  crmNumber: true,
  corenUf: true,
  corenNumber: true,
  createdAt: true,
  updatedAt: true,
  tenant: {
    select: {
      id: true,
      name: true,
    },
  },
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    tenantId: string,
    options?: { limit?: number; offset?: number }
  ) {
    const limit =
      options?.limit && options.limit > 0 ? Math.min(options.limit, 500) : 100;
    const offset = options?.offset && options.offset > 0 ? options.offset : 0;

    return this.prisma.user.findMany({
      where: { tenantId },
      select: userPublicSelect,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  async findOne(id: string, tenantId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id,
        tenantId,
      },
      select: userPublicSelect,
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  async create(
    createUserDto: CreateUserDto,
    tenantId: string,
    currentUserRole?: UserRole
  ) {
    // Verificar se email já existe no tenant
    const existingUser = await this.prisma.user.findFirst({
      where: {
        tenantId,
        email: createUserDto.email,
      },
    });

    if (existingUser) {
      throw new ConflictException(
        `User with email ${createUserDto.email} already exists in this tenant`
      );
    }

    // Se tentando criar usuário com role diferente de NURSE, verificar se é ADMIN
    // NURSE_CHIEF pode criar apenas NURSE
    if (
      createUserDto.role !== UserRole.NURSE &&
      currentUserRole !== UserRole.ADMIN
    ) {
      throw new BadRequestException(
        'Only administrators can create users with roles other than NURSE'
      );
    }

    // Hash da senha
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    const clinicalSubrole: ClinicalSubrole | null =
      createUserDto.role === UserRole.COORDINATOR ||
      createUserDto.role === UserRole.ADMIN
        ? createUserDto.clinicalSubrole ?? null
        : null;

    const councils = councilFieldsForRole(
      createUserDto.role,
      createUserDto,
      clinicalSubrole
    );
    const councilErr = councilValidationMessage(
      createUserDto.role,
      councils,
      clinicalSubrole
    );
    if (councilErr) {
      throw new BadRequestException(councilErr);
    }

    await assertCouncilUniqueInTenant(this.prisma, tenantId, councils);

    // Criar usuário (mfaEnabled fica em default(false) do schema; ativação via API
    // está desabilitada até o fluxo TOTP/MFA real ser implementado)
    const user = await this.prisma.user.create({
      data: {
        email: createUserDto.email,
        name: createUserDto.name,
        role: createUserDto.role,
        password: hashedPassword,
        tenantId,
        clinicalSubrole,
        crmUf: councils.crmUf,
        crmNumber: councils.crmNumber,
        corenUf: councils.corenUf,
        corenNumber: councils.corenNumber,
      },
      select: userPublicSelect,
    });

    return user;
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
    tenantId: string,
    currentUserRole?: UserRole
  ) {
    // Verificar se usuário existe
    const existingUser = await this.prisma.user.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!existingUser) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Se tentando alterar role, verificar se o usuário atual é ADMIN
    if (
      updateUserDto.role &&
      updateUserDto.role !== existingUser.role &&
      currentUserRole !== UserRole.ADMIN
    ) {
      throw new BadRequestException(
        'Only administrators can change user roles'
      );
    }

    if (
      updateUserDto.clinicalSubrole !== undefined &&
      currentUserRole !== UserRole.ADMIN
    ) {
      throw new BadRequestException(
        'Only administrators can change clinical subrole'
      );
    }

    // Se email está sendo atualizado, verificar duplicata
    if (updateUserDto.email && updateUserDto.email !== existingUser.email) {
      const emailExists = await this.prisma.user.findFirst({
        where: {
          tenantId,
          email: updateUserDto.email,
          NOT: { id },
        },
      });

      if (emailExists) {
        throw new ConflictException(
          `User with email ${updateUserDto.email} already exists in this tenant`
        );
      }
    }

    const targetRole = updateUserDto.role ?? existingUser.role;

    if (
      updateUserDto.clinicalSubrole !== undefined &&
      targetRole !== UserRole.COORDINATOR &&
      targetRole !== UserRole.ADMIN
    ) {
      throw new BadRequestException(
        'clinicalSubrole applies only to COORDINATOR or ADMIN users'
      );
    }

    const targetClinicalSubrole =
      updateUserDto.clinicalSubrole !== undefined
        ? updateUserDto.clinicalSubrole
        : existingUser.clinicalSubrole;

    const mergedCouncilInput = {
      crmUf:
        updateUserDto.crmUf !== undefined
          ? updateUserDto.crmUf
          : existingUser.crmUf,
      crmNumber:
        updateUserDto.crmNumber !== undefined
          ? updateUserDto.crmNumber
          : existingUser.crmNumber,
      corenUf:
        updateUserDto.corenUf !== undefined
          ? updateUserDto.corenUf
          : existingUser.corenUf,
      corenNumber:
        updateUserDto.corenNumber !== undefined
          ? updateUserDto.corenNumber
          : existingUser.corenNumber,
    };

    const councils = councilFieldsForRole(
      targetRole,
      mergedCouncilInput,
      targetClinicalSubrole
    );
    const councilErr = councilValidationMessage(
      targetRole,
      councils,
      targetClinicalSubrole
    );
    if (councilErr) {
      throw new BadRequestException(councilErr);
    }

    await assertCouncilUniqueInTenant(this.prisma, tenantId, councils, id);

    // Hash da senha se fornecida
    const updateData: Record<string, unknown> = {
      ...updateUserDto,
    };
    delete updateData.crmUf;
    delete updateData.crmNumber;
    delete updateData.corenUf;
    delete updateData.corenNumber;
    // mfaEnabled nunca deve ser alterado pela rota de update — o fluxo TOTP real
    // não está implementado; o ValidationPipe já barra, mas removemos por defesa
    // em profundidade caso o DTO chegue por outra origem (ex.: testes).
    delete (updateData as { mfaEnabled?: unknown }).mfaEnabled;

    if (updateUserDto.password) {
      updateData.password = await bcrypt.hash(updateUserDto.password, 10);
    }

    if (
      targetRole !== UserRole.COORDINATOR &&
      targetRole !== UserRole.ADMIN
    ) {
      updateData.clinicalSubrole = null;
    }

    updateData.crmUf = councils.crmUf;
    updateData.crmNumber = councils.crmNumber;
    updateData.corenUf = councils.corenUf;
    updateData.corenNumber = councils.corenNumber;

    // Atualizar usuário
    const user = await this.prisma.user.update({
      where: { id, tenantId },
      data: updateData as Parameters<typeof this.prisma.user.update>[0]['data'],
      select: userPublicSelect,
    });

    return user;
  }

  async remove(id: string, tenantId: string) {
    // Verificar se usuário existe
    const existingUser = await this.prisma.user.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!existingUser) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Não permitir deletar o último admin do tenant
    if (existingUser.role === UserRole.ADMIN) {
      const adminCount = await this.prisma.user.count({
        where: {
          tenantId,
          role: UserRole.ADMIN,
        },
      });

      if (adminCount === 1) {
        throw new BadRequestException(
          'Cannot delete the last admin user of the tenant'
        );
      }
    }

    await this.prisma.user.delete({
      where: { id, tenantId },
    });

    return { message: 'User deleted successfully' };
  }
}
