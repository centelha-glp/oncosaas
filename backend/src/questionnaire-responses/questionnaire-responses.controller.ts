import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { QuestionnaireResponsesService } from './questionnaire-responses.service';
import { CreateQuestionnaireResponseDto } from './dto/create-questionnaire-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@generated/prisma/client';

@Controller('questionnaire-responses')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class QuestionnaireResponsesController {
  constructor(
    private readonly questionnaireResponsesService: QuestionnaireResponsesService
  ) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.COORDINATOR) // Sistema/AI pode criar respostas
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() createDto: CreateQuestionnaireResponseDto,
    @CurrentUser() user: any
  ) {
    return this.questionnaireResponsesService.create(createDto, user.tenantId);
  }

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
    @Query('questionnaireId') questionnaireId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    return this.questionnaireResponsesService.findAll(
      user.tenantId,
      patientId,
      questionnaireId,
      {
        limit: limit ? parseInt(limit, 10) : undefined,
        offset: offset ? parseInt(offset, 10) : undefined,
      }
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
    return this.questionnaireResponsesService.findOne(id, user.tenantId);
  }
}
