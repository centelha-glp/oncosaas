import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { AgentService } from './agent.service';
import { InternalConsultationAvailabilityDto } from './dto/internal-consultation-availability.dto';
import { InternalConsultationProfessionalsDto } from './dto/internal-consultation-professionals.dto';
import { BackendServiceTokenGuard } from './guards/backend-service-token.guard';

type InternalTenantRequest = ExpressRequest & {
  internalTenantId?: string;
};

@Controller('agent/internal')
@Public()
@UseGuards(BackendServiceTokenGuard)
export class AgentInternalController {
  constructor(private readonly agentService: AgentService) {}

  @Post('consultation-availability')
  async getConsultationAvailability(
    @Body() dto: InternalConsultationAvailabilityDto,
    @Request() req: InternalTenantRequest
  ) {
    if (!req.internalTenantId) {
      throw new BadRequestException('Tenant interno não validado');
    }

    return this.agentService.getInternalConsultationAvailability(
      req.internalTenantId,
      dto as unknown as Record<string, unknown>
    );
  }

  @Post('consultation-professionals')
  async listConsultationProfessionals(
    @Body() dto: InternalConsultationProfessionalsDto,
    @Request() req: InternalTenantRequest
  ) {
    if (!req.internalTenantId) {
      throw new BadRequestException('Tenant interno não validado');
    }

    return this.agentService.getInternalConsultationProfessionals(
      req.internalTenantId,
      dto as unknown as Record<string, unknown>
    );
  }
}
