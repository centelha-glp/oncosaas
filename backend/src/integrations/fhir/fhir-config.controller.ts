import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../auth/guards/tenant.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { FHIRConfigService } from './services/fhir-config.service';
import { CreateFHIRConfigDto } from './dto/create-fhir-config.dto';
import { UpdateFHIRConfigDto } from './dto/update-fhir-config.dto';
import { PrismaService } from '@/prisma/prisma.service';
import { Prisma } from '@generated/prisma/client';

@Controller('fhir/config')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles('ADMIN')
export class FHIRConfigController {
  constructor(
    private readonly fhirConfigService: FHIRConfigService,
    private readonly prisma: PrismaService
  ) {}

  /**
   * Obter configuração FHIR do tenant
   */
  @Get()
  async getConfig(@Request() req) {
    const config = await this.fhirConfigService.getConfig(req.user.tenantId);
    if (!config) {
      return { enabled: false, message: 'Integração FHIR não configurada' };
    }
    return config;
  }

  /**
   * Criar ou atualizar configuração FHIR
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createOrUpdate(@Body() createDto: CreateFHIRConfigDto, @Request() req) {
    const tenantId = req.user.tenantId;

    // Verificar se já existe
    const existing = await this.prisma.fHIRIntegrationConfig.findUnique({
      where: { tenantId },
    });

    if (existing) {
      // Atualizar
      const updated = await this.prisma.fHIRIntegrationConfig.update({
        where: { tenantId },
        data: {
          enabled: createDto.enabled ?? existing.enabled,
          baseUrl: createDto.baseUrl,
          authType: createDto.authType,
          authConfig: createDto.authConfig as any,
          syncDirection: createDto.syncDirection ?? existing.syncDirection,
          syncFrequency: createDto.syncFrequency ?? existing.syncFrequency,
          maxRetries: createDto.maxRetries ?? existing.maxRetries,
          initialDelay: createDto.initialDelay ?? existing.initialDelay,
          maxDelay: createDto.maxDelay ?? existing.maxDelay,
          backoffMultiplier: createDto.backoffMultiplier
            ? new Prisma.Decimal(createDto.backoffMultiplier)
            : existing.backoffMultiplier,
        },
      });

      // Limpar cache
      this.fhirConfigService.clearCache(tenantId);

      return {
        message: 'Configuração FHIR atualizada com sucesso',
        config: updated,
      };
    } else {
      // Criar
      const created = await this.prisma.fHIRIntegrationConfig.create({
        data: {
          tenantId,
          enabled: createDto.enabled ?? false,
          baseUrl: createDto.baseUrl,
          authType: createDto.authType,
          authConfig: createDto.authConfig as any,
          syncDirection: createDto.syncDirection ?? 'bidirectional',
          syncFrequency: createDto.syncFrequency ?? 'hourly',
          maxRetries: createDto.maxRetries ?? 3,
          initialDelay: createDto.initialDelay ?? 1000,
          maxDelay: createDto.maxDelay ?? 30000,
          backoffMultiplier: new Prisma.Decimal(
            createDto.backoffMultiplier ?? 2.0
          ),
        },
      });

      return {
        message: 'Configuração FHIR criada com sucesso',
        config: created,
      };
    }
  }

  /**
   * Atualizar configuração FHIR
   */
  @Put()
  @HttpCode(HttpStatus.OK)
  async update(@Body() updateDto: UpdateFHIRConfigDto, @Request() req) {
    const tenantId = req.user.tenantId;

    const existing = await this.prisma.fHIRIntegrationConfig.findUnique({
      where: { tenantId },
    });

    if (!existing) {
      throw new Error('Configuração FHIR não encontrada');
    }

    const updateData: any = {};
    if (updateDto.baseUrl !== undefined) {
      updateData.baseUrl = updateDto.baseUrl;
    }
    if (updateDto.authType !== undefined) {
      updateData.authType = updateDto.authType;
    }
    if (updateDto.authConfig !== undefined) {
      updateData.authConfig = updateDto.authConfig as any;
    }
    if (updateDto.enabled !== undefined) {
      updateData.enabled = updateDto.enabled;
    }
    if (updateDto.syncDirection !== undefined) {
      updateData.syncDirection = updateDto.syncDirection;
    }
    if (updateDto.syncFrequency !== undefined) {
      updateData.syncFrequency = updateDto.syncFrequency;
    }
    if (updateDto.maxRetries !== undefined) {
      updateData.maxRetries = updateDto.maxRetries;
    }
    if (updateDto.initialDelay !== undefined) {
      updateData.initialDelay = updateDto.initialDelay;
    }
    if (updateDto.maxDelay !== undefined) {
      updateData.maxDelay = updateDto.maxDelay;
    }
    if (updateDto.backoffMultiplier !== undefined) {
      updateData.backoffMultiplier = new Prisma.Decimal(
        updateDto.backoffMultiplier
      );
    }

    const updated = await this.prisma.fHIRIntegrationConfig.update({
      where: { tenantId },
      data: updateData,
    });

    // Limpar cache
    this.fhirConfigService.clearCache(tenantId);

    return {
      message: 'Configuração FHIR atualizada com sucesso',
      config: updated,
    };
  }
}
