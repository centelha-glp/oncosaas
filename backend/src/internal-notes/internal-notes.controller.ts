import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import { InternalNotesService } from './internal-notes.service';
import { CreateInternalNoteDto } from './dto/create-internal-note.dto';
import { UpdateInternalNoteDto } from './dto/update-internal-note.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@generated/prisma/client';

@Controller('internal-notes')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class InternalNotesController {
  constructor(private readonly internalNotesService: InternalNotesService) {}

  @Post()
  @Roles(
    UserRole.NURSE,
    UserRole.NURSE_CHIEF,
    UserRole.COORDINATOR,
    UserRole.ONCOLOGIST,
    UserRole.ADMIN
  )
  async create(
    @Body() createInternalNoteDto: CreateInternalNoteDto,
    @Request() req
  ) {
    return this.internalNotesService.create(
      createInternalNoteDto,
      req.user.tenantId,
      req.user.id
    );
  }

  @Get()
  @Roles(
    UserRole.NURSE,
    UserRole.NURSE_CHIEF,
    UserRole.COORDINATOR,
    UserRole.ONCOLOGIST,
    UserRole.ADMIN
  )
  async findAll(@Request() req, @Query('patientId') patientId?: string) {
    return this.internalNotesService.findAll(req.user.tenantId, patientId);
  }

  @Get(':id')
  @Roles(
    UserRole.NURSE,
    UserRole.NURSE_CHIEF,
    UserRole.COORDINATOR,
    UserRole.ONCOLOGIST,
    UserRole.ADMIN
  )
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.internalNotesService.findOne(id, req.user.tenantId);
  }

  @Patch(':id')
  @Roles(
    UserRole.NURSE,
    UserRole.NURSE_CHIEF,
    UserRole.COORDINATOR,
    UserRole.ONCOLOGIST,
    UserRole.ADMIN
  )
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateInternalNoteDto: UpdateInternalNoteDto,
    @Request() req
  ) {
    return this.internalNotesService.update(
      id,
      req.user.tenantId,
      updateInternalNoteDto,
      req.user.id,
      req.user.role
    );
  }

  @Delete(':id')
  @Roles(
    UserRole.NURSE,
    UserRole.NURSE_CHIEF,
    UserRole.COORDINATOR,
    UserRole.ONCOLOGIST,
    UserRole.ADMIN
  )
  async remove(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.internalNotesService.remove(
      id,
      req.user.tenantId,
      req.user.id,
      req.user.role
    );
  }
}
