import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { PriorityRecalculationService } from '../oncology-navigation/priority-recalculation.service';
import { CreateQuestionnaireResponseDto } from './dto/create-questionnaire-response.dto';
import { QuestionnaireResponse } from '@generated/prisma/client';
import { PROTOCOL_SCHEDULE_REEVALUATION_EVENT } from '../agent/protocol-evaluation.events';

@Injectable()
export class QuestionnaireResponsesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly priorityRecalculationService: PriorityRecalculationService,
    @Optional() private readonly eventEmitter?: EventEmitter2
  ) {}

  /** Valida etapa do paciente/tenant quando informada (qualquer stepKey). */
  private async assertNavigationStepForPatient(
    navigationStepId: string | undefined,
    patientId: string,
    tenantId: string
  ): Promise<void> {
    if (!navigationStepId) {
      return;
    }
    const step = await this.prisma.navigationStep.findFirst({
      where: { id: navigationStepId, tenantId, patientId },
      select: { id: true },
    });
    if (!step) {
      throw new NotFoundException(
        'Etapa de navegação não encontrada para este paciente'
      );
    }
  }

  async create(
    createDto: CreateQuestionnaireResponseDto,
    tenantId: string
  ): Promise<QuestionnaireResponse> {
    // Verificar se paciente existe e pertence ao tenant
    const patient = await this.prisma.patient.findFirst({
      where: {
        id: createDto.patientId,
        tenantId,
      },
    });

    if (!patient) {
      throw new NotFoundException(
        `Patient with ID ${createDto.patientId} not found`
      );
    }

    // Verificar se questionário existe e pertence ao tenant
    const questionnaire = await this.prisma.questionnaire.findFirst({
      where: {
        id: createDto.questionnaireId,
        tenantId,
      },
    });

    if (!questionnaire) {
      throw new NotFoundException(
        `Questionnaire with ID ${createDto.questionnaireId} not found`
      );
    }

    await this.assertNavigationStepForPatient(
      createDto.navigationStepId,
      createDto.patientId,
      tenantId
    );

    // Criar resposta
    const response = await this.prisma.questionnaireResponse.create({
      data: {
        tenantId,
        patientId: createDto.patientId,
        questionnaireId: createDto.questionnaireId,
        responses: createDto.responses,
        messageId: createDto.messageId,
        navigationStepId: createDto.navigationStepId,
        appliedBy: createDto.appliedBy || 'AGENT',
      },
    });

    this.priorityRecalculationService.triggerRecalculation(
      createDto.patientId,
      tenantId
    );

    this.eventEmitter?.emit(PROTOCOL_SCHEDULE_REEVALUATION_EVENT, {
      patientId: createDto.patientId,
      tenantId,
      reason: 'questionnaire_response_created',
    });

    return response;
  }

  async findAll(
    tenantId: string,
    patientId?: string,
    questionnaireId?: string,
    options?: { limit?: number; offset?: number }
  ): Promise<QuestionnaireResponse[]> {
    // Limite padrão de 100 registros para evitar problemas de performance
    const limit =
      options?.limit && options.limit > 0 ? Math.min(options.limit, 500) : 100;
    const offset = options?.offset && options.offset > 0 ? options.offset : 0;

    return this.prisma.questionnaireResponse.findMany({
      where: {
        tenantId,
        ...(patientId && { patientId }),
        ...(questionnaireId && { questionnaireId }),
      },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
          },
        },
        questionnaire: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        navigationStep: {
          select: {
            id: true,
            stepKey: true,
            stepName: true,
            journeyStage: true,
          },
        },
      },
      orderBy: {
        completedAt: 'desc',
      },
      take: limit,
      skip: offset,
    });
  }

  async findOne(id: string, tenantId: string): Promise<QuestionnaireResponse> {
    const response = await this.prisma.questionnaireResponse.findFirst({
      where: {
        id,
        tenantId,
      },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
          },
        },
        questionnaire: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        navigationStep: {
          select: {
            id: true,
            stepKey: true,
            stepName: true,
            journeyStage: true,
          },
        },
      },
    });

    if (!response) {
      throw new NotFoundException(
        `QuestionnaireResponse with ID ${id} not found`
      );
    }

    return response;
  }
}
