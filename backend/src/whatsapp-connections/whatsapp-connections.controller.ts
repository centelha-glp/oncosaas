import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Query,
  Res,
  Logger,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { UserRole } from '@generated/prisma/client';
import { ConfigService } from '@nestjs/config';
import { WhatsAppConnectionsService } from './whatsapp-connections.service';
import { CreateWhatsAppConnectionDto } from './dto/create-whatsapp-connection.dto';
import { UpdateWhatsAppConnectionDto } from './dto/update-whatsapp-connection.dto';
import { ProcessEmbeddedSignupDto } from './dto/process-embedded-signup.dto';
import { Response } from 'express';

@Controller('whatsapp-connections')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles(
  UserRole.ADMIN,
  UserRole.ONCOLOGIST,
  UserRole.DOCTOR,
  UserRole.NURSE_CHIEF,
  UserRole.NURSE,
  UserRole.COORDINATOR,
  UserRole.SECRETARY
)
export class WhatsAppConnectionsController {
  private readonly logger = new Logger(WhatsAppConnectionsController.name);

  constructor(
    private readonly whatsappConnectionsService: WhatsAppConnectionsService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  async findAll(@Request() req) {
    return this.whatsappConnectionsService.findAll(req.user.tenantId);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.whatsappConnectionsService.findOne(id, req.user.tenantId);
  }

  @Post()
  async create(@Body() createDto: CreateWhatsAppConnectionDto, @Request() req) {
    return this.whatsappConnectionsService.createManualConnection(
      createDto,
      req.user.tenantId
    );
  }

  @Post('oauth/initiate')
  async initiateOAuth(@Request() req) {
    return this.whatsappConnectionsService.initiateOAuthFlow(req.user.tenantId);
  }

  @Get('oauth/callback')
  @Public()
  async handleOAuthCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Query('error_description') errorDescription: string,
    @Res() res: Response
  ) {
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    if (error) {
      return res.redirect(
        `${frontendUrl}/integrations?error=${encodeURIComponent(
          errorDescription || error
        )}`
      );
    }

    if (!code || !state) {
      return res.redirect(
        `${frontendUrl}/integrations?error=${encodeURIComponent(
          'Missing code or state parameter'
        )}`
      );
    }

    try {
      const result = await this.whatsappConnectionsService.handleOAuthCallback(
        code,
        state
      );
      return res.redirect(result.redirectUrl);
    } catch (error: any) {
      // NestJS exceptions have a 'message' property
      const errorMessage =
        error.message || error.response?.data?.message || 'Unknown error';
      this.logger.error('OAuth callback error:', error);
      return res.redirect(
        `${frontendUrl}/integrations?error=${encodeURIComponent(errorMessage)}`
      );
    }
  }

  @Put(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateWhatsAppConnectionDto,
    @Request() req
  ) {
    return this.whatsappConnectionsService.update(
      id,
      updateDto,
      req.user.tenantId
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    await this.whatsappConnectionsService.remove(id, req.user.tenantId);
  }

  @Post(':id/test')
  async testConnection(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.whatsappConnectionsService.testConnection(
      id,
      req.user.tenantId
    );
  }

  @Post(':id/set-default')
  async setDefault(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.whatsappConnectionsService.setDefault(id, req.user.tenantId);
  }

  @Post(':id/run-meta-tests')
  async runMetaAppReviewTests(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req
  ) {
    return this.whatsappConnectionsService.runMetaAppReviewTests(
      id,
      req.user.tenantId
    );
  }

  @Post('embedded-signup/process')
  async processEmbeddedSignup(
    @Body() dto: ProcessEmbeddedSignupDto,
    @Request() req
  ) {
    return this.whatsappConnectionsService.processEmbeddedSignup(
      dto.code,
      req.user.tenantId,
      dto.redirect_uri,
      dto.waba_id,
      dto.phone_number_id
    );
  }
}
