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
import { Public } from '../auth/decorators/public.decorator';
import { ConfigService } from '@nestjs/config';
import { WhatsAppConnectionsService } from './whatsapp-connections.service';
import { CreateWhatsAppConnectionDto } from './dto/create-whatsapp-connection.dto';
import { UpdateWhatsAppConnectionDto } from './dto/update-whatsapp-connection.dto';
import { ProcessEmbeddedSignupDto } from './dto/process-embedded-signup.dto';
import { Response } from 'express';

@Controller('whatsapp-connections')
export class WhatsAppConnectionsController {
  private readonly logger = new Logger(WhatsAppConnectionsController.name);

  constructor(
    private readonly whatsappConnectionsService: WhatsAppConnectionsService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard, TenantGuard)
  async findAll(@Request() req) {
    return this.whatsappConnectionsService.findAll(req.user.tenantId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, TenantGuard)
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.whatsappConnectionsService.findOne(id, req.user.tenantId);
  }

  @Post()
  @UseGuards(JwtAuthGuard, TenantGuard)
  async create(@Body() createDto: CreateWhatsAppConnectionDto, @Request() req) {
    return this.whatsappConnectionsService.createManualConnection(
      createDto,
      req.user.tenantId
    );
  }

  @Post('oauth/initiate')
  @UseGuards(JwtAuthGuard, TenantGuard)
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
  @UseGuards(JwtAuthGuard, TenantGuard)
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
  @UseGuards(JwtAuthGuard, TenantGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    await this.whatsappConnectionsService.remove(id, req.user.tenantId);
  }

  @Post(':id/test')
  @UseGuards(JwtAuthGuard, TenantGuard)
  async testConnection(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.whatsappConnectionsService.testConnection(
      id,
      req.user.tenantId
    );
  }

  @Post(':id/set-default')
  @UseGuards(JwtAuthGuard, TenantGuard)
  async setDefault(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.whatsappConnectionsService.setDefault(id, req.user.tenantId);
  }

  @Post(':id/run-meta-tests')
  @UseGuards(JwtAuthGuard, TenantGuard)
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
  @UseGuards(JwtAuthGuard, TenantGuard)
  async processEmbeddedSignup(
    @Body() dto: ProcessEmbeddedSignupDto,
    @Request() req
  ) {
    return this.whatsappConnectionsService.processEmbeddedSignup(
      dto.code,
      req.user.tenantId,
      dto.redirect_uri
    );
  }
}
