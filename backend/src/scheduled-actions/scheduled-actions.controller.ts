import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { ScheduledActionsService } from './scheduled-actions.service';
import { CreateScheduledActionDto } from './dto/create-scheduled-action.dto';
import { QueryScheduledActionsDto } from './dto/query-scheduled-actions.dto';

@Controller('scheduled-actions')
@UseGuards(JwtAuthGuard, TenantGuard)
export class ScheduledActionsController {
  constructor(
    private readonly scheduledActionsService: ScheduledActionsService
  ) {}

  @Get()
  async findAll(@Request() req, @Query() query: QueryScheduledActionsDto) {
    return this.scheduledActionsService.findAll(req.user.tenantId, query);
  }

  @Get('upcoming')
  async findUpcoming(
    @Request() req,
    @Query('patientId') patientId?: string,
    @Query('withinHours') withinHours?: string
  ) {
    return this.scheduledActionsService.findUpcoming(
      req.user.tenantId,
      patientId,
      withinHours ? parseInt(withinHours, 10) : 24
    );
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.scheduledActionsService.findOne(id, req.user.tenantId);
  }

  @Post()
  async create(@Body() dto: CreateScheduledActionDto, @Request() req) {
    return this.scheduledActionsService.create(dto, req.user.tenantId);
  }

  @Patch(':id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancel(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.scheduledActionsService.cancel(id, req.user.tenantId);
  }
}
