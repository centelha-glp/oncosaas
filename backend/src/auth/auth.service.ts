import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RegisterInstitutionDto } from './dto/register-institution.dto';
import { JwtPayload } from './strategies/jwt.strategy';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_TTL_SECONDS = 15 * 60; // 15 minutos
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 dias

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private redisService: RedisService
  ) {}

  // ─── Account lockout helpers ────────────────────────────────────────────────

  private failedKey(email: string) {
    return `auth:failed:${email}`;
  }

  private lockedKey(email: string) {
    return `auth:locked:${email}`;
  }

  private async isLocked(email: string): Promise<boolean> {
    const value = await this.redisService.get(this.lockedKey(email));
    return value !== null;
  }

  private async recordFailedAttempt(email: string): Promise<void> {
    const key = this.failedKey(email);
    const count = await this.redisService.increment(key, LOCKOUT_TTL_SECONDS);
    if (count >= MAX_FAILED_ATTEMPTS) {
      await this.redisService.set(
        this.lockedKey(email),
        '1',
        LOCKOUT_TTL_SECONDS
      );
      this.logger.warn(
        `Account locked after ${MAX_FAILED_ATTEMPTS} failed attempts: ${email}`
      );
    }
  }

  private async clearFailedAttempts(email: string): Promise<void> {
    await this.redisService.del(this.failedKey(email));
    await this.redisService.del(this.lockedKey(email));
  }

  // ─── Core auth logic ────────────────────────────────────────────────────────

  async validateUser(
    email: string,
    password: string,
    tenantId?: string
  ): Promise<any> {
    if (await this.isLocked(email)) {
      throw new ForbiddenException(
        'Conta temporariamente bloqueada por excesso de tentativas. Tente novamente em 15 minutos.'
      );
    }

    const where = tenantId ? { tenantId, email } : { email };

    const user = await this.prisma.user.findFirst({
      where,
      include: { tenant: true },
    });

    if (!user) {
      await this.recordFailedAttempt(email);
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      await this.recordFailedAttempt(email);
      throw new UnauthorizedException('Credenciais inválidas');
    }

    // Verificar MFA
    if (user.mfaEnabled) {
      throw new UnauthorizedException(
        'MFA_REQUIRED: Autenticação de dois fatores não configurada neste sistema.'
      );
    }

    await this.clearFailedAttempts(email);

    const { password: _, ...result } = user;
    return result;
  }

  async login(loginDto: LoginDto, tenantId?: string) {
    const user = await this.validateUser(
      loginDto.email,
      loginDto.password,
      tenantId
    );

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = await this.generateRefreshToken(user.id);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
        tenant: user.tenant,
      },
    };
  }

  async refresh(refreshToken: string) {
    const key = `rt:${refreshToken}`;
    const userId = await this.redisService.get(key);

    if (!userId) {
      throw new UnauthorizedException('Refresh token inválido ou expirado');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { tenant: true },
    });

    if (!user) {
      await this.redisService.del(key);
      throw new UnauthorizedException('Usuário não encontrado');
    }

    // Rotate refresh token (invalidate old, issue new)
    await this.redisService.del(key);
    const newRefreshToken = await this.generateRefreshToken(user.id);

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      role: user.role,
    };

    return {
      access_token: this.jwtService.sign(payload),
      refresh_token: newRefreshToken,
    };
  }

  async logout(refreshToken: string): Promise<void> {
    if (refreshToken) {
      await this.redisService.del(`rt:${refreshToken}`);
    }
  }

  private async generateRefreshToken(userId: string): Promise<string> {
    const token = crypto.randomBytes(40).toString('hex');
    await this.redisService.set(
      `rt:${token}`,
      userId,
      REFRESH_TOKEN_TTL_SECONDS
    );
    return token;
  }

  // ─── Profile ────────────────────────────────────────────────────────────────

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        tenantId: true,
        mfaEnabled: true,
        createdAt: true,
        updatedAt: true,
        tenant: { select: { id: true, name: true } },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Usuário não encontrado');
    }

    return user;
  }

  async updateProfile(
    userId: string,
    data: {
      name?: string;
      email?: string;
      currentPassword?: string;
      newPassword?: string;
    }
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new UnauthorizedException('Usuário não encontrado');
    }

    const updateData: Record<string, unknown> = {};

    if (data.name) {
      updateData.name = data.name;
    }

    if (data.email && data.email !== user.email) {
      const emailTaken = await this.prisma.user.findFirst({
        where: {
          tenantId: user.tenantId,
          email: data.email,
          NOT: { id: userId },
        },
      });
      if (emailTaken) {
        throw new ForbiddenException('Email já está em uso');
      }
      updateData.email = data.email;
    }

    if (data.newPassword) {
      if (!data.currentPassword) {
        throw new UnauthorizedException(
          'Senha atual é obrigatória para alterar a senha'
        );
      }
      const isValid = await bcrypt.compare(data.currentPassword, user.password);
      if (!isValid) {
        throw new UnauthorizedException('Senha atual incorreta');
      }
      updateData.password = await bcrypt.hash(data.newPassword, 10);
    }

    if (Object.keys(updateData).length === 0) {
      return this.getProfile(userId);
    }

    await this.prisma.user.update({ where: { id: userId }, data: updateData });
    return this.getProfile(userId);
  }

  // ─── Password Reset ──────────────────────────────────────────────────────────

  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findFirst({ where: { email } });

    // Always return success to avoid user enumeration
    if (!user) {
      return;
    }

    const token = crypto.randomBytes(32).toString('hex');
    const ttl = 60 * 60; // 1 hora
    await this.redisService.set(`prt:${token}`, user.id, ttl);

    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const resetLink = `${frontendUrl}/reset-password/${token}`;

    // Em produção, enviar por email. Em dev, logar no console.
    this.logger.log(`[DEV] Password reset link for ${email}: ${resetLink}`);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const key = `prt:${token}`;
    const userId = await this.redisService.get(key);

    if (!userId) {
      throw new UnauthorizedException('Token inválido ou expirado');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    // Invalidate token after use
    await this.redisService.del(key);
    // Also clear any account lockout
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      await this.clearFailedAttempts(user.email);
    }
  }

  async register(registerDto: RegisterDto) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: registerDto.tenantId },
    });

    if (!tenant) {
      throw new UnauthorizedException('Tenant não encontrado');
    }

    const existingUser = await this.prisma.user.findFirst({
      where: {
        tenantId: registerDto.tenantId,
        email: registerDto.email,
      },
    });

    if (existingUser) {
      throw new UnauthorizedException('Email já cadastrado neste tenant');
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: registerDto.email,
        password: hashedPassword,
        name: registerDto.name,
        role: registerDto.role,
        tenantId: registerDto.tenantId,
      },
      include: { tenant: true },
    });

    const { password: _, ...result } = user;

    return {
      message: 'Usuário criado com sucesso',
      user: result,
    };
  }

  // ─── Institution Registration ──────────────────────────────────────────────

  async registerInstitution(dto: RegisterInstitutionDto) {
    const existingUser = await this.prisma.user.findFirst({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Este email já está cadastrado no sistema');
    }

    const schemaName = this.generateSchemaName(dto.institutionName);

    const existingTenant = await this.prisma.tenant.findUnique({
      where: { schemaName },
    });

    if (existingTenant) {
      throw new ConflictException(
        'Já existe uma instituição com nome semelhante. Tente um nome diferente.',
      );
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const { tenant, user } = await this.prisma.$transaction(async (tx: PrismaClient) => {
      const newTenant = await tx.tenant.create({
        data: {
          name: dto.institutionName,
          schemaName,
        },
      });

      const newUser = await tx.user.create({
        data: {
          email: dto.email,
          password: hashedPassword,
          name: dto.name,
          role: 'ADMIN',
          tenantId: newTenant.id,
        },
        include: { tenant: true },
      });

      return { tenant: newTenant, user: newUser };
    });

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      tenantId: tenant.id,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = await this.generateRefreshToken(user.id);

    this.logger.log(
      `Institution registered: ${tenant.name} (${tenant.id}), admin: ${user.email}`,
    );

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
        tenant: user.tenant,
      },
    };
  }

  private generateSchemaName(institutionName: string): string {
    const slug = institutionName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const suffix = crypto.randomBytes(2).toString('hex');
    return `${slug}-${suffix}`;
  }
}
