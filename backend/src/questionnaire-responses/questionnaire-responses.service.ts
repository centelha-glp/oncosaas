import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PriorityRecalculationService } from '../oncology-navigation/priority-recalculation.service';
import { CreateQuestionnaireResponseDto } from './dto/create-questionnaire-response.dto';
import { QuestionnaireResponse } from '@prisma/client';

@Injectable()
export class QuestionnaireResponsesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly priorityRecalculationService: PriorityRecalculationService
  ) {}

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

    // Criar resposta
    const response = await this.prisma.questionnaireResponse.create({
      data: {
        tenantId,
        patientId: createDto.patientId,
        questionnaireId: createDto.questionnaireId,
        responses: createDto.responses,
        messageId: createDto.messageId,
        appliedBy: createDto.appliedBy || 'AGENT',
      },
    });

    this.priorityRecalculationService.triggerRecalculation(
      createDto.patientId,
      tenantId
    );

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
