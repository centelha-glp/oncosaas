import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@generated/prisma/client';

@Controller('messages')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  @Roles(
    UserRole.ADMIN,
    UserRole.ONCOLOGIST,
    UserRole.NURSE,
    UserRole.COORDINATOR
  )
  findAll(
    @CurrentUser() user: any,
    @Query('patientId') patientId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    return this.messagesService.findAll(
      user.tenantId,
      patientId,
      limit ? parseInt(limit, 10) : undefined,
      offset ? parseInt(offset, 10) : undefined
    );
  }

  @Get('unassumed/count')
  @Roles(
    UserRole.ADMIN,
    UserRole.ONCOLOGIST,
    UserRole.NURSE,
    UserRole.COORDINATOR
  )
  async getUnassumedCount(@CurrentUser() user: any) {
    const count = await this.messagesService.getUnassumedCount(user.tenantId);
    return { count };
  }

  @Get('unassumed/patient-ids')
  @Roles(
    UserRole.ADMIN,
    UserRole.ONCOLOGIST,
    UserRole.NURSE,
    UserRole.COORDINATOR
  )
  async getUnassumedPatientIds(@CurrentUser() user: any) {
    const patientIds =
      await this.messagesService.getUnassumedPatientIds(user.tenantId);
    return { patientIds };
  }

  @Get('conversation/:patientId')
  @Roles(
    UserRole.ADMIN,
    UserRole.ONCOLOGIST,
    UserRole.NURSE,
    UserRole.COORDINATOR
  )
  getConversation(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @CurrentUser() user: any,
    @Query('limit') limit?: string
  ) {
    return this.messagesService.getConversation(
      patientId,
      user.tenantId,
      limit ? parseInt(limit, 10) : 50
    );
  }

  @Get(':id')
  @Roles(
    UserRole.ADMIN,
    UserRole.ONCOLOGIST,
    UserRole.NURSE,
    UserRole.COORDINATOR
  )
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.messagesService.findOne(id, user.tenantId);
  }

  @Post()
  @Roles(
    UserRole.ADMIN,
    UserRole.COORDINATOR,
    UserRole.NURSE,
    UserRole.ONCOLOGIST
  ) // Permite enfermeiros e oncologistas enviarem mensagens quando assumem conversa
  create(@Body() createMessageDto: CreateMessageDto, @CurrentUser() user: any) {
    // Se processedBy é NURSING, adicionar assumedBy automaticamente
    if (
      createMessageDto.processedBy === 'NURSING' &&
      !createMessageDto.assumedBy
    ) {
      createMessageDto.assumedBy = user.id;
    }
    return this.messagesService.create(createMessageDto, user.tenantId);
  }

  @Patch(':id')
  @Roles(
    UserRole.ADMIN,
    UserRole.ONCOLOGIST,
    UserRole.NURSE,
    UserRole.COORDINATOR
  )
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateMessageDto: UpdateMessageDto,
    @CurrentUser() user: any
  ) {
    return this.messagesService.update(id, updateMessageDto, user.tenantId);
  }

  @Patch('patient/:patientId/assume')
  @Roles(
    UserRole.ADMIN,
    UserRole.ONCOLOGIST,
    UserRole.NURSE,
    UserRole.COORDINATOR
  )
  assumePatientConversation(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @CurrentUser() user: any
  ) {
    return this.messagesService.assumeAllForPatient(
      patientId,
      user.tenantId,
      user.id
    );
  }

  @Patch(':id/assume')
  @Roles(
    UserRole.ADMIN,
    UserRole.ONCOLOGIST,
    UserRole.NURSE,
    UserRole.COORDINATOR
  )
  assumeConversation(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any
  ) {
    return this.messagesService.assumeConversation(id, user.tenantId, user.id);
  }
}
