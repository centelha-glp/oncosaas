import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNavigationStepDto } from './dto/create-navigation-step.dto';
import { UpdateNavigationStepDto } from './dto/update-navigation-step.dto';
import {
  JourneyStage,
  NavigationStep,
  NavigationStepStatus,
  PatientStatus,
  Prisma,
} from '@generated/prisma/client';
import { AlertsService } from '../alerts/alerts.service';
import { AlertType, AlertSeverity } from '@generated/prisma/client';

/** Configuração de uma etapa de navegação com dependência relativa */
export interface StepConfig {
  journeyStage: JourneyStage;
  stepKey: string;
  stepName: string;
  stepDescription: string;
  isRequired: boolean;
  dependsOnStepKey: string | null;
  relativeDaysMin: number | null;
  relativeDaysMax: number | null;
  stepOrder: number;
}

/** Ordem dos estágios da jornada (para comparar "fase atual" vs "fase futura") */
const JOURNEY_STAGE_ORDER: Record<JourneyStage, number> = {
  [JourneyStage.SCREENING]: 0,
  [JourneyStage.DIAGNOSIS]: 1,
  [JourneyStage.TREATMENT]: 2,
  [JourneyStage.FOLLOW_UP]: 3,
  [JourneyStage.PALLIATIVE]: 4,
};

@Injectable()
export class OncologyNavigationService {
  private readonly logger = new Logger(OncologyNavigationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly alertsService: AlertsService
  ) {}

  /**
   * Obtém todas as etapas de navegação de um paciente
   * Se não houver etapas para todos os estágios da jornada, cria automaticamente as faltantes
   */
  async getPatientNavigationSteps(
    patientId: string,
    tenantId: string
  ): Promise<NavigationStep[]> {
    const steps = await this.prisma.navigationStep.findMany({
      where: {
        patientId,
        tenantId,
      },
      orderBy: [
        { journeyStage: 'asc' },
        { stepOrder: 'asc' } as any,
        { createdAt: 'asc' },
      ],
    });

    return steps;
  }

  /**
   * Obtém etapas por etapa da jornada
   */
  async getStepsByJourneyStage(
    patientId: string,
    tenantId: string,
    journeyStage: JourneyStage
  ): Promise<NavigationStep[]> {
    return this.prisma.navigationStep.findMany({
      where: {
        patientId,
        tenantId,
        journeyStage,
      },
      orderBy: [
        { isRequired: 'desc' },
        { expectedDate: 'asc' },
        { createdAt: 'asc' },
      ],
    });
  }

  /**
   * Obtém uma etapa específica por ID
   */
  async getStepById(stepId: string, tenantId: string): Promise<NavigationStep> {
    const step = await this.prisma.navigationStep.findFirst({
      where: {
        id: stepId,
        tenantId,
      },
    });

    if (!step) {
      throw new NotFoundException('Navigation step not found');
    }

    return step;
  }

  /**
   * Cria uma nova etapa de navegação
   */
  async createStep(
    createDto: CreateNavigationStepDto,
    tenantId: string
  ): Promise<NavigationStep> {
    // Verificar se paciente existe
    const patient = await this.prisma.patient.findFirst({
      where: {
        id: createDto.patientId,
        tenantId,
      },
    });

    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    // Obter journey do paciente
    const journey = await this.prisma.patientJourney.findUnique({
      where: { patientId: createDto.patientId },
    });

    const step = await this.prisma.navigationStep.create({
      data: {
        tenantId,
        patientId: createDto.patientId,
        journeyId: journey?.id,
        diagnosisId: createDto.diagnosisId ?? undefined,
        cancerType: createDto.cancerType,
        journeyStage: createDto.journeyStage,
        stepKey: createDto.stepKey,
        stepName: createDto.stepName,
        stepDescription: createDto.stepDescription ?? null,
        isRequired: createDto.isRequired ?? true,
        expectedDate: createDto.expectedDate ? new Date(createDto.expectedDate) : null,
        dueDate: createDto.dueDate ? new Date(createDto.dueDate) : null,
        metadata: createDto.metadata ?? undefined,
        notes: createDto.notes ?? null,
        status: NavigationStepStatus.PENDING,
        isCompleted: false,
      },
    });

    // Verificar se a etapa já está atrasada ao ser criada
    if (step.dueDate && !step.isCompleted) {
      const stepDueDate = new Date(step.dueDate);
      stepDueDate.setHours(0, 0, 0, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (stepDueDate < today) {
        await this.checkAndCreateAlertForStep(step, tenantId);
      }
    }

    return step;
  }

  /**
   * Atualiza uma etapa de navegação
   */
  async updateStep(
    stepId: string,
    updateDto: UpdateNavigationStepDto,
    tenantId: string
  ): Promise<NavigationStep> {
    const existingStep = await this.prisma.navigationStep.findFirst({
      where: {
        id: stepId,
        tenantId,
      },
    });

    if (!existingStep) {
      throw new NotFoundException('Navigation step not found');
    }

    const updateData: Prisma.NavigationStepUpdateInput = { ...updateDto };

    // Se marcando como completa, atualizar campos relacionados
    if (updateDto.isCompleted !== undefined) {
      if (updateDto.isCompleted && !existingStep.isCompleted) {
        // Marcando como concluída
        updateData.status = NavigationStepStatus.COMPLETED;
        updateData.completedAt = updateDto.completedAt || new Date();
        // Se actualDate foi fornecido no DTO, usar ele; senão usar completedAt ou new Date()
        if (updateDto.actualDate) {
          updateData.actualDate = new Date(updateDto.actualDate);
        } else if (!existingStep.actualDate) {
          updateData.actualDate = updateData.completedAt || new Date();
        }
        // Se completedBy não foi fornecido, manter o existente ou usar o do updateDto
        if (!updateData.completedBy && updateDto.completedBy) {
          updateData.completedBy = updateDto.completedBy;
        }
      } else if (!updateDto.isCompleted && existingStep.isCompleted) {
        // Desmarcando como concluída
        updateData.status = NavigationStepStatus.PENDING;
        updateData.completedAt = null;
        // Só limpar actualDate se não foi fornecido explicitamente no DTO
        if (updateDto.actualDate === undefined) {
          updateData.actualDate = null;
        }
        updateData.completedBy = null;
      }
    }

    // Se actualDate foi fornecido explicitamente, usar ele (mesmo que não esteja marcando como completa)
    if (updateDto.actualDate !== undefined) {
      updateData.actualDate = updateDto.actualDate
        ? new Date(updateDto.actualDate)
        : null;
    }

    // Se dueDate foi fornecido, atualizar
    if (updateDto.dueDate !== undefined) {
      updateData.dueDate = updateDto.dueDate
        ? new Date(updateDto.dueDate)
        : null;
    }

    // Se mudando status para OVERDUE (apenas se não estiver marcando/desmarcando como completa)
    if (
      updateDto.status === NavigationStepStatus.OVERDUE &&
      updateDto.isCompleted === undefined
    ) {
      updateData.status = NavigationStepStatus.OVERDUE;
    }

    if (updateDto.journeyStage !== undefined) {
      if (updateDto.journeyStage === existingStep.journeyStage) {
        delete (updateData as { journeyStage?: JourneyStage }).journeyStage;
      } else {
        const nextOrder = await this.getNextStepOrderForStage(
          existingStep.patientId,
          tenantId,
          updateDto.journeyStage
        );
        updateData.journeyStage = updateDto.journeyStage;
        updateData.stepOrder = nextOrder;
        updateData.dependsOnStepKey = null;
        updateData.relativeDaysMin = null;
        updateData.relativeDaysMax = null;
        updateData.expectedDate = null;
        updateData.dueDate = null;
      }
    }

    const updatedStep = await this.prisma.navigationStep.update({
      where: { id: stepId, tenantId },
      data: updateData,
    });

    // Se a etapa não foi marcada como completa e tem dueDate, verificar se está atrasada
    // Verificar sempre que dueDate foi atualizada ou quando não acabamos de marcar como concluída
    if (
      !updatedStep.isCompleted &&
      updatedStep.dueDate &&
      (updateDto.isCompleted !== true || updateDto.dueDate !== undefined)
    ) {
      const stepDueDate = new Date(updatedStep.dueDate);
      stepDueDate.setHours(0, 0, 0, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (stepDueDate < today) {
        // Atualizar status para OVERDUE se necessário (mas não se acabamos de marcar como COMPLETED)
        if (
          updatedStep.status !== NavigationStepStatus.OVERDUE &&
          updateDto.isCompleted !== true
        ) {
          await this.prisma.navigationStep.update({
            where: { id: stepId, tenantId },
            data: { status: NavigationStepStatus.OVERDUE },
          });
          updatedStep.status = NavigationStepStatus.OVERDUE;
        }
        // Verificar e criar alerta se necessário
        await this.checkAndCreateAlertForStep(updatedStep, tenantId);
      } else {
        // Se não está mais atrasada e estava OVERDUE, voltar para PENDING
        if (
          updatedStep.status === NavigationStepStatus.OVERDUE &&
          updateDto.isCompleted !== true
        ) {
          await this.prisma.navigationStep.update({
            where: { id: stepId, tenantId },
            data: { status: NavigationStepStatus.PENDING },
          });
          updatedStep.status = NavigationStepStatus.PENDING;
        }
      }
    }

    // Cascade de prazos e bifurcação ao completar
    if (updateDto.isCompleted && !existingStep.isCompleted) {
      // Criar steps da próxima fase se ainda não existirem (ex: conclusão de SCREENING → cria DIAGNOSIS)
      await this.maybeCreateNextStageSteps(updatedStep, tenantId);
      await this.cascadeDependentStepDates(updatedStep, tenantId);
      await this.applyBladderCancerBifurcation(updatedStep, tenantId);
      await this.checkLegalCheckpoints(updatedStep, tenantId);
    }

    // Resetar prazos de dependentes ao desmarcar conclusão
    if (updateDto.isCompleted === false && existingStep.isCompleted) {
      await this.resetDependentStepDates(updatedStep, tenantId);
    }

    return updatedStep;
  }

  /**
   * Remove uma etapa de navegação (somente se pertencer ao tenant).
   */
  async deleteStep(stepId: string, tenantId: string): Promise<void> {
    const existing = await this.prisma.navigationStep.findFirst({
      where: { id: stepId, tenantId },
    });
    if (!existing) {
      throw new NotFoundException('Navigation step not found');
    }
    await this.prisma.navigationStep.delete({
      where: { id: stepId, tenantId },
    });
  }

  /**
   * Indica se o estágio da etapa é posterior ao estágio atual do paciente.
   * Etapas de fases futuras não recebem dueDate/expectedDate para não aparecerem como "próximas".
   */
  private isFutureStage(
    stepStage: JourneyStage,
    currentStage: JourneyStage
  ): boolean {
    const order = JOURNEY_STAGE_ORDER[currentStage] ?? 0;
    const stepOrder = JOURNEY_STAGE_ORDER[stepStage] ?? 0;
    return stepOrder > order;
  }

  /**
   * Remove prazos (dueDate/expectedDate) de etapas que estão em fases futuras em relação
   * ao currentStage do paciente. Corrige dados já existentes (ex.: criados antes da regra
   * de não atribuir prazo a etapas futuras).
   */
  async clearFuturePhaseStepDates(
    patientId: string,
    tenantId: string
  ): Promise<number> {
    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, tenantId },
      select: { currentStage: true },
    });
    if (!patient?.currentStage) {return 0;}

    const currentStage = patient.currentStage as JourneyStage;
    const steps = await this.prisma.navigationStep.findMany({
      where: { patientId, tenantId, isCompleted: false },
      select: { id: true, journeyStage: true, dueDate: true, expectedDate: true },
    });

    const toClear = steps.filter((s) =>
      this.isFutureStage(s.journeyStage as JourneyStage, currentStage)
    );
    if (toClear.length === 0) {return 0;}

    await this.prisma.navigationStep.updateMany({
      where: {
        id: { in: toClear.map((s) => s.id) },
        tenantId,
      },
      data: { dueDate: null, expectedDate: null },
    });
    this.logger.log(
      `Limpeza de prazos: ${toClear.length} etapa(s) de fases futuras para paciente ${patientId}`
    );
    return toClear.length;
  }

  /**
   * Inicializa etapas de navegação para um paciente baseado no tipo de câncer e etapa atual.
   * Remove etapas existentes e cria novas; prazos (dueDate/expectedDate) são atribuídos
   * apenas às etapas da fase atual — etapas de fases futuras ficam com prazo null.
   * Se diagnosisId for informado, as etapas ficam vinculadas a esse diagnóstico e serão
   * excluídas em cascata quando o diagnóstico for excluído.
   */
  async initializeNavigationSteps(
    patientId: string,
    tenantId: string,
    cancerType: string,
    currentStage: JourneyStage,
    diagnosisId?: string
  ): Promise<void> {
    // Garantir que currentStage não seja null
    const stage = currentStage || JourneyStage.SCREENING;

    // Buscar paciente para verificar status
    const patient = await this.prisma.patient.findFirst({
      where: {
        id: patientId,
        tenantId,
      },
      select: {
        status: true,
      },
    });

    if (!patient) {
      throw new NotFoundException(`Patient with ID ${patientId} not found`);
    }

    this.logger.log(
      `Inicializando etapas para paciente ${patientId}, tipo: ${cancerType}, estágio: ${stage}, status: ${patient.status}`
    );

    // Remover etapas existentes: por diagnóstico (se informado) ou por paciente + tipo de câncer
    if (diagnosisId) {
      await this.prisma.navigationStep.deleteMany({
        where: { diagnosisId, tenantId },
      });
    } else {
      await this.prisma.navigationStep.deleteMany({
        where: {
          patientId,
          tenantId,
          cancerType,
        },
      });
    }

    // Obter configurações de etapas com prazos relativos
    const allSteps = this.getStepConfigs(
      cancerType.toLowerCase(),
      patient.status,
      stage,
    );

    // Filtrar: criar apenas etapas da fase atual e fases anteriores
    const currentStageOrder = JOURNEY_STAGE_ORDER[stage] ?? 0;
    const steps = allSteps.filter(
      (s) => (JOURNEY_STAGE_ORDER[s.journeyStage] ?? 0) <= currentStageOrder,
    );

    this.logger.log(
      `Encontradas ${steps.length} etapas para ${cancerType} no estágio ${stage} (de ${allSteps.length} totais)`
    );

    if (steps.length === 0) {
      this.logger.warn(
        `Nenhuma etapa encontrada para tipo ${cancerType} no estágio ${stage}`
      );
      return;
    }

    // Obter journey do paciente
    const journey = await this.prisma.patientJourney.findUnique({
      where: { patientId },
    });

    // Criar todas as etapas.
    // Etapas sem dependência (dependsOnStepKey === null) são raíz — recebem dueDate = hoje
    // como marcador de início. Etapas com dependência ficam com datas null até a predecessora concluir.
    let createdCount = 0;
    for (const stepConfig of steps) {
      try {
        const isRootStep = stepConfig.dependsOnStepKey === null;
        await this.prisma.navigationStep.create({
          data: {
            tenantId,
            patientId,
            journeyId: journey?.id,
            diagnosisId: diagnosisId ?? undefined,
            cancerType: cancerType.toLowerCase(),
            journeyStage: stepConfig.journeyStage,
            stepKey: stepConfig.stepKey,
            stepName: stepConfig.stepName,
            stepDescription: stepConfig.stepDescription,
            isRequired: stepConfig.isRequired ?? true,
            dependsOnStepKey: stepConfig.dependsOnStepKey,
            relativeDaysMin: stepConfig.relativeDaysMin,
            relativeDaysMax: stepConfig.relativeDaysMax,
            stepOrder: stepConfig.stepOrder,
            // Etapas raíz recebem data de hoje como ponto de partida; dependentes recebem null
            expectedDate: isRootStep ? new Date() : null,
            dueDate: isRootStep ? new Date() : null,
            status: NavigationStepStatus.PENDING,
            isCompleted: false,
          } as any,
        });
        createdCount++;
      } catch (error) {
        this.logger.error(
          `Erro ao criar etapa ${stepConfig.stepKey}:`,
          error instanceof Error ? error.stack : String(error)
        );
        throw error;
      }
    }

    this.logger.log(
      `Criadas ${createdCount} etapas para paciente ${patientId}`
    );
  }

  /**
   * Retorna todos os templates de etapas para uma fase, com contagem de instâncias existentes
   */
  async getAvailableStepTemplates(
    patientId: string,
    tenantId: string,
    journeyStage: JourneyStage
  ): Promise<
    (Pick<
      StepConfig,
      'stepKey' | 'stepName' | 'stepDescription' | 'journeyStage' | 'isRequired'
    > & { existingCount: number })[]
  > {
    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, tenantId },
      select: {
        cancerType: true,
        status: true,
        cancerDiagnoses: {
          select: { cancerType: true },
          where: { isActive: true, isPrimary: true },
          take: 1,
        },
      },
    });

    if (!patient) {
      throw new NotFoundException(`Patient with ID ${patientId} not found`);
    }

    const cancerTypeRaw =
      patient.cancerType || patient.cancerDiagnoses?.[0]?.cancerType || null;

    if (!cancerTypeRaw) {
      throw new BadRequestException(
        'Patient does not have a cancer type defined'
      );
    }

    const cancerType = String(cancerTypeRaw).toLowerCase();

    const existingSteps = await this.prisma.navigationStep.findMany({
      where: { patientId, tenantId, journeyStage },
      select: { stepKey: true },
    });

    const existingCountMap = new Map<string, number>();
    for (const s of existingSteps) {
      const baseKey = s.stepKey.replace(/-\d+$/, '');
      existingCountMap.set(baseKey, (existingCountMap.get(baseKey) || 0) + 1);
    }

    return this.getStepConfigs(cancerType, patient.status, journeyStage)
      .filter((c) => c.journeyStage === journeyStage)
      .map(({ stepKey, stepName, stepDescription, journeyStage: js, isRequired }) => ({
        stepKey,
        stepName,
        stepDescription,
        journeyStage: js,
        isRequired,
        existingCount: existingCountMap.get(stepKey) || 0,
      }));
  }

  /**
   * Cria apenas as etapas faltantes para um estágio específico da jornada
   * Não altera ou deleta etapas existentes
   */
  async createMissingStepsForStage(
    patientId: string,
    tenantId: string,
    journeyStage: JourneyStage,
    onlyStepKey?: string
  ): Promise<{
    created: number;
    skipped: number;
  }> {
    // Buscar informações do paciente
    const patient = await this.prisma.patient.findFirst({
      where: {
        id: patientId,
        tenantId,
      },
      select: {
        cancerType: true,
        status: true,
        cancerDiagnoses: {
          select: {
            cancerType: true,
          },
          where: {
            isActive: true,
            isPrimary: true,
          },
          take: 1,
        },
      },
    });

    if (!patient) {
      throw new NotFoundException(`Patient with ID ${patientId} not found`);
    }

    // Determinar tipo de câncer
    const cancerTypeRaw =
      patient.cancerType || patient.cancerDiagnoses?.[0]?.cancerType || null;

    if (!cancerTypeRaw) {
      throw new BadRequestException(
        'Patient does not have a cancer type defined'
      );
    }

    const cancerType = String(cancerTypeRaw).toLowerCase();

    // Buscar etapas existentes para este estágio
    const existingSteps = await this.prisma.navigationStep.findMany({
      where: {
        patientId,
        tenantId,
        journeyStage,
      },
      select: {
        stepKey: true,
      },
    });

    const existingStepKeys = new Set(existingSteps.map((s) => s.stepKey));

    // Obter configs de etapas e filtrar pelo estágio solicitado
    const allConfigs = this.getStepConfigs(
      cancerType,
      patient.status,
      journeyStage,
    );
    const expectedSteps = allConfigs.filter(
      (step) => step.journeyStage === journeyStage
    );

    // Filtrar apenas as etapas que não existem (e opcionalmente uma chave específica)
    const missingSteps = expectedSteps.filter(
      (step) =>
        !existingStepKeys.has(step.stepKey) &&
        (onlyStepKey === undefined ||
          onlyStepKey === null ||
          step.stepKey === onlyStepKey)
    );

    if (missingSteps.length === 0) {
      return { created: 0, skipped: existingSteps.length };
    }

    // Obter journey do paciente
    const journey = await this.prisma.patientJourney.findUnique({
      where: { patientId },
    });

    // Criar apenas as etapas faltantes
    let createdCount = 0;
    for (const stepConfig of missingSteps) {
      try {
        const isRootStep = stepConfig.dependsOnStepKey === null;
        await this.prisma.navigationStep.create({
          data: {
            tenantId,
            patientId,
            journeyId: journey?.id,
            cancerType,
            journeyStage: stepConfig.journeyStage,
            stepKey: stepConfig.stepKey,
            stepName: stepConfig.stepName,
            stepDescription: stepConfig.stepDescription,
            isRequired: stepConfig.isRequired ?? true,
            dependsOnStepKey: stepConfig.dependsOnStepKey,
            relativeDaysMin: stepConfig.relativeDaysMin,
            relativeDaysMax: stepConfig.relativeDaysMax,
            stepOrder: stepConfig.stepOrder,
            expectedDate: isRootStep ? new Date() : null,
            dueDate: isRootStep ? new Date() : null,
            status: NavigationStepStatus.PENDING,
            isCompleted: false,
          } as any,
        });
        createdCount++;
      } catch (error) {
        this.logger.error(
          `Erro ao criar etapa ${stepConfig.stepKey}:`,
          error instanceof Error ? error.stack : String(error)
        );
        // Continuar criando outras etapas mesmo se uma falhar
      }
    }

    return {
      created: createdCount,
      skipped: existingSteps.length,
    };
  }

  /**
   * Cria uma instância adicional de um step a partir de um template existente.
   * Gera stepKey único com sufixo numérico (ex: rtu-2, rtu-3).
   */
  async createStepFromTemplate(
    patientId: string,
    tenantId: string,
    journeyStage: JourneyStage,
    stepKey: string
  ): Promise<NavigationStep> {
    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, tenantId },
      select: {
        cancerType: true,
        status: true,
        cancerDiagnoses: {
          select: { cancerType: true },
          where: { isActive: true, isPrimary: true },
          take: 1,
        },
      },
    });

    if (!patient) {
      throw new NotFoundException(`Patient with ID ${patientId} not found`);
    }

    const cancerTypeRaw =
      patient.cancerType || patient.cancerDiagnoses?.[0]?.cancerType || null;

    if (!cancerTypeRaw) {
      throw new BadRequestException(
        'Patient does not have a cancer type defined'
      );
    }

    const cancerType = String(cancerTypeRaw).toLowerCase();

    const allConfigs = this.getStepConfigs(
      cancerType,
      patient.status,
      journeyStage,
    );
    const templateConfig = allConfigs.find(
      (c) => c.stepKey === stepKey && c.journeyStage === journeyStage
    );

    if (!templateConfig) {
      throw new NotFoundException(
        `Template with stepKey "${stepKey}" not found for stage ${journeyStage}`
      );
    }

    const existingSteps = await this.prisma.navigationStep.findMany({
      where: {
        patientId,
        tenantId,
        journeyStage,
        OR: [{ stepKey }, { stepKey: { startsWith: `${stepKey}-` } }],
      },
      select: { stepKey: true },
    });

    const nextSuffix = existingSteps.length + 1;
    const newStepKey = nextSuffix === 1 ? stepKey : `${stepKey}-${nextSuffix}`;

    const journey = await this.prisma.patientJourney.findUnique({
      where: { patientId },
    });

    const step = await this.prisma.navigationStep.create({
      data: {
        tenantId,
        patientId,
        journeyId: journey?.id,
        cancerType,
        journeyStage: templateConfig.journeyStage,
        stepKey: newStepKey,
        stepName: templateConfig.stepName,
        stepDescription: templateConfig.stepDescription,
        isRequired: templateConfig.isRequired ?? true,
        expectedDate: null,
        dueDate: null,
        status: NavigationStepStatus.PENDING,
        isCompleted: false,
      },
    });

    return step;
  }

  /**
   * Inicializa etapas de navegação para todos os pacientes que têm tipo de câncer
   * ou que possuem etapas legadas sem metadados de dependência/prazo relativos.
   */
  async initializeAllPatientsSteps(tenantId: string): Promise<{
    initialized: number;
    skipped: number;
    errors: number;
  }> {
    // Buscar todos os pacientes com tipo de câncer mas sem etapas
    const patients = await this.prisma.patient.findMany({
      where: {
        tenantId,
        OR: [
          { cancerType: { not: null } },
          {
            cancerDiagnoses: {
              some: {
                isActive: true,
                isPrimary: true,
              },
            },
          },
        ],
      },
      include: {
        cancerDiagnoses: {
          where: { isActive: true },
          orderBy: { isPrimary: 'desc' },
        },
        navigationSteps: {
          select: { id: true },
          take: 1, // Apenas verificar se existe
        },
      },
    });

    let initialized = 0;
    let skipped = 0;
    let errors = 0;

    for (const patient of patients) {
      try {
        // Determinar tipo de câncer (prioridade: cancerType > primeiro diagnóstico primário)
        const cancerTypeRaw =
          patient.cancerType ||
          patient.cancerDiagnoses?.[0]?.cancerType ||
          null;

        if (!cancerTypeRaw) {
          skipped++;
          continue;
        }

        const hasAnyStep = (patient.navigationSteps?.length ?? 0) > 0;

        // Se já houver etapas, reinitialize apenas quando detectar assinatura legada.
        const legacyStep = hasAnyStep
          ? await this.prisma.navigationStep.findFirst({
              where: {
                patientId: patient.id,
                tenantId,
                OR: [
                  // Fluxo antigo criava com default stepOrder=0
                  { stepOrder: 0 },
                  // Etapa dependente sem janela relativa completa
                  {
                    AND: [
                      { dependsOnStepKey: { not: null } },
                      {
                        OR: [
                          { relativeDaysMin: null },
                          { relativeDaysMax: null },
                        ],
                      },
                    ],
                  },
                ],
              } as any,
              select: { id: true },
            })
          : null;

        // Inicializar quando:
        // 1) não há etapas ainda; ou
        // 2) há etapas, mas ao menos uma é legada e precisa migrar para grafo relativo.
        if (!hasAnyStep || !!legacyStep) {
          // Converter para minúsculas para garantir consistência
          const cancerType = String(cancerTypeRaw).toLowerCase();

          // Usar currentStage do paciente ou default SCREENING
          const currentStage = patient.currentStage || JourneyStage.SCREENING;

          // Re-inicializar todas as etapas (isso vai deletar as antigas e criar novas para todos os estágios)
          await this.initializeNavigationSteps(
            patient.id,
            tenantId,
            cancerType,
            currentStage
          );

          initialized++;
        } else {
          // Já possui grafo moderno (não-legado)
          skipped++;
        }
      } catch (error) {
        this.logger.error(
          `Erro ao inicializar etapas para paciente ${patient.id}:`,
          error instanceof Error ? error.stack : String(error)
        );
        errors++;
      }
    }

    return { initialized, skipped, errors };
  }

  /**
   * Verifica e cria alertas para etapas atrasadas de um paciente específico
   */
  async checkOverdueStepsForPatient(
    patientId: string,
    tenantId: string
  ): Promise<{
    checked: number;
    markedOverdue: number;
    alertsCreated: number;
  }> {
    const now = new Date();
    const overdueSteps = await this.prisma.navigationStep.findMany({
      where: {
        tenantId,
        patientId,
        status: {
          in: [NavigationStepStatus.PENDING, NavigationStepStatus.IN_PROGRESS],
        },
        isCompleted: false,
        dueDate: {
          lt: now,
        },
      },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            cancerType: true,
            currentStage: true,
          },
        },
      },
    });

    let markedOverdue = 0;
    let alertsCreated = 0;

    for (const step of overdueSteps) {
      // Marcar como atrasada se ainda não estiver marcada
      if (step.status !== NavigationStepStatus.OVERDUE) {
        await this.prisma.navigationStep.update({
          where: { id: step.id, tenantId },
          data: { status: NavigationStepStatus.OVERDUE },
        });
        markedOverdue++;
      }

      // Verificar e criar alerta
      const alertCreated = await this.checkAndCreateAlertForStep(
        step,
        tenantId
      );
      if (alertCreated) {
        alertsCreated++;
      }
    }

    return {
      checked: overdueSteps.length,
      markedOverdue,
      alertsCreated,
    };
  }

  /**
   * Verifica e cria alertas para etapas atrasadas
   * Evita criar alertas duplicados verificando se já existe um alerta pendente para a mesma etapa
   */
  async checkOverdueSteps(tenantId: string): Promise<{
    checked: number;
    markedOverdue: number;
    alertsCreated: number;
  }> {
    const now = new Date();
    const overdueSteps = await this.prisma.navigationStep.findMany({
      where: {
        tenantId,
        status: {
          in: [NavigationStepStatus.PENDING, NavigationStepStatus.IN_PROGRESS],
        },
        isCompleted: false,
        dueDate: {
          lt: now,
        },
      },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            cancerType: true,
            currentStage: true,
          },
        },
      },
    });

    let markedOverdue = 0;
    let alertsCreated = 0;

    for (const step of overdueSteps) {
      // Marcar como atrasada se ainda não estiver marcada
      if (step.status !== NavigationStepStatus.OVERDUE) {
        await this.prisma.navigationStep.update({
          where: { id: step.id, tenantId },
          data: { status: NavigationStepStatus.OVERDUE },
        });
        markedOverdue++;
      }

      // Criar alerta apenas se não existir um alerta pendente para esta etapa
      // A verificação de duplicidade é feita dentro de checkAndCreateAlertForStep
      const alertCreated = await this.checkAndCreateAlertForStep(
        step,
        tenantId
      );
      if (alertCreated) {
        alertsCreated++;
      }
    }

    return {
      checked: overdueSteps.length,
      markedOverdue,
      alertsCreated,
    };
  }

  /**
   * Verifica e cria alerta para uma etapa específica se estiver atrasada
   * Método auxiliar usado ao criar/atualizar etapas
   */
  private async checkAndCreateAlertForStep(
    step: NavigationStep,
    tenantId: string
  ): Promise<boolean> {
    if (!step.dueDate || step.isCompleted) {
      return false;
    }

    // Comparar apenas data (sem hora) para evitar problemas de timezone
    const stepDueDate = new Date(step.dueDate!);
    stepDueDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (stepDueDate >= today) {
      return false; // Não está atrasada ainda
    }

    // Verificar se já existe um alerta pendente para esta etapa
    const existingAlerts = await this.prisma.alert.findMany({
      where: {
        tenantId,
        patientId: step.patientId,
        type: AlertType.NAVIGATION_DELAY,
        status: {
          in: ['PENDING', 'ACKNOWLEDGED'],
        },
      },
      select: {
        id: true,
        context: true,
      },
    });

    // Verificar se algum alerta tem o stepId no context
    const existingAlert = existingAlerts.find((alert) => {
      if (!alert.context || typeof alert.context !== 'object') {
        return false;
      }
      const context = alert.context as { stepId?: string };
      return context.stepId === step.id;
    });

    // Criar alerta apenas se não existir um alerta pendente para esta etapa
    if (!existingAlert) {
      const daysOverdue = Math.floor(
        (today.getTime() - stepDueDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      try {
        await this.alertsService.create(
          {
            patientId: step.patientId,
            type: AlertType.NAVIGATION_DELAY,
            severity: this.getSeverityForStep(step),
            message: `Etapa atrasada: ${step.stepName}${step.stepDescription ? ` - ${step.stepDescription}` : ''} (${daysOverdue} ${daysOverdue === 1 ? 'dia' : 'dias'} de atraso)`,
            context: {
              stepId: step.id,
              stepKey: step.stepKey,
              journeyStage: step.journeyStage,
              dueDate: step.dueDate?.toISOString(),
              daysOverdue,
            },
          },
          tenantId
        );
        this.logger.log(
          `✅ Alerta criado para etapa atrasada: ${step.stepName} (${daysOverdue} dias)`
        );
        return true;
      } catch (error) {
        this.logger.error(
          `❌ Erro ao criar alerta para etapa ${step.id}:`,
          error instanceof Error ? error.stack : String(error)
        );
        return false;
      }
    } else {
      this.logger.debug(
        `⏭️ Alerta já existe para etapa ${step.stepName}, pulando criação`
      );
      return false;
    }
  }

  /**
   * Etapas transversais a todas as fases da jornada (consultas de coordenação / especialista).
   * Injetadas após os protocolos por tipo de câncer.
   */
  private mergeUniversalStepConfigs(configs: StepConfig[]): StepConfig[] {
    const present = new Set(configs.map((c) => `${c.journeyStage}:${c.stepKey}`));
    const stagesInConfigs = [...new Set(configs.map((c) => c.journeyStage))];
    const universalDefs: Omit<StepConfig, 'journeyStage' | 'stepOrder'>[] = [
      {
        stepKey: 'specialist_consultation',
        stepName: 'Consulta especializada',
        stepDescription:
          'Consulta com especialista da linha de cuidado (não substitui a navegação oncológica).',
        isRequired: false,
        dependsOnStepKey: null,
        relativeDaysMin: null,
        relativeDaysMax: null,
      },
      {
        stepKey: 'navigation_consultation',
        stepName: 'Consulta de navegação oncológica',
        stepDescription:
          'Atendimento com o navegador oncológico para coordenação de acesso, barreiras e continuidade do cuidado.',
        isRequired: false,
        dependsOnStepKey: null,
        relativeDaysMin: null,
        relativeDaysMax: null,
      },
    ];

    const merged = [...configs];
    for (const stage of stagesInConfigs) {
      const maxOrder = Math.max(
        0,
        ...configs
          .filter((c) => c.journeyStage === stage)
          .map((c) => c.stepOrder)
      );
      let nextOrder = maxOrder + 1;
      for (const def of universalDefs) {
        const key = `${stage}:${def.stepKey}`;
        if (!present.has(key)) {
          merged.push({
            ...def,
            journeyStage: stage,
            stepOrder: nextOrder++,
          });
          present.add(key);
        }
      }
    }
    return merged;
  }

  /** Próximo stepOrder ao mover etapa para uma fase (append ao fim da coluna). */
  private async getNextStepOrderForStage(
    patientId: string,
    tenantId: string,
    journeyStage: JourneyStage
  ): Promise<number> {
    const agg = await this.prisma.navigationStep.aggregate({
      where: { patientId, tenantId, journeyStage },
      _max: { stepOrder: true },
    });
    return (agg._max.stepOrder ?? 0) + 1;
  }

  /**
   * Retorna as configurações de etapas para um tipo de câncer.
   * Cada etapa define dependência relativa (stepKey da predecessora + dias).
   * Datas são calculadas em runtime quando a dependência é concluída.
   */
  private getStepConfigs(
    cancerType: string,
    _patientStatus?: PatientStatus,
    currentStage?: JourneyStage,
  ): StepConfig[] {
    let base: StepConfig[];
    // Palliative *stage* templates only when the requested stage is PALLIATIVE.
    // patient.status === PALLIATIVE_CARE must not replace cancer-specific configs
    // for SCREENING/DIAGNOSIS/TREATMENT/FOLLOW_UP (e.g. step-templates API).
    if (currentStage === JourneyStage.PALLIATIVE) {
      base = this.getPalliativeStepConfigs();
    } else {
      switch (cancerType.toLowerCase()) {
        case 'colorectal':
          base = this.getColorectalStepConfigs();
          break;
        case 'breast':
          base = this.getBreastStepConfigs();
          break;
        case 'lung':
          base = this.getLungStepConfigs();
          break;
        case 'prostate':
          base = this.getProstateStepConfigs();
          break;
        case 'kidney':
          base = this.getKidneyStepConfigs();
          break;
        case 'bladder':
          base = this.getBladderStepConfigs();
          break;
        case 'testicular':
          base = this.getTesticularStepConfigs();
          break;
        default:
          base = this.getGenericStepConfigs();
      }
    }
    return this.mergeUniversalStepConfigs(base);
  }


  // =========================================================================
  // BIFURCAÇÃO CLÍNICA — Câncer de Bexiga NMIBC/MIBC
  // =========================================================================

  /**
   * Aplica bifurcação NMIBC/MIBC ao concluir o laudo anatomopatológico de bexiga.
   * NMIBC (não-músculo-invasivo) → BCG intravesical (cirurgia radical NOT_APPLICABLE)
   * MIBC (músculo-invasivo) → Cistectomia radical (BCG NOT_APPLICABLE)
   */
  private async applyBladderCancerBifurcation(
    completedStep: NavigationStep,
    tenantId: string
  ): Promise<void> {
    if (
      completedStep.cancerType !== 'bladder' ||
      completedStep.stepKey !== 'pathology_report'
    ) {
      return;
    }

    const result = ((completedStep.result as string) || '').toLowerCase();
    const metadata = completedStep.metadata as Record<string, unknown> | null;
    const muscleInvasive = metadata?.muscleInvasive as boolean | undefined;

    const isNMIBC =
      muscleInvasive === false ||
      result.includes('nmibc') ||
      result.includes('não-músculo') ||
      result.includes('nao-musculo') ||
      result.includes('non-muscle') ||
      result.includes('superficial');

    const isMIBC =
      muscleInvasive === true ||
      result.includes('mibc') ||
      result.includes('músculo-invasivo') ||
      result.includes('musculo-invasivo') ||
      result.includes('muscle-invasive');

    if (!isNMIBC && !isMIBC) {
      this.logger.log(
        `Bifurcação bexiga: laudo sem indicação clara de NMIBC/MIBC para paciente ${completedStep.patientId}`
      );
      return;
    }

    const stepsToDisable = isNMIBC
      ? ['radical_cystectomy', 'neobladder_or_urostomy']
      : ['intravesical_bcg'];

    const disabledNote = isNMIBC
      ? 'Não aplicável: tumor não-músculo-invasivo (NMIBC) — via BCG selecionada'
      : 'Não aplicável: tumor músculo-invasivo (MIBC) — via cistectomia selecionada';

    await this.prisma.navigationStep.updateMany({
      where: {
        patientId: completedStep.patientId,
        tenantId,
        stepKey: { in: stepsToDisable },
        status: { notIn: [NavigationStepStatus.COMPLETED] },
      },
      data: {
        status: NavigationStepStatus.NOT_APPLICABLE,
        notes: disabledNote,
      },
    });

    // MIBC: QT adjuvante depende da cistectomia (T+42), não do laudo (T+30)
    if (isMIBC) {
      await this.prisma.navigationStep.updateMany({
        where: {
          patientId: completedStep.patientId,
          tenantId,
          stepKey: 'chemotherapy',
          status: {
            notIn: [
              NavigationStepStatus.COMPLETED,
              NavigationStepStatus.NOT_APPLICABLE,
              NavigationStepStatus.CANCELLED,
            ],
          },
        },
        data: {
          dependsOnStepKey: 'radical_cystectomy',
          relativeDaysMin: 42,
          relativeDaysMax: 56,
          notes:
            'QT adjuvante pós-cistectomia (MIBC): 6-8 semanas após cirurgia',
        } as any,
      });
      this.logger.log(
        `Bifurcação bexiga MIBC: chemotherapy reatribuída → dependsOn=radical_cystectomy, T+42-56`,
      );
    }

    this.logger.log(
      `Bifurcação bexiga: ${isNMIBC ? 'NMIBC' : 'MIBC'} → ${stepsToDisable.join(', ')} marcados como NOT_APPLICABLE`
    );
  }

  // =========================================================================
  // CHECKPOINTS LEGAIS — Lei 30 dias e Lei 60 dias
  // =========================================================================

  /**
   * Verifica conformidade com a Lei 13.896/2019 (30 dias suspeita→diagnóstico)
   * e Lei 12.732/2012 (60 dias diagnóstico→tratamento).
   * Cria alertas quando prazos são excedidos ou estão próximos de expirar.
   */
  private async checkLegalCheckpoints(
    completedStep: NavigationStep,
    tenantId: string
  ): Promise<void> {
    // Lei 30 dias: ao concluir o laudo (diagnóstico confirmado)
    if (completedStep.stepKey === 'pathology_report') {
      const firstStep = await this.prisma.navigationStep.findFirst({
        where: {
          patientId: completedStep.patientId,
          tenantId,
          stepOrder: 1,
        } as any,
      });

      if (firstStep?.createdAt) {
        const actualDate = completedStep.actualDate
          ? new Date(completedStep.actualDate)
          : new Date();
        const daysDiff = Math.floor(
          (actualDate.getTime() - new Date(firstStep.createdAt).getTime()) /
            (1000 * 60 * 60 * 24)
        );

        if (daysDiff > 30) {
          try {
            await this.alertsService.create(
              {
                patientId: completedStep.patientId,
                type: AlertType.NAVIGATION_DELAY,
                severity: AlertSeverity.HIGH,
                message: `Lei 30 dias: diagnóstico confirmado em ${daysDiff} dias após suspeita (limite legal: 30 dias)`,
                context: {
                  checkpoint: 'LEI_30_DIAS',
                  daysDiff,
                  limit: 30,
                  stepKey: completedStep.stepKey,
                },
              },
              tenantId
            );
            this.logger.warn(
              `Lei 30 dias excedida: ${daysDiff} dias para paciente ${completedStep.patientId}`
            );
          } catch (e) {
            this.logger.error('Erro ao criar alerta Lei 30 dias', e);
          }
        } else if (daysDiff >= 20) {
          // Alerta preventivo quando restam ≤10 dias
          this.logger.log(
            `Lei 30 dias: ${daysDiff} dias decorridos — dentro do prazo para paciente ${completedStep.patientId}`
          );
        }
      }
    }

    // Lei 60 dias: ao concluir a primeira etapa de tratamento
    const treatmentFirstSteps = [
      'intravesical_bcg',
      'radical_cystectomy',
      'chemotherapy',
      'radiotherapy',
      'colectomy',
      'mastectomy_or_lumpectomy',
      'lobectomy_or_pneumonectomy',
      'radical_prostatectomy',
      'partial_or_radical_nephrectomy',
      'radical_orchiectomy',
      'first_treatment',
    ];

    if (treatmentFirstSteps.includes(completedStep.stepKey)) {
      const pathologyStep = await this.prisma.navigationStep.findFirst({
        where: {
          patientId: completedStep.patientId,
          tenantId,
          stepKey: 'pathology_report',
          isCompleted: true,
        },
      });

      if (pathologyStep?.actualDate) {
        const actualDate = completedStep.actualDate
          ? new Date(completedStep.actualDate)
          : new Date();
        const daysDiff = Math.floor(
          (actualDate.getTime() -
            new Date(pathologyStep.actualDate).getTime()) /
            (1000 * 60 * 60 * 24)
        );

        if (daysDiff > 60) {
          try {
            await this.alertsService.create(
              {
                patientId: completedStep.patientId,
                type: AlertType.NAVIGATION_DELAY,
                severity: AlertSeverity.HIGH,
                message: `Lei 60 dias: tratamento iniciado em ${daysDiff} dias após diagnóstico (limite legal: 60 dias)`,
                context: {
                  checkpoint: 'LEI_60_DIAS',
                  daysDiff,
                  limit: 60,
                  stepKey: completedStep.stepKey,
                },
              },
              tenantId
            );
            this.logger.warn(
              `Lei 60 dias excedida: ${daysDiff} dias para paciente ${completedStep.patientId}`
            );
          } catch (e) {
            this.logger.error('Erro ao criar alerta Lei 60 dias', e);
          }
        }
      }
    }
  }

  // =========================================================================
  // STEP CONFIGS — prazos relativos conforme guidelines clínicos internacionais
  // Cada StepConfig define a etapa predecessora (dependsOnStepKey) e o intervalo
  // de dias esperado. As datas são calculadas em runtime quando a predecessora conclui.
  // =========================================================================

  /**
   * Câncer de Bexiga — MVP ATIVO (13 etapas, EAU/AUA/NCCN)
   * Bifurcação NMIBC/MIBC aplicada via applyBladderCancerBifurcation()
   * ao concluir pathology_report.
   */
  private getBladderStepConfigs(): StepConfig[] {
    return [
      {
        journeyStage: JourneyStage.SCREENING,
        stepKey: 'urine_cytology',
        stepName: 'Citologia Urinária',
        stepDescription: 'Rastreio de células neoplásicas na urina (marcador inicial)',
        isRequired: true,
        dependsOnStepKey: null,
        relativeDaysMin: null,
        relativeDaysMax: null,
        stepOrder: 1,
      },
      {
        journeyStage: JourneyStage.SCREENING,
        stepKey: 'clinical_suspicion',
        stepName: 'Suspeita Clínica',
        stepDescription:
          'Sintomas clínicos sugestivos (hematúria, disúria, urgência miccional). Complementar ao exame de rastreio — prazo de 30 dias para diagnóstico.',
        isRequired: false,
        dependsOnStepKey: null,
        relativeDaysMin: null,
        relativeDaysMax: null,
        stepOrder: 2,
      },
      {
        journeyStage: JourneyStage.DIAGNOSIS,
        stepKey: 'cystoscopy',
        stepName: 'Cistoscopia',
        stepDescription: 'Visualização endoscópica da bexiga para avaliação diagnóstica. Prazo: até 30 dias após suspeita clínica ou exame de rastreio alterado.',
        isRequired: true,
        dependsOnStepKey: 'urine_cytology',
        relativeDaysMin: 14,
        relativeDaysMax: 30,
        stepOrder: 3,
      },
      {
        journeyStage: JourneyStage.DIAGNOSIS,
        stepKey: 'transurethral_resection',
        stepName: 'Ressecção Transuretral de Bexiga (RTU)',
        stepDescription: 'Remoção endoscópica do tumor com material para anatomopatológico',
        isRequired: true,
        dependsOnStepKey: 'cystoscopy',
        relativeDaysMin: 14,
        relativeDaysMax: 21,
        stepOrder: 4,
      },
      {
        journeyStage: JourneyStage.DIAGNOSIS,
        stepKey: 'pathology_report',
        stepName: 'Laudo Anatomopatológico',
        stepDescription: 'Grau histológico (baixo/alto), invasão muscular (NMIBC vs MIBC), estadiamento patológico',
        isRequired: true,
        dependsOnStepKey: 'transurethral_resection',
        relativeDaysMin: 0,
        relativeDaysMax: 7,
        stepOrder: 5,
      },
      {
        journeyStage: JourneyStage.DIAGNOSIS,
        stepKey: 'ct_urography',
        stepName: 'Urografia por TC',
        stepDescription: 'Avaliação do trato urinário superior por tomografia computadorizada',
        isRequired: true,
        dependsOnStepKey: 'pathology_report',
        relativeDaysMin: 0,
        relativeDaysMax: 14,
        stepOrder: 6,
      },
      {
        journeyStage: JourneyStage.DIAGNOSIS,
        stepKey: 'ct_thorax',
        stepName: 'TC de Tórax',
        stepDescription: 'Avaliação de metástases pulmonares (paralelo à urografia)',
        isRequired: true,
        dependsOnStepKey: 'pathology_report',
        relativeDaysMin: 0,
        relativeDaysMax: 14,
        stepOrder: 7,
      },
      {
        journeyStage: JourneyStage.TREATMENT,
        stepKey: 'intravesical_bcg',
        stepName: 'BCG Intravesical',
        stepDescription: 'Imunoterapia intravesical — NMIBC alto risco (indução 6 semanas)',
        isRequired: false,
        dependsOnStepKey: 'pathology_report',
        relativeDaysMin: 14,
        relativeDaysMax: 42,
        stepOrder: 8,
      },
      {
        journeyStage: JourneyStage.TREATMENT,
        stepKey: 'radical_cystectomy',
        stepName: 'Cistectomia Radical',
        stepDescription: 'Remoção cirúrgica da bexiga — MIBC (músculo-invasivo)',
        isRequired: false,
        dependsOnStepKey: 'pathology_report',
        relativeDaysMin: 30,
        relativeDaysMax: 42,
        stepOrder: 9,
      },
      {
        journeyStage: JourneyStage.TREATMENT,
        stepKey: 'neobladder_or_urostomy',
        stepName: 'Neobexiga ou Urostomia',
        stepDescription: 'Reconstrução urinária — simultânea à cistectomia radical',
        isRequired: false,
        dependsOnStepKey: 'radical_cystectomy',
        relativeDaysMin: 0,
        relativeDaysMax: 0,
        stepOrder: 10,
      },
      {
        journeyStage: JourneyStage.TREATMENT,
        stepKey: 'chemotherapy',
        stepName: 'Quimioterapia',
        stepDescription: 'QT neoadjuvante (MIBC pré-cistectomia) ou adjuvante pós-cirurgia',
        isRequired: false,
        dependsOnStepKey: 'pathology_report',
        relativeDaysMin: 30,
        relativeDaysMax: 30,
        stepOrder: 11,
      },
      {
        journeyStage: JourneyStage.TREATMENT,
        stepKey: 'transurethral_resection_therapeutic',
        stepName: 'RTU de Bexiga (terapêutica / re-ressecção)',
        stepDescription:
          'Ressecção transuretral com finalidade terapêutica (ex.: doença residual, recidiva intravesical, resgate após BCG). Distinta da RTU diagnóstica inicial.',
        isRequired: false,
        dependsOnStepKey: 'pathology_report',
        relativeDaysMin: 14,
        relativeDaysMax: 42,
        stepOrder: 12,
      },
      {
        journeyStage: JourneyStage.FOLLOW_UP,
        stepKey: 'cystoscopy_3months',
        stepName: 'Cistoscopia 3 Meses',
        stepDescription: 'Seguimento pós-tratamento — avaliação de recidiva a 3 meses',
        isRequired: true,
        dependsOnStepKey: 'intravesical_bcg',
        relativeDaysMin: 90,
        relativeDaysMax: 90,
        stepOrder: 13,
      },
      {
        journeyStage: JourneyStage.FOLLOW_UP,
        stepKey: 'cystoscopy_6months',
        stepName: 'Cistoscopia 6 Meses',
        stepDescription: 'Seguimento pós-tratamento — avaliação de recidiva a 6 meses',
        isRequired: true,
        dependsOnStepKey: 'intravesical_bcg',
        relativeDaysMin: 180,
        relativeDaysMax: 180,
        stepOrder: 14,
      },
      {
        journeyStage: JourneyStage.FOLLOW_UP,
        stepKey: 'cystoscopy_annual',
        stepName: 'Cistoscopia Anual',
        stepDescription: 'Seguimento pós-tratamento — avaliação de recidiva anual',
        isRequired: true,
        dependsOnStepKey: 'intravesical_bcg',
        relativeDaysMin: 365,
        relativeDaysMax: 365,
        stepOrder: 15,
      },
    ];
  }

  /**
   * Câncer Colorretal — OCULTO no MVP (16 etapas, NCCN/CONITEC)
   */
  private getColorectalStepConfigs(): StepConfig[] {
    return [
      {
        journeyStage: JourneyStage.SCREENING,
        stepKey: 'fecal_occult_blood',
        stepName: 'Pesquisa de Sangue Oculto nas Fezes',
        stepDescription: 'Exame de rastreio inicial para detecção de sangue oculto nas fezes',
        isRequired: true,
        dependsOnStepKey: null,
        relativeDaysMin: null,
        relativeDaysMax: null,
        stepOrder: 1,
      },
      {
        journeyStage: JourneyStage.SCREENING,
        stepKey: 'clinical_suspicion',
        stepName: 'Suspeita Clínica',
        stepDescription:
          'Sintomas clínicos sugestivos (alteração do hábito intestinal, sangramento retal, dor abdominal). Complementar ao exame de rastreio — prazo de 30 dias para diagnóstico.',
        isRequired: false,
        dependsOnStepKey: null,
        relativeDaysMin: null,
        relativeDaysMax: null,
        stepOrder: 2,
      },
      {
        journeyStage: JourneyStage.SCREENING,
        stepKey: 'colonoscopy',
        stepName: 'Colonoscopia de Rastreio',
        stepDescription: 'Colonoscopia de rastreio (se PSOF positivo)',
        isRequired: false,
        dependsOnStepKey: 'fecal_occult_blood',
        relativeDaysMin: 0,
        relativeDaysMax: 30,
        stepOrder: 3,
      },
      {
        journeyStage: JourneyStage.DIAGNOSIS,
        stepKey: 'colonoscopy_with_biopsy',
        stepName: 'Colonoscopia com Biópsia',
        stepDescription: 'Colonoscopia diagnóstica com coleta de material para análise. Prazo: até 30 dias após suspeita clínica ou exame de rastreio alterado.',
        isRequired: true,
        dependsOnStepKey: 'fecal_occult_blood',
        relativeDaysMin: 0,
        relativeDaysMax: 30,
        stepOrder: 4,
      },
      {
        journeyStage: JourneyStage.DIAGNOSIS,
        stepKey: 'pathology_report',
        stepName: 'Laudo Anatomopatológico',
        stepDescription: 'Confirmação do diagnóstico e tipo histológico',
        isRequired: true,
        dependsOnStepKey: 'colonoscopy_with_biopsy',
        relativeDaysMin: 0,
        relativeDaysMax: 7,
        stepOrder: 5,
      },
      {
        journeyStage: JourneyStage.DIAGNOSIS,
        stepKey: 'staging_ct_abdomen',
        stepName: 'TC de Abdome e Pelve',
        stepDescription: 'Tomografia para estadiamento — avaliação de metástases abdominais',
        isRequired: true,
        dependsOnStepKey: 'pathology_report',
        relativeDaysMin: 0,
        relativeDaysMax: 14,
        stepOrder: 6,
      },
      {
        journeyStage: JourneyStage.DIAGNOSIS,
        stepKey: 'staging_ct_thorax',
        stepName: 'TC de Tórax',
        stepDescription: 'Avaliação de metástases pulmonares (paralelo ao TC abdome)',
        isRequired: true,
        dependsOnStepKey: 'pathology_report',
        relativeDaysMin: 0,
        relativeDaysMax: 14,
        stepOrder: 7,
      },
      {
        journeyStage: JourneyStage.DIAGNOSIS,
        stepKey: 'genetic_testing',
        stepName: 'Teste Genético (MSI, KRAS, NRAS, BRAF)',
        stepDescription: 'Testes moleculares para orientar tratamento em estágio avançado',
        isRequired: false,
        dependsOnStepKey: 'pathology_report',
        relativeDaysMin: 0,
        relativeDaysMax: 14,
        stepOrder: 8,
      },
      {
        journeyStage: JourneyStage.DIAGNOSIS,
        stepKey: 'cea_baseline',
        stepName: 'CEA Basal',
        stepDescription: 'Dosagem de CEA como marcador tumoral basal',
        isRequired: true,
        dependsOnStepKey: 'pathology_report',
        relativeDaysMin: 0,
        relativeDaysMax: 14,
        stepOrder: 9,
      },
      {
        journeyStage: JourneyStage.TREATMENT,
        stepKey: 'surgical_evaluation',
        stepName: 'Avaliação Cirúrgica',
        stepDescription: 'Consulta com cirurgião para planejamento da ressecção',
        isRequired: true,
        dependsOnStepKey: 'staging_ct_abdomen',
        relativeDaysMin: 0,
        relativeDaysMax: 14,
        stepOrder: 10,
      },
      {
        journeyStage: JourneyStage.TREATMENT,
        stepKey: 'colectomy',
        stepName: 'Colectomia (Cirurgia)',
        stepDescription: 'Ressecção cirúrgica do tumor colorretal',
        isRequired: true,
        dependsOnStepKey: 'surgical_evaluation',
        relativeDaysMin: 21,
        relativeDaysMax: 30,
        stepOrder: 11,
      },
      {
        journeyStage: JourneyStage.TREATMENT,
        stepKey: 'adjuvant_chemotherapy',
        stepName: 'Quimioterapia Adjuvante',
        stepDescription: 'QT adjuvante (FOLFOX ou CAPOX) se estágio III ou alto risco estágio II',
        isRequired: false,
        dependsOnStepKey: 'colectomy',
        relativeDaysMin: 42,
        relativeDaysMax: 56,
        stepOrder: 12,
      },
      {
        journeyStage: JourneyStage.TREATMENT,
        stepKey: 'radiotherapy',
        stepName: 'Radioterapia',
        stepDescription: 'RT neoadjuvante ou adjuvante para câncer retal (T3-T4 ou N+)',
        isRequired: false,
        dependsOnStepKey: 'colectomy',
        relativeDaysMin: 42,
        relativeDaysMax: 56,
        stepOrder: 13,
      },
      {
        journeyStage: JourneyStage.FOLLOW_UP,
        stepKey: 'cea_3months',
        stepName: 'CEA aos 3 meses',
        stepDescription: 'Dosagem de CEA para acompanhamento pós-cirúrgico',
        isRequired: true,
        dependsOnStepKey: 'colectomy',
        relativeDaysMin: 90,
        relativeDaysMax: 90,
        stepOrder: 14,
      },
      {
        journeyStage: JourneyStage.FOLLOW_UP,
        stepKey: 'colonoscopy_1year',
        stepName: 'Colonoscopia de Controle (1 ano)',
        stepDescription: 'Vigilância endoscópica pós-cirúrgica no primeiro ano',
        isRequired: true,
        dependsOnStepKey: 'colectomy',
        relativeDaysMin: 365,
        relativeDaysMax: 365,
        stepOrder: 15,
      },
      {
        journeyStage: JourneyStage.FOLLOW_UP,
        stepKey: 'ct_abdomen_annual',
        stepName: 'TC Abdome/Pelve Anual',
        stepDescription: 'Tomografia anual para vigilância de metástases',
        isRequired: true,
        dependsOnStepKey: 'colectomy',
        relativeDaysMin: 365,
        relativeDaysMax: 365,
        stepOrder: 16,
      },
      {
        journeyStage: JourneyStage.FOLLOW_UP,
        stepKey: 'colonoscopy_3years',
        stepName: 'Colonoscopia de Controle (3 anos)',
        stepDescription: 'Vigilância endoscópica pós-cirúrgica a 3 anos',
        isRequired: true,
        dependsOnStepKey: 'colectomy',
        relativeDaysMin: 1095,
        relativeDaysMax: 1095,
        stepOrder: 17,
      },
    ];
  }

  /**
   * Câncer de Mama — OCULTO no MVP (19 etapas, NCCN/ASCO/ESMO)
   */
  private getBreastStepConfigs(): StepConfig[] {
    return [
      {
        journeyStage: JourneyStage.SCREENING,
        stepKey: 'mammography',
        stepName: 'Mamografia',
        stepDescription: 'Exame de imagem para rastreio de lesões mamárias',
        isRequired: true,
        dependsOnStepKey: null,
        relativeDaysMin: null,
        relativeDaysMax: null,
        stepOrder: 1,
      },
      {
        journeyStage: JourneyStage.SCREENING,
        stepKey: 'clinical_suspicion',
        stepName: 'Suspeita Clínica',
        stepDescription:
          'Sintomas clínicos sugestivos (nódulo palpável, retração cutânea, descarga papilar). Complementar ao exame de rastreio — prazo de 30 dias para diagnóstico.',
        isRequired: false,
        dependsOnStepKey: null,
        relativeDaysMin: null,
        relativeDaysMax: null,
        stepOrder: 2,
      },
      {
        journeyStage: JourneyStage.SCREENING,
        stepKey: 'breast_ultrasound',
        stepName: 'USG de Mama',
        stepDescription: 'Ultrassonografia para complementação da mamografia',
        isRequired: false,
        dependsOnStepKey: 'mammography',
        relativeDaysMin: 0,
        relativeDaysMax: 14,
        stepOrder: 3,
      },
      {
        journeyStage: JourneyStage.DIAGNOSIS,
        stepKey: 'breast_biopsy',
        stepName: 'Biópsia de Mama',
        stepDescription: 'Biópsia percutânea para confirmação histológica. Prazo: até 30 dias após suspeita clínica ou exame de rastreio alterado.',
        isRequired: true,
        dependsOnStepKey: 'breast_ultrasound',
        relativeDaysMin: 0,
        relativeDaysMax: 30,
        stepOrder: 4,
      },
      {
        journeyStage: JourneyStage.DIAGNOSIS,
        stepKey: 'pathology_report',
        stepName: 'Laudo Anatomopatológico',
        stepDescription: 'Tipo histológico, grau, receptores hormonais (RE, RP, HER2)',
        isRequired: true,
        dependsOnStepKey: 'breast_biopsy',
        relativeDaysMin: 0,
        relativeDaysMax: 7,
        stepOrder: 5,
      },
      {
        journeyStage: JourneyStage.DIAGNOSIS,
        stepKey: 'breast_mri',
        stepName: 'RM de Mama',
        stepDescription: 'Ressonância magnética para avaliação de extensão local',
        isRequired: false,
        dependsOnStepKey: 'pathology_report',
        relativeDaysMin: 0,
        relativeDaysMax: 14,
        stepOrder: 6,
      },
      {
        journeyStage: JourneyStage.DIAGNOSIS,
        stepKey: 'staging_ct_thorax_abdomen',
        stepName: 'TC Tórax, Abdome e Pelve',
        stepDescription: 'Estadiamento sistêmico — avaliação de metástases',
        isRequired: true,
        dependsOnStepKey: 'pathology_report',
        relativeDaysMin: 0,
        relativeDaysMax: 14,
        stepOrder: 7,
      },
      {
        journeyStage: JourneyStage.DIAGNOSIS,
        stepKey: 'bone_scan',
        stepName: 'Cintilografia Óssea',
        stepDescription: 'Rastreio de metástases ósseas (paralelo ao TC)',
        isRequired: false,
        dependsOnStepKey: 'pathology_report',
        relativeDaysMin: 0,
        relativeDaysMax: 14,
        stepOrder: 8,
      },
      {
        journeyStage: JourneyStage.DIAGNOSIS,
        stepKey: 'genetic_counseling',
        stepName: 'Aconselhamento Genético',
        stepDescription: 'Avaliação de BRCA1/BRCA2 e outras mutações hereditárias',
        isRequired: false,
        dependsOnStepKey: 'pathology_report',
        relativeDaysMin: 14,
        relativeDaysMax: 30,
        stepOrder: 9,
      },
      {
        journeyStage: JourneyStage.TREATMENT,
        stepKey: 'surgical_evaluation',
        stepName: 'Avaliação Cirúrgica',
        stepDescription: 'Consulta com mastologista/oncologista para decisão cirúrgica',
        isRequired: true,
        dependsOnStepKey: 'staging_ct_thorax_abdomen',
        relativeDaysMin: 0,
        relativeDaysMax: 14,
        stepOrder: 10,
      },
      {
        journeyStage: JourneyStage.TREATMENT,
        stepKey: 'neoadjuvant_chemotherapy',
        stepName: 'QT Neoadjuvante',
        stepDescription: 'Quimioterapia pré-cirúrgica para redução tumoral (se indicada)',
        isRequired: false,
        dependsOnStepKey: 'surgical_evaluation',
        relativeDaysMin: 14,
        relativeDaysMax: 21,
        stepOrder: 11,
      },
      {
        journeyStage: JourneyStage.TREATMENT,
        stepKey: 'mastectomy_or_lumpectomy',
        stepName: 'Mastectomia ou Quadrantectomia',
        stepDescription: 'Ressecção cirúrgica do tumor mamário',
        isRequired: true,
        dependsOnStepKey: 'neoadjuvant_chemotherapy',
        relativeDaysMin: 14,
        relativeDaysMax: 35,
        stepOrder: 12,
      },
      {
        journeyStage: JourneyStage.TREATMENT,
        stepKey: 'sentinel_lymph_node',
        stepName: 'Biópsia de Linfonodo Sentinela',
        stepDescription: 'Avaliação do linfonodo sentinela — simultânea à cirurgia',
        isRequired: true,
        dependsOnStepKey: 'mastectomy_or_lumpectomy',
        relativeDaysMin: 0,
        relativeDaysMax: 0,
        stepOrder: 13,
      },
      {
        journeyStage: JourneyStage.TREATMENT,
        stepKey: 'adjuvant_chemotherapy',
        stepName: 'QT Adjuvante',
        stepDescription: 'Quimioterapia pós-cirúrgica (se indicada)',
        isRequired: false,
        dependsOnStepKey: 'mastectomy_or_lumpectomy',
        relativeDaysMin: 28,
        relativeDaysMax: 56,
        stepOrder: 14,
      },
      {
        journeyStage: JourneyStage.TREATMENT,
        stepKey: 'radiotherapy',
        stepName: 'Radioterapia',
        stepDescription: 'RT pós-cirúrgica ou pós-QT adjuvante',
        isRequired: false,
        dependsOnStepKey: 'mastectomy_or_lumpectomy',
        relativeDaysMin: 42,
        relativeDaysMax: 56,
        stepOrder: 15,
      },
      {
        journeyStage: JourneyStage.TREATMENT,
        stepKey: 'hormonal_therapy',
        stepName: 'Hormonioterapia',
        stepDescription: 'Terapia hormonal (tamoxifeno/inibidores de aromatase) se RE/RP+',
        isRequired: false,
        dependsOnStepKey: 'radiotherapy',
        relativeDaysMin: 0,
        relativeDaysMax: 14,
        stepOrder: 16,
      },
      {
        journeyStage: JourneyStage.TREATMENT,
        stepKey: 'targeted_therapy',
        stepName: 'Terapia Alvo (Trastuzumabe)',
        stepDescription: 'Trastuzumabe se HER2+ (paralelo à QT adjuvante)',
        isRequired: false,
        dependsOnStepKey: 'adjuvant_chemotherapy',
        relativeDaysMin: 0,
        relativeDaysMax: 0,
        stepOrder: 17,
      },
      {
        journeyStage: JourneyStage.FOLLOW_UP,
        stepKey: 'mammography_6months',
        stepName: 'Mamografia 6 meses',
        stepDescription: 'Mamografia de vigilância aos 6 meses pós-tratamento',
        isRequired: true,
        dependsOnStepKey: 'mastectomy_or_lumpectomy',
        relativeDaysMin: 180,
        relativeDaysMax: 180,
        stepOrder: 18,
      },
      {
        journeyStage: JourneyStage.FOLLOW_UP,
        stepKey: 'mammography_annual',
        stepName: 'Mamografia Anual',
        stepDescription: 'Mamografia anual de vigilância',
        isRequired: true,
        dependsOnStepKey: 'mastectomy_or_lumpectomy',
        relativeDaysMin: 365,
        relativeDaysMax: 365,
        stepOrder: 19,
      },
      {
        journeyStage: JourneyStage.FOLLOW_UP,
        stepKey: 'clinical_exam_6months',
        stepName: 'Exame Clínico 6 meses',
        stepDescription: 'Consulta clínica semestral para vigilância',
        isRequired: true,
        dependsOnStepKey: 'mastectomy_or_lumpectomy',
        relativeDaysMin: 180,
        relativeDaysMax: 180,
        stepOrder: 20,
      },
    ];
  }

  /**
   * Câncer de Pulmão — OCULTO no MVP (16 etapas, NCCN/IASLC)
   */
  private getLungStepConfigs(): StepConfig[] {
    return [
      {
        journeyStage: JourneyStage.SCREENING,
        stepKey: 'low_dose_ct',
        stepName: 'TC de Tórax Baixa Dose',
        stepDescription: 'Rastreio de nódulos pulmonares em fumantes de alto risco',
        isRequired: true,
        dependsOnStepKey: null,
        relativeDaysMin: null,
        relativeDaysMax: null,
        stepOrder: 1,
      },
      {
        journeyStage: JourneyStage.SCREENING,
        stepKey: 'clinical_suspicion',
        stepName: 'Suspeita Clínica',
        stepDescription:
          'Sintomas clínicos sugestivos (tosse persistente, hemoptise, dispneia, dor torácica). Complementar ao exame de rastreio — prazo de 30 dias para diagnóstico.',
        isRequired: false,
        dependsOnStepKey: null,
        relativeDaysMin: null,
        relativeDaysMax: null,
        stepOrder: 2,
      },
      {
        journeyStage: JourneyStage.DIAGNOSIS,
        stepKey: 'ct_thorax_contrast',
        stepName: 'TC de Tórax com Contraste',
        stepDescription: 'Caracterização detalhada da lesão pulmonar. Prazo: até 30 dias após suspeita clínica ou exame de rastreio alterado.',
        isRequired: true,
        dependsOnStepKey: 'low_dose_ct',
        relativeDaysMin: 0,
        relativeDaysMax: 30,
        stepOrder: 3,
      },
      {
        journeyStage: JourneyStage.DIAGNOSIS,
        stepKey: 'bronchoscopy_biopsy',
        stepName: 'Broncoscopia com Biópsia',
        stepDescription: 'Coleta de material para análise anatomopatológica',
        isRequired: true,
        dependsOnStepKey: 'ct_thorax_contrast',
        relativeDaysMin: 0,
        relativeDaysMax: 14,
        stepOrder: 4,
      },
      {
        journeyStage: JourneyStage.DIAGNOSIS,
        stepKey: 'pathology_report',
        stepName: 'Laudo Anatomopatológico',
        stepDescription: 'Tipo histológico (adenocarcinoma, escamoso, CPCP), grau',
        isRequired: true,
        dependsOnStepKey: 'bronchoscopy_biopsy',
        relativeDaysMin: 0,
        relativeDaysMax: 7,
        stepOrder: 5,
      },
      {
        journeyStage: JourneyStage.DIAGNOSIS,
        stepKey: 'pet_ct',
        stepName: 'PET-CT',
        stepDescription: 'Estadiamento metabólico e avaliação de acometimento linfonodal',
        isRequired: true,
        dependsOnStepKey: 'pathology_report',
        relativeDaysMin: 0,
        relativeDaysMax: 14,
        stepOrder: 6,
      },
      {
        journeyStage: JourneyStage.DIAGNOSIS,
        stepKey: 'molecular_testing',
        stepName: 'Testes Moleculares (EGFR, ALK, ROS1, PD-L1)',
        stepDescription: 'Perfil molecular para terapia alvo e imunoterapia (meta IASLC: 14 dias)',
        isRequired: true,
        dependsOnStepKey: 'pathology_report',
        relativeDaysMin: 0,
        relativeDaysMax: 14,
        stepOrder: 7,
      },
      {
        journeyStage: JourneyStage.DIAGNOSIS,
        stepKey: 'brain_mri',
        stepName: 'RM de Crânio',
        stepDescription: 'Avaliação de metástases cerebrais (paralelo ao PET-CT)',
        isRequired: false,
        dependsOnStepKey: 'pathology_report',
        relativeDaysMin: 0,
        relativeDaysMax: 14,
        stepOrder: 8,
      },
      {
        journeyStage: JourneyStage.TREATMENT,
        stepKey: 'surgical_evaluation',
        stepName: 'Avaliação Cirúrgica',
        stepDescription: 'Avaliação de ressecabilidade após estadiamento completo',
        isRequired: false,
        dependsOnStepKey: 'pet_ct',
        relativeDaysMin: 0,
        relativeDaysMax: 14,
        stepOrder: 9,
      },
      {
        journeyStage: JourneyStage.TREATMENT,
        stepKey: 'lobectomy_or_pneumonectomy',
        stepName: 'Lobectomia ou Pneumonectomia',
        stepDescription: 'Ressecção cirúrgica do tumor pulmonar',
        isRequired: false,
        dependsOnStepKey: 'surgical_evaluation',
        relativeDaysMin: 21,
        relativeDaysMax: 42,
        stepOrder: 10,
      },
      {
        journeyStage: JourneyStage.TREATMENT,
        stepKey: 'chemotherapy',
        stepName: 'Quimioterapia',
        stepDescription: 'QT adjuvante ou para doença inoperável/metastática',
        isRequired: false,
        dependsOnStepKey: 'lobectomy_or_pneumonectomy',
        relativeDaysMin: 42,
        relativeDaysMax: 56,
        stepOrder: 11,
      },
      {
        journeyStage: JourneyStage.TREATMENT,
        stepKey: 'radiotherapy',
        stepName: 'Radioterapia',
        stepDescription: 'RT concomitante à QT (se indicado)',
        isRequired: false,
        dependsOnStepKey: 'chemotherapy',
        relativeDaysMin: 0,
        relativeDaysMax: 0,
        stepOrder: 12,
      },
      {
        journeyStage: JourneyStage.TREATMENT,
        stepKey: 'targeted_therapy',
        stepName: 'Terapia Alvo',
        stepDescription: 'TKI (erlotinibe/osimertinibe se EGFR+, crizotinibe se ALK+)',
        isRequired: false,
        dependsOnStepKey: 'molecular_testing',
        relativeDaysMin: 0,
        relativeDaysMax: 21,
        stepOrder: 13,
      },
      {
        journeyStage: JourneyStage.TREATMENT,
        stepKey: 'immunotherapy',
        stepName: 'Imunoterapia',
        stepDescription: 'Pembrolizumabe ou nivolumabe (se PD-L1+)',
        isRequired: false,
        dependsOnStepKey: 'molecular_testing',
        relativeDaysMin: 0,
        relativeDaysMax: 21,
        stepOrder: 14,
      },
      {
        journeyStage: JourneyStage.FOLLOW_UP,
        stepKey: 'ct_thorax_3months',
        stepName: 'TC de Tórax 3 meses',
        stepDescription: 'Avaliação de resposta ao tratamento a 3 meses',
        isRequired: true,
        dependsOnStepKey: 'chemotherapy',
        relativeDaysMin: 90,
        relativeDaysMax: 90,
        stepOrder: 15,
      },
      {
        journeyStage: JourneyStage.FOLLOW_UP,
        stepKey: 'ct_thorax_6months',
        stepName: 'TC de Tórax 6 meses',
        stepDescription: 'Avaliação de resposta ao tratamento a 6 meses',
        isRequired: true,
        dependsOnStepKey: 'chemotherapy',
        relativeDaysMin: 180,
        relativeDaysMax: 180,
        stepOrder: 16,
      },
      {
        journeyStage: JourneyStage.FOLLOW_UP,
        stepKey: 'ct_thorax_annual',
        stepName: 'TC de Tórax Anual',
        stepDescription: 'Vigilância anual pós-tratamento',
        isRequired: true,
        dependsOnStepKey: 'chemotherapy',
        relativeDaysMin: 365,
        relativeDaysMax: 365,
        stepOrder: 17,
      },
    ];
  }

  /**
   * Câncer de Próstata — OCULTO no MVP (14 etapas, EAU/NCCN/CONITEC)
   */
  private getProstateStepConfigs(): StepConfig[] {
    return [
      {
        journeyStage: JourneyStage.SCREENING,
        stepKey: 'psa_test',
        stepName: 'Dosagem de PSA',
        stepDescription: 'Antígeno prostático específico — rastreio inicial',
        isRequired: true,
        dependsOnStepKey: null,
        relativeDaysMin: null,
        relativeDaysMax: null,
        stepOrder: 1,
      },
      {
        journeyStage: JourneyStage.SCREENING,
        stepKey: 'clinical_suspicion',
        stepName: 'Suspeita Clínica',
        stepDescription:
          'Sintomas clínicos sugestivos (disúria, jato fraco, noctúria, dor pélvica). Complementar ao exame de rastreio — prazo de 30 dias para diagnóstico.',
        isRequired: false,
        dependsOnStepKey: null,
        relativeDaysMin: null,
        relativeDaysMax: null,
        stepOrder: 2,
      },
      {
        journeyStage: JourneyStage.SCREENING,
        stepKey: 'digital_rectal_exam',
        stepName: 'Toque Retal',
        stepDescription: 'Exame digital retal — simultâneo ao PSA',
        isRequired: true,
        dependsOnStepKey: 'psa_test',
        relativeDaysMin: 0,
        relativeDaysMax: 0,
        stepOrder: 3,
      },
      {
        journeyStage: JourneyStage.DIAGNOSIS,
        stepKey: 'prostate_mri',
        stepName: 'RM Multiparamétrica de Próstata',
        stepDescription: 'Avaliação de lesões suspeitas (PI-RADS) antes da biópsia. Prazo: até 30 dias após suspeita clínica ou exame de rastreio alterado.',
        isRequired: false,
        dependsOnStepKey: 'psa_test',
        relativeDaysMin: 0,
        relativeDaysMax: 30,
        stepOrder: 4,
      },
      {
        journeyStage: JourneyStage.DIAGNOSIS,
        stepKey: 'prostate_biopsy',
        stepName: 'Biópsia de Próstata',
        stepDescription: 'Biópsia transretal ou transperineal guiada por imagem',
        isRequired: true,
        dependsOnStepKey: 'prostate_mri',
        relativeDaysMin: 0,
        relativeDaysMax: 30,
        stepOrder: 5,
      },
      {
        journeyStage: JourneyStage.DIAGNOSIS,
        stepKey: 'pathology_report',
        stepName: 'Laudo Anatomopatológico',
        stepDescription: 'Score de Gleason, estadiamento patológico',
        isRequired: true,
        dependsOnStepKey: 'prostate_biopsy',
        relativeDaysMin: 0,
        relativeDaysMax: 7,
        stepOrder: 6,
      },
      {
        journeyStage: JourneyStage.DIAGNOSIS,
        stepKey: 'bone_scan',
        stepName: 'Cintilografia Óssea',
        stepDescription: 'Avaliação de metástases ósseas (se Gleason ≥7 ou PSA >20)',
        isRequired: false,
        dependsOnStepKey: 'pathology_report',
        relativeDaysMin: 0,
        relativeDaysMax: 21,
        stepOrder: 7,
      },
      {
        journeyStage: JourneyStage.DIAGNOSIS,
        stepKey: 'ct_abdomen_pelvis',
        stepName: 'TC de Abdome e Pelve',
        stepDescription: 'Estadiamento linfonodal e abdominal (paralelo à cintilografia)',
        isRequired: false,
        dependsOnStepKey: 'pathology_report',
        relativeDaysMin: 0,
        relativeDaysMax: 21,
        stepOrder: 8,
      },
      {
        journeyStage: JourneyStage.TREATMENT,
        stepKey: 'treatment_decision',
        stepName: 'Decisão de Tratamento',
        stepDescription: 'Reunião multidisciplinar para definição da conduta terapêutica',
        isRequired: true,
        dependsOnStepKey: 'pathology_report',
        relativeDaysMin: 14,
        relativeDaysMax: 30,
        stepOrder: 9,
      },
      {
        journeyStage: JourneyStage.TREATMENT,
        stepKey: 'radical_prostatectomy',
        stepName: 'Prostatectomia Radical',
        stepDescription: 'Remoção cirúrgica da próstata',
        isRequired: false,
        dependsOnStepKey: 'treatment_decision',
        relativeDaysMin: 30,
        relativeDaysMax: 42,
        stepOrder: 10,
      },
      {
        journeyStage: JourneyStage.TREATMENT,
        stepKey: 'radiotherapy',
        stepName: 'Radioterapia',
        stepDescription: 'RT externa ou braquiterapia (alternativa à cirurgia)',
        isRequired: false,
        dependsOnStepKey: 'treatment_decision',
        relativeDaysMin: 30,
        relativeDaysMax: 42,
        stepOrder: 11,
      },
      {
        journeyStage: JourneyStage.TREATMENT,
        stepKey: 'hormonal_therapy',
        stepName: 'Hormonioterapia',
        stepDescription: 'Bloqueio androgênico (se indicado)',
        isRequired: false,
        dependsOnStepKey: 'treatment_decision',
        relativeDaysMin: 0,
        relativeDaysMax: 14,
        stepOrder: 12,
      },
      {
        journeyStage: JourneyStage.FOLLOW_UP,
        stepKey: 'psa_3months',
        stepName: 'PSA 3 meses',
        stepDescription: 'PSA pós-tratamento para avaliação de resposta',
        isRequired: true,
        dependsOnStepKey: 'radical_prostatectomy',
        relativeDaysMin: 42,
        relativeDaysMax: 90,
        stepOrder: 13,
      },
      {
        journeyStage: JourneyStage.FOLLOW_UP,
        stepKey: 'psa_6months',
        stepName: 'PSA 6 meses',
        stepDescription: 'PSA semestral de vigilância',
        isRequired: true,
        dependsOnStepKey: 'radical_prostatectomy',
        relativeDaysMin: 180,
        relativeDaysMax: 180,
        stepOrder: 14,
      },
      {
        journeyStage: JourneyStage.FOLLOW_UP,
        stepKey: 'psa_annual',
        stepName: 'PSA Anual',
        stepDescription: 'PSA anual de vigilância',
        isRequired: true,
        dependsOnStepKey: 'radical_prostatectomy',
        relativeDaysMin: 365,
        relativeDaysMax: 365,
        stepOrder: 15,
      },
    ];
  }

  /**
   * Câncer de Rim — OCULTO no MVP (13 etapas, EAU/NCCN)
   */
  private getKidneyStepConfigs(): StepConfig[] {
    return [
      {
        journeyStage: JourneyStage.SCREENING,
        stepKey: 'abdominal_ultrasound',
        stepName: 'USG de Abdome',
        stepDescription: 'Avaliação inicial de lesões renais',
        isRequired: true,
        dependsOnStepKey: null,
        relativeDaysMin: null,
        relativeDaysMax: null,
        stepOrder: 1,
      },
      {
        journeyStage: JourneyStage.SCREENING,
        stepKey: 'clinical_suspicion',
        stepName: 'Suspeita Clínica',
        stepDescription:
          'Sintomas clínicos sugestivos (hematúria, dor lombar, massa palpável). Complementar ao exame de rastreio — prazo de 30 dias para diagnóstico.',
        isRequired: false,
        dependsOnStepKey: null,
        relativeDaysMin: null,
        relativeDaysMax: null,
        stepOrder: 2,
      },
      {
        journeyStage: JourneyStage.DIAGNOSIS,
        stepKey: 'ct_abdomen_contrast',
        stepName: 'TC de Abdome com Contraste',
        stepDescription: 'Caracterização da lesão renal — avaliação de vascularização. Prazo: até 30 dias após suspeita clínica ou exame de rastreio alterado.',
        isRequired: true,
        dependsOnStepKey: 'abdominal_ultrasound',
        relativeDaysMin: 0,
        relativeDaysMax: 30,
        stepOrder: 3,
      },
      {
        journeyStage: JourneyStage.DIAGNOSIS,
        stepKey: 'ct_thorax',
        stepName: 'TC de Tórax',
        stepDescription: 'Avaliação de metástases pulmonares (paralelo ao TC abdome)',
        isRequired: true,
        dependsOnStepKey: 'abdominal_ultrasound',
        relativeDaysMin: 0,
        relativeDaysMax: 21,
        stepOrder: 4,
      },
      {
        journeyStage: JourneyStage.DIAGNOSIS,
        stepKey: 'biopsy_or_surgery',
        stepName: 'Biópsia ou Cirurgia Diagnóstica',
        stepDescription: 'Confirmação histológica por biópsia percutânea ou cirurgia',
        isRequired: true,
        dependsOnStepKey: 'ct_abdomen_contrast',
        relativeDaysMin: 0,
        relativeDaysMax: 21,
        stepOrder: 5,
      },
      {
        journeyStage: JourneyStage.DIAGNOSIS,
        stepKey: 'pathology_report',
        stepName: 'Laudo Anatomopatológico',
        stepDescription: 'Tipo histológico (carcinoma células claras, papilar, cromófobo)',
        isRequired: true,
        dependsOnStepKey: 'biopsy_or_surgery',
        relativeDaysMin: 0,
        relativeDaysMax: 7,
        stepOrder: 6,
      },
      {
        journeyStage: JourneyStage.DIAGNOSIS,
        stepKey: 'bone_scan',
        stepName: 'Cintilografia Óssea',
        stepDescription: 'Avaliação de metástases ósseas (se sintomas)',
        isRequired: false,
        dependsOnStepKey: 'pathology_report',
        relativeDaysMin: 0,
        relativeDaysMax: 14,
        stepOrder: 7,
      },
      {
        journeyStage: JourneyStage.TREATMENT,
        stepKey: 'surgical_evaluation',
        stepName: 'Avaliação Cirúrgica',
        stepDescription: 'Planejamento para nefrectomia parcial ou radical',
        isRequired: true,
        dependsOnStepKey: 'pathology_report',
        relativeDaysMin: 0,
        relativeDaysMax: 14,
        stepOrder: 8,
      },
      {
        journeyStage: JourneyStage.TREATMENT,
        stepKey: 'partial_or_radical_nephrectomy',
        stepName: 'Nefrectomia Parcial ou Radical',
        stepDescription: 'Ressecção cirúrgica do rim ou parte dele',
        isRequired: true,
        dependsOnStepKey: 'surgical_evaluation',
        relativeDaysMin: 30,
        relativeDaysMax: 42,
        stepOrder: 9,
      },
      {
        journeyStage: JourneyStage.TREATMENT,
        stepKey: 'targeted_therapy',
        stepName: 'Terapia Alvo',
        stepDescription: 'Inibidores de VEGFR/mTOR (sunitinibe, pazopanibe) se indicado',
        isRequired: false,
        dependsOnStepKey: 'partial_or_radical_nephrectomy',
        relativeDaysMin: 28,
        relativeDaysMax: 42,
        stepOrder: 10,
      },
      {
        journeyStage: JourneyStage.TREATMENT,
        stepKey: 'immunotherapy',
        stepName: 'Imunoterapia',
        stepDescription: 'Nivolumabe/ipilimumabe (combinação) se indicado',
        isRequired: false,
        dependsOnStepKey: 'partial_or_radical_nephrectomy',
        relativeDaysMin: 28,
        relativeDaysMax: 42,
        stepOrder: 11,
      },
      {
        journeyStage: JourneyStage.FOLLOW_UP,
        stepKey: 'ct_abdomen_3months',
        stepName: 'TC Abdome 3 meses',
        stepDescription: 'Avaliação de resposta e vigilância precoce',
        isRequired: true,
        dependsOnStepKey: 'partial_or_radical_nephrectomy',
        relativeDaysMin: 90,
        relativeDaysMax: 90,
        stepOrder: 12,
      },
      {
        journeyStage: JourneyStage.FOLLOW_UP,
        stepKey: 'ct_abdomen_6months',
        stepName: 'TC Abdome 6 meses',
        stepDescription: 'Vigilância semestral pós-nefrectomia',
        isRequired: true,
        dependsOnStepKey: 'partial_or_radical_nephrectomy',
        relativeDaysMin: 180,
        relativeDaysMax: 180,
        stepOrder: 13,
      },
      {
        journeyStage: JourneyStage.FOLLOW_UP,
        stepKey: 'ct_abdomen_annual',
        stepName: 'TC Abdome Anual',
        stepDescription: 'Vigilância anual pós-nefrectomia',
        isRequired: true,
        dependsOnStepKey: 'partial_or_radical_nephrectomy',
        relativeDaysMin: 365,
        relativeDaysMax: 365,
        stepOrder: 14,
      },
    ];
  }

  /**
   * Câncer de Testículo — OCULTO no MVP (13 etapas, EAU/NCCN — prazos mais curtos, urgência)
   */
  private getTesticularStepConfigs(): StepConfig[] {
    return [
      {
        journeyStage: JourneyStage.SCREENING,
        stepKey: 'testicular_ultrasound',
        stepName: 'USG de Testículo',
        stepDescription: 'Avaliação urgente de massa testicular',
        isRequired: true,
        dependsOnStepKey: null,
        relativeDaysMin: null,
        relativeDaysMax: null,
        stepOrder: 1,
      },
      {
        journeyStage: JourneyStage.SCREENING,
        stepKey: 'clinical_suspicion',
        stepName: 'Suspeita Clínica',
        stepDescription:
          'Sintomas clínicos sugestivos (massa testicular palpável, dor escrotal, ginecomastia). Complementar ao exame de rastreio — prazo de 30 dias para diagnóstico.',
        isRequired: false,
        dependsOnStepKey: null,
        relativeDaysMin: null,
        relativeDaysMax: null,
        stepOrder: 2,
      },
      {
        journeyStage: JourneyStage.DIAGNOSIS,
        stepKey: 'radical_orchiectomy',
        stepName: 'Orquiectomia Radical',
        stepDescription: 'Remoção cirúrgica do testículo afetado — diagnóstico e tratamento inicial (URGENTE). Prazo: até 30 dias após suspeita clínica ou exame de rastreio alterado.',
        isRequired: true,
        dependsOnStepKey: 'testicular_ultrasound',
        relativeDaysMin: 7,
        relativeDaysMax: 30,
        stepOrder: 3,
      },
      {
        journeyStage: JourneyStage.DIAGNOSIS,
        stepKey: 'pathology_report',
        stepName: 'Laudo Anatomopatológico',
        stepDescription: 'Tipo histológico (seminoma vs não-seminoma), invasão vascular',
        isRequired: true,
        dependsOnStepKey: 'radical_orchiectomy',
        relativeDaysMin: 0,
        relativeDaysMax: 7,
        stepOrder: 4,
      },
      {
        journeyStage: JourneyStage.DIAGNOSIS,
        stepKey: 'tumor_markers',
        stepName: 'Marcadores Tumorais (AFP, HCG, LDH)',
        stepDescription: 'Marcadores séricos — paralelo ao anatomopatológico',
        isRequired: true,
        dependsOnStepKey: 'radical_orchiectomy',
        relativeDaysMin: 0,
        relativeDaysMax: 7,
        stepOrder: 5,
      },
      {
        journeyStage: JourneyStage.DIAGNOSIS,
        stepKey: 'ct_abdomen_pelvis',
        stepName: 'TC de Abdome e Pelve',
        stepDescription: 'Estadiamento retroperitoneal e abdominal',
        isRequired: true,
        dependsOnStepKey: 'radical_orchiectomy',
        relativeDaysMin: 0,
        relativeDaysMax: 14,
        stepOrder: 6,
      },
      {
        journeyStage: JourneyStage.DIAGNOSIS,
        stepKey: 'ct_thorax',
        stepName: 'TC de Tórax',
        stepDescription: 'Avaliação de metástases pulmonares (paralelo ao TC abdome)',
        isRequired: true,
        dependsOnStepKey: 'radical_orchiectomy',
        relativeDaysMin: 0,
        relativeDaysMax: 14,
        stepOrder: 7,
      },
      {
        journeyStage: JourneyStage.TREATMENT,
        stepKey: 'retroperitoneal_lymph_node_dissection',
        stepName: 'Linfadenectomia Retroperitoneal',
        stepDescription: 'LNRP — para estadio II de não-seminoma',
        isRequired: false,
        dependsOnStepKey: 'pathology_report',
        relativeDaysMin: 14,
        relativeDaysMax: 28,
        stepOrder: 8,
      },
      {
        journeyStage: JourneyStage.TREATMENT,
        stepKey: 'chemotherapy',
        stepName: 'Quimioterapia',
        stepDescription: 'BEP (bleomicina, etoposídeo, cisplatina) se indicado',
        isRequired: false,
        dependsOnStepKey: 'pathology_report',
        relativeDaysMin: 7,
        relativeDaysMax: 21,
        stepOrder: 9,
      },
      {
        journeyStage: JourneyStage.TREATMENT,
        stepKey: 'radiotherapy',
        stepName: 'Radioterapia',
        stepDescription: 'RT para seminoma estádio II (alternativa à QT)',
        isRequired: false,
        dependsOnStepKey: 'pathology_report',
        relativeDaysMin: 14,
        relativeDaysMax: 28,
        stepOrder: 10,
      },
      {
        journeyStage: JourneyStage.FOLLOW_UP,
        stepKey: 'tumor_markers_1month',
        stepName: 'Marcadores 1 mês',
        stepDescription: 'AFP, HCG e LDH pós-tratamento para avaliação de resposta',
        isRequired: true,
        dependsOnStepKey: 'chemotherapy',
        relativeDaysMin: 30,
        relativeDaysMax: 30,
        stepOrder: 11,
      },
      {
        journeyStage: JourneyStage.FOLLOW_UP,
        stepKey: 'ct_abdomen_3months',
        stepName: 'TC Abdome 3 meses',
        stepDescription: 'Avaliação de resposta ao tratamento',
        isRequired: true,
        dependsOnStepKey: 'chemotherapy',
        relativeDaysMin: 90,
        relativeDaysMax: 90,
        stepOrder: 12,
      },
      {
        journeyStage: JourneyStage.FOLLOW_UP,
        stepKey: 'ct_abdomen_6months',
        stepName: 'TC Abdome 6 meses',
        stepDescription: 'Vigilância semestral pós-tratamento',
        isRequired: true,
        dependsOnStepKey: 'chemotherapy',
        relativeDaysMin: 180,
        relativeDaysMax: 180,
        stepOrder: 13,
      },
      {
        journeyStage: JourneyStage.FOLLOW_UP,
        stepKey: 'ct_abdomen_annual',
        stepName: 'TC Abdome Anual',
        stepDescription: 'Vigilância anual pós-tratamento',
        isRequired: true,
        dependsOnStepKey: 'chemotherapy',
        relativeDaysMin: 365,
        relativeDaysMax: 365,
        stepOrder: 14,
      },
    ];
  }

  /**
   * Tipo genérico — fallback para tipos de câncer não mapeados especificamente
   */
  private getGenericStepConfigs(): StepConfig[] {
    return [
      {
        journeyStage: JourneyStage.SCREENING,
        stepKey: 'initial_evaluation',
        stepName: 'Avaliação Inicial',
        stepDescription: 'Avaliação clínica inicial e triagem oncológica',
        isRequired: true,
        dependsOnStepKey: null,
        relativeDaysMin: null,
        relativeDaysMax: null,
        stepOrder: 1,
      },
      {
        journeyStage: JourneyStage.SCREENING,
        stepKey: 'clinical_suspicion',
        stepName: 'Suspeita Clínica',
        stepDescription:
          'Sintomas clínicos sugestivos de neoplasia. Complementar ao exame de rastreio — prazo de 30 dias para diagnóstico.',
        isRequired: false,
        dependsOnStepKey: null,
        relativeDaysMin: null,
        relativeDaysMax: null,
        stepOrder: 2,
      },
      {
        journeyStage: JourneyStage.DIAGNOSIS,
        stepKey: 'biopsy',
        stepName: 'Biópsia',
        stepDescription: 'Coleta de material para análise anatomopatológica. Prazo: até 30 dias após suspeita clínica ou exame de rastreio alterado.',
        isRequired: true,
        dependsOnStepKey: 'initial_evaluation',
        relativeDaysMin: 0,
        relativeDaysMax: 30,
        stepOrder: 3,
      },
      {
        journeyStage: JourneyStage.DIAGNOSIS,
        stepKey: 'pathology_report',
        stepName: 'Laudo Anatomopatológico',
        stepDescription: 'Confirmação do diagnóstico oncológico',
        isRequired: true,
        dependsOnStepKey: 'biopsy',
        relativeDaysMin: 0,
        relativeDaysMax: 7,
        stepOrder: 4,
      },
      {
        journeyStage: JourneyStage.DIAGNOSIS,
        stepKey: 'staging_imaging',
        stepName: 'Exames de Estadiamento',
        stepDescription: 'Tomografia e/ou PET-CT para estadiamento',
        isRequired: true,
        dependsOnStepKey: 'pathology_report',
        relativeDaysMin: 0,
        relativeDaysMax: 14,
        stepOrder: 5,
      },
      {
        journeyStage: JourneyStage.TREATMENT,
        stepKey: 'treatment_planning',
        stepName: 'Planejamento de Tratamento',
        stepDescription: 'Decisão multidisciplinar sobre conduta terapêutica',
        isRequired: true,
        dependsOnStepKey: 'staging_imaging',
        relativeDaysMin: 0,
        relativeDaysMax: 14,
        stepOrder: 6,
      },
      {
        journeyStage: JourneyStage.TREATMENT,
        stepKey: 'first_treatment',
        stepName: 'Início do Tratamento',
        stepDescription: 'Primeiro tratamento oncológico (cirurgia, QT, RT ou combinação)',
        isRequired: true,
        dependsOnStepKey: 'treatment_planning',
        relativeDaysMin: 0,
        relativeDaysMax: 30,
        stepOrder: 7,
      },
      {
        journeyStage: JourneyStage.FOLLOW_UP,
        stepKey: 'follow_up_3months',
        stepName: 'Seguimento 3 meses',
        stepDescription: 'Avaliação de resposta pós-tratamento',
        isRequired: true,
        dependsOnStepKey: 'first_treatment',
        relativeDaysMin: 90,
        relativeDaysMax: 90,
        stepOrder: 8,
      },
      {
        journeyStage: JourneyStage.FOLLOW_UP,
        stepKey: 'follow_up_annual',
        stepName: 'Seguimento Anual',
        stepDescription: 'Vigilância anual pós-tratamento',
        isRequired: true,
        dependsOnStepKey: 'first_treatment',
        relativeDaysMin: 365,
        relativeDaysMax: 365,
        stepOrder: 9,
      },
    ];
  }

  /**
   * Cuidados Paliativos — ativo quando patient.status === PALLIATIVE_CARE
   * Etapas com journeyStage PALLIATIVE — transversal a qualquer tipo de câncer.
   * T+0 = data de transição para cuidados paliativos.
   */
  private getPalliativeStepConfigs(): StepConfig[] {
    return [
      {
        journeyStage: JourneyStage.PALLIATIVE,
        stepKey: 'palliative_comfort_care',
        stepName: 'Cuidados de Conforto',
        stepDescription: 'Início imediato de cuidados de conforto — controle de dor, dispneia e outros sintomas',
        isRequired: true,
        dependsOnStepKey: null,
        relativeDaysMin: null,
        relativeDaysMax: null,
        stepOrder: 1,
      },
      {
        journeyStage: JourneyStage.PALLIATIVE,
        stepKey: 'palliative_symptom_assessment',
        stepName: 'Avaliação de Sintomas',
        stepDescription: 'Avaliação sistemática de sintomas (ESAS ou Edmonton Symptom Assessment)',
        isRequired: true,
        dependsOnStepKey: 'palliative_comfort_care',
        relativeDaysMin: 3,
        relativeDaysMax: 7,
        stepOrder: 2,
      },
      {
        journeyStage: JourneyStage.PALLIATIVE,
        stepKey: 'palliative_medication_review',
        stepName: 'Revisão de Medicação',
        stepDescription: 'Revisão e ajuste do esquema medicamentoso para conforto',
        isRequired: true,
        dependsOnStepKey: 'palliative_comfort_care',
        relativeDaysMin: 0,
        relativeDaysMax: 7,
        stepOrder: 3,
      },
      {
        journeyStage: JourneyStage.PALLIATIVE,
        stepKey: 'palliative_quality_of_life_assessment',
        stepName: 'Avaliação de Qualidade de Vida',
        stepDescription: 'Instrumento padronizado de avaliação de qualidade de vida (FACT-G ou similar)',
        isRequired: true,
        dependsOnStepKey: 'palliative_symptom_assessment',
        relativeDaysMin: 0,
        relativeDaysMax: 7,
        stepOrder: 4,
      },
      {
        journeyStage: JourneyStage.PALLIATIVE,
        stepKey: 'palliative_family_support_assessment',
        stepName: 'Avaliação de Suporte Familiar',
        stepDescription: 'Avaliação das necessidades de suporte à família e cuidadores',
        isRequired: true,
        dependsOnStepKey: 'palliative_comfort_care',
        relativeDaysMin: 0,
        relativeDaysMax: 7,
        stepOrder: 5,
      },
      {
        journeyStage: JourneyStage.PALLIATIVE,
        stepKey: 'palliative_multidisciplinary_team',
        stepName: 'Coordenação Equipe Multidisciplinar',
        stepDescription: 'Reunião multidisciplinar: oncologia, paliativismo, psicologia, nutrição, enfermagem',
        isRequired: true,
        dependsOnStepKey: 'palliative_comfort_care',
        relativeDaysMin: 0,
        relativeDaysMax: 14,
        stepOrder: 6,
      },
      {
        journeyStage: JourneyStage.PALLIATIVE,
        stepKey: 'palliative_nutritional_assessment',
        stepName: 'Avaliação Nutricional',
        stepDescription: 'Avaliação nutricional e planejamento de suporte nutricional paliativo',
        isRequired: true,
        dependsOnStepKey: 'palliative_comfort_care',
        relativeDaysMin: 0,
        relativeDaysMax: 14,
        stepOrder: 7,
      },
      {
        journeyStage: JourneyStage.PALLIATIVE,
        stepKey: 'palliative_advance_care_planning',
        stepName: 'Planejamento de Cuidados Avançados',
        stepDescription: 'Discussão de diretivas antecipadas de vontade e planejamento de cuidados',
        isRequired: false,
        dependsOnStepKey: 'palliative_comfort_care',
        relativeDaysMin: 0,
        relativeDaysMax: 30,
        stepOrder: 8,
      },
      {
        journeyStage: JourneyStage.PALLIATIVE,
        stepKey: 'palliative_spiritual_support',
        stepName: 'Avaliação Espiritual',
        stepDescription: 'Avaliação e suporte às necessidades espirituais e existenciais',
        isRequired: false,
        dependsOnStepKey: 'palliative_comfort_care',
        relativeDaysMin: 0,
        relativeDaysMax: 30,
        stepOrder: 9,
      },
    ];
  }

  /**
   * Ao concluir um step, cria os steps da PRÓXIMA fase se ainda não existirem.
   * Ex: completar um step de SCREENING → cria steps de DIAGNOSIS para o cascade funcionar.
   */
  private async maybeCreateNextStageSteps(
    completedStep: NavigationStep,
    tenantId: string
  ): Promise<void> {
    const STAGE_PROGRESSION: Partial<Record<JourneyStage, JourneyStage>> = {
      [JourneyStage.SCREENING]: JourneyStage.DIAGNOSIS,
      [JourneyStage.DIAGNOSIS]: JourneyStage.TREATMENT,
      [JourneyStage.TREATMENT]: JourneyStage.FOLLOW_UP,
    };

    const nextStage =
      STAGE_PROGRESSION[completedStep.journeyStage as JourneyStage];
    if (!nextStage) { return; }

    const existingCount = await this.prisma.navigationStep.count({
      where: {
        patientId: completedStep.patientId,
        tenantId,
        journeyStage: nextStage,
      },
    });

    if (existingCount === 0) {
      try {
        await this.createMissingStepsForStage(
          completedStep.patientId,
          tenantId,
          nextStage
        );
        this.logger.log(
          `Criadas etapas de ${nextStage} para paciente ${completedStep.patientId} após conclusão de ${completedStep.stepKey}`
        );
      } catch (error) {
        this.logger.warn(
          `Falha ao criar etapas de ${nextStage}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }

  /**
   * Cascateia datas para etapas que dependem da etapa concluída.
   * Chamado após marcar uma etapa como completa.
   */
  private async cascadeDependentStepDates(
    completedStep: NavigationStep,
    tenantId: string
  ): Promise<void> {
    const actualDate =
      completedStep.actualDate || completedStep.completedAt || new Date();

    // Buscar etapas do mesmo paciente que dependem desta etapa
    const dependentSteps = await this.prisma.navigationStep.findMany({
      where: {
        patientId: completedStep.patientId,
        tenantId,
        dependsOnStepKey: completedStep.stepKey,
        status: {
          notIn: [
            NavigationStepStatus.COMPLETED,
            NavigationStepStatus.NOT_APPLICABLE,
            NavigationStepStatus.CANCELLED,
          ],
        },
      } as any,
    });

    for (const dep of dependentSteps) {
      const updateData: Prisma.NavigationStepUpdateInput = {};
      const depAny = dep as any;

      if (depAny.relativeDaysMin !== null && depAny.relativeDaysMin !== undefined) {
        updateData.expectedDate = this.addDays(
          new Date(actualDate),
          depAny.relativeDaysMin
        );
      }
      if (depAny.relativeDaysMax !== null && depAny.relativeDaysMax !== undefined) {
        updateData.dueDate = this.addDays(
          new Date(actualDate),
          depAny.relativeDaysMax
        );
      }
      if (dep.status === NavigationStepStatus.PENDING) {
        updateData.status = NavigationStepStatus.IN_PROGRESS;
      }

      if (Object.keys(updateData).length > 0) {
        await this.prisma.navigationStep.update({
          where: { id: dep.id, tenantId },
          data: updateData,
        });
        this.logger.log(
          `Cascade: etapa ${dep.stepKey} → expectedDate=${(updateData.expectedDate as Date | undefined)?.toISOString()?.slice(0, 10)}, dueDate=${(updateData.dueDate as Date | undefined)?.toISOString()?.slice(0, 10)}`
        );
      }
    }

    // Caso especial: suspeita clínica é via alternativa ao exame de rastreio.
    // Ao completar clinical_suspicion, atualizar a primeira etapa de DIAGNOSIS
    // que não esteja concluída/cancelada. Atualiza mesmo se já tiver datas (re-marcar).
    // Prazo legal: 30 dias para diagnóstico após suspeita clínica.
    if (completedStep.stepKey === 'clinical_suspicion') {
      const firstDiagnosisStep = await this.prisma.navigationStep.findFirst({
        where: {
          patientId: completedStep.patientId,
          tenantId,
          journeyStage: JourneyStage.DIAGNOSIS,
          isCompleted: false,
          status: {
            notIn: [
              NavigationStepStatus.COMPLETED,
              NavigationStepStatus.NOT_APPLICABLE,
              NavigationStepStatus.CANCELLED,
            ],
          },
        },
        orderBy: { stepOrder: 'asc' } as any,
      });

      if (firstDiagnosisStep) {
        const baseDate = new Date(actualDate);
        const existingMeta =
          (firstDiagnosisStep.metadata as Record<string, unknown>) ?? {};
        await this.prisma.navigationStep.update({
          where: { id: firstDiagnosisStep.id, tenantId },
          data: {
            expectedDate: this.addDays(baseDate, 14),
            dueDate: this.addDays(baseDate, 30),
            status: NavigationStepStatus.IN_PROGRESS,
            metadata: { ...existingMeta, unlockedBy: 'clinical_suspicion' },
          },
        });
        this.logger.log(
          `Cascade: clinical_suspicion → ${firstDiagnosisStep.stepKey} desbloqueada (prazo 30d)`,
        );
      }
    }

    // Caso especial: follow-up de bexiga dependem de BCG OU cistectomia.
    // Se a etapa concluída é radical_cystectomy e o BCG está NOT_APPLICABLE,
    // reatribuir o cascade das etapas de follow-up que dependiam de intravesical_bcg.
    if (
      completedStep.stepKey === 'radical_cystectomy' &&
      completedStep.cancerType === 'bladder'
    ) {
      await this.cascadeFollowUpFromAlternative(
        completedStep,
        tenantId,
        'intravesical_bcg',
        actualDate
      );
    }
    // Simetria: se BCG conclui e cistectomia está NOT_APPLICABLE
    if (
      completedStep.stepKey === 'intravesical_bcg' &&
      completedStep.cancerType === 'bladder'
    ) {
      await this.cascadeFollowUpFromAlternative(
        completedStep,
        tenantId,
        'radical_cystectomy',
        actualDate
      );
    }
  }

  /**
   * Para follow-ups de bexiga que dependem de uma etapa alternativa (BCG ou cistectomia),
   * atualiza datas usando a etapa realmente concluída como referência.
   */
  private async cascadeFollowUpFromAlternative(
    completedStep: NavigationStep,
    tenantId: string,
    alternativeStepKey: string,
    actualDate: Date | string
  ): Promise<void> {
    // Verificar se a etapa alternativa está NOT_APPLICABLE
    const altStep = await this.prisma.navigationStep.findFirst({
      where: {
        patientId: completedStep.patientId,
        tenantId,
        stepKey: alternativeStepKey,
        status: NavigationStepStatus.NOT_APPLICABLE,
      },
    });

    if (!altStep) {return;}

    // Reatribuir datas dos follow-ups que dependiam da etapa alternativa
    const dependentSteps = await this.prisma.navigationStep.findMany({
      where: {
        patientId: completedStep.patientId,
        tenantId,
        dependsOnStepKey: alternativeStepKey,
        status: {
          notIn: [
            NavigationStepStatus.COMPLETED,
            NavigationStepStatus.NOT_APPLICABLE,
            NavigationStepStatus.CANCELLED,
          ],
        },
      } as any,
    });

    for (const dep of dependentSteps) {
      const updateData: Prisma.NavigationStepUpdateInput = {};
      const depAny = dep as any;
      if (depAny.relativeDaysMin !== null && depAny.relativeDaysMin !== undefined) {
        updateData.expectedDate = this.addDays(
          new Date(actualDate),
          depAny.relativeDaysMin
        );
      }
      if (depAny.relativeDaysMax !== null && depAny.relativeDaysMax !== undefined) {
        updateData.dueDate = this.addDays(
          new Date(actualDate),
          depAny.relativeDaysMax
        );
      }
      if (dep.status === NavigationStepStatus.PENDING) {
        updateData.status = NavigationStepStatus.IN_PROGRESS;
      }
      if (Object.keys(updateData).length > 0) {
        await this.prisma.navigationStep.update({
          where: { id: dep.id, tenantId },
          data: updateData,
        });
      }
    }
  }

  /**
   * Reseta datas de etapas dependentes quando uma etapa é desmarcada como concluída.
   */
  private async resetDependentStepDates(
    uncompletedStep: NavigationStep,
    tenantId: string
  ): Promise<void> {
    const dependentSteps = await this.prisma.navigationStep.findMany({
      where: {
        patientId: uncompletedStep.patientId,
        tenantId,
        dependsOnStepKey: uncompletedStep.stepKey,
        status: {
          in: [NavigationStepStatus.PENDING, NavigationStepStatus.IN_PROGRESS],
        },
        isCompleted: false,
      } as any,
    });

    for (const dep of dependentSteps) {
      await this.prisma.navigationStep.update({
        where: { id: dep.id, tenantId },
        data: {
          expectedDate: null,
          dueDate: null,
          status: NavigationStepStatus.PENDING,
        },
      });
    }

    // Caso especial: clinical_suspicion desbloqueia a primeira etapa de DIAGNOSIS
    // usando metadata.unlockedBy como marcador (sem poluir o campo notes visível)
    if (uncompletedStep.stepKey === 'clinical_suspicion') {
      const unlockedByCS = await this.prisma.navigationStep.findMany({
        where: {
          patientId: uncompletedStep.patientId,
          tenantId,
          journeyStage: JourneyStage.DIAGNOSIS,
          isCompleted: false,
          status: {
            in: [NavigationStepStatus.PENDING, NavigationStepStatus.IN_PROGRESS],
          },
          metadata: { path: ['unlockedBy'], equals: 'clinical_suspicion' },
        },
      });

      for (const step of unlockedByCS) {
        const meta = (step.metadata as Record<string, unknown>) ?? {};
        const { unlockedBy: _removed, ...restMeta } = meta;
        await this.prisma.navigationStep.update({
          where: { id: step.id, tenantId },
          data: {
            expectedDate: null,
            dueDate: null,
            status: NavigationStepStatus.PENDING,
            metadata: Object.keys(restMeta).length > 0 ? (restMeta as Prisma.JsonObject) : null,
          },
        });
      }
    }
  }

  /**
   * Determina severidade do alerta baseado na etapa
   */
  private getSeverityForStep(step: NavigationStep): AlertSeverity {
    // Etapas críticas de diagnóstico, tratamento e paliativos são HIGH ou CRITICAL
    if (
      step.journeyStage === JourneyStage.DIAGNOSIS ||
      step.journeyStage === JourneyStage.TREATMENT ||
      step.journeyStage === JourneyStage.PALLIATIVE
    ) {
      if (step.isRequired) {
        const daysOverdue = Math.floor(
          (new Date().getTime() - step.dueDate!.getTime()) /
            (1000 * 60 * 60 * 24)
        );
        return daysOverdue > 14 ? AlertSeverity.CRITICAL : AlertSeverity.HIGH;
      }
      return AlertSeverity.MEDIUM;
    }

    // Etapas de rastreio e seguimento são MEDIUM ou LOW
    if (step.isRequired) {
      return AlertSeverity.MEDIUM;
    }
    return AlertSeverity.LOW;
  }

  /**
   * Helper: adiciona dias a uma data
   */
  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }
}
