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
import { UserRole } from '@generated/prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string) {
    return this.prisma.user.findMany({
      where: { tenantId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        mfaEnabled: true,
        createdAt: true,
        updatedAt: true,
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, tenantId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id,
        tenantId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        mfaEnabled: true,
        createdAt: true,
        updatedAt: true,
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
      },
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

    // Criar usuário
    const user = await this.prisma.user.create({
      data: {
        ...createUserDto,
        password: hashedPassword,
        tenantId,
        mfaEnabled: createUserDto.mfaEnabled || false,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        mfaEnabled: true,
        createdAt: true,
        updatedAt: true,
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
      },
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

    // Hash da senha se fornecida
    const updateData: any = { ...updateUserDto };
    if (updateUserDto.password) {
      updateData.password = await bcrypt.hash(updateUserDto.password, 10);
    }

    // Atualizar usuário
    const user = await this.prisma.user.update({
      where: { id, tenantId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        mfaEnabled: true,
        createdAt: true,
        updatedAt: true,
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
      },
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
