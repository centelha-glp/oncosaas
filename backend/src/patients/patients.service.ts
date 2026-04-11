import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
  Logger,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePatientDto, Gender, CancerType } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { UpdatePriorityDto } from './dto/update-priority.dto';
import { ImportPatientRowDto } from './dto/import-patients.dto';
import { ImportSpreadsheetRowDto } from './dto/import-spreadsheet.dto';
import { PatientDetailResponse } from './dto/patient-detail-response.dto';
import { CreateCancerDiagnosisDto } from './dto/create-cancer-diagnosis.dto';
import { UpdateCancerDiagnosisDto } from './dto/update-cancer-diagnosis.dto';
import { Patient, Prisma, JourneyStage } from '@generated/prisma/client';
import { OncologyNavigationService } from '../oncology-navigation/oncology-navigation.service';
import { PriorityRecalculationService } from '../oncology-navigation/priority-recalculation.service';
import {
  normalizePhoneNumber,
  hashPhoneNumber,
} from '../common/utils/phone.util';
import * as csv from 'csv-parser';
import { Readable } from 'stream';
import { ComorbiditiesService } from '../comorbidities/comorbidities.service';
import { MedicationsService } from '../medications/medications.service';
import { normalizeAllergyEntriesForStorage } from './patient-clinical-json.util';

type PatientWithDiagnoses = Prisma.PatientGetPayload<{
  include: {
    cancerDiagnoses: true;
  };
}>;

@Injectable()
export class PatientsService {
  private readonly logger = new Logger(PatientsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => OncologyNavigationService))
    private readonly navigationService?: OncologyNavigationService,
    private readonly priorityRecalculationService?: PriorityRecalculationService,
    @Optional() private readonly comorbiditiesService?: ComorbiditiesService,
    @Optional() private readonly medicationsService?: MedicationsService
  ) {}

  /**
   * Retorna os tipos de câncer habilitados para o tenant.
   * Lê de tenant.settings.enabledCancerTypes. Default MVP: ['bladder'].
   */
  private async getEnabledCancerTypes(tenantId: string): Promise<string[]> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });
    const settings = tenant?.settings as Record<string, unknown> | null;
    const enabled = settings?.enabledCancerTypes;
    if (Array.isArray(enabled) && enabled.length > 0) {
      return enabled.map((t: unknown) => String(t).toLowerCase());
    }
    return ['bladder']; // Default MVP
  }

  /**
   * Valida se um tipo de câncer está habilitado para o tenant.
   * Lança BadRequestException se não estiver.
   */
  private async validateCancerType(
    cancerType: string | null | undefined,
    tenantId: string
  ): Promise<void> {
    if (!cancerType) {return;}
    const enabledTypes = await this.getEnabledCancerTypes(tenantId);
    if (!enabledTypes.includes(cancerType.toLowerCase())) {
      throw new BadRequestException(
        `Tipo de câncer '${cancerType}' não está habilitado para este tenant. Tipos habilitados: ${enabledTypes.join(', ')}`
      );
    }
  }

  async findAll(
    tenantId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<Patient[]> {
    // Limite padrão de 200 pacientes para evitar problemas de performance
    const limit =
      options?.limit && options.limit > 0 ? Math.min(options.limit, 500) : 200;
    const offset = options?.offset && options.offset > 0 ? options.offset : 0;

    const patients = await this.prisma.patient.findMany({
      where: { tenantId },
      include: {
        _count: {
          select: {
            messages: true,
            alerts: true,
            observations: true,
          },
        },
      },
      orderBy: [
        { priorityScore: 'desc' }, // Maior score primeiro
        { createdAt: 'desc' }, // Mais recente primeiro
      ],
      take: limit,
      skip: offset,
    });

    // Contar apenas alertas PENDENTES por paciente (alinhado com AlertsPanel)
    const patientIds = patients.map((p) => p.id);
    const pendingCounts =
      patientIds.length > 0
        ? await this.prisma.alert.groupBy({
            by: ['patientId'],
            where: {
              patientId: { in: patientIds },
              tenantId,
              status: 'PENDING',
            },
            _count: { id: true },
          })
        : [];
    const pendingByPatient = new Map(
      pendingCounts.map((r) => [r.patientId, r._count.id])
    );

    const patientsWithPending = patients.map((p) => ({
      ...p,
      pendingAlertsCount: pendingByPatient.get(p.id) ?? 0,
    }));

    // Ordenar por prioridade: CRITICAL > HIGH > MEDIUM > LOW
    // Dentro da mesma categoria, ordenar por score (maior primeiro)
    const priorityOrder = {
      CRITICAL: 0,
      HIGH: 1,
      MEDIUM: 2,
      LOW: 3,
    };

    return patientsWithPending.sort((a, b) => {
      const priorityA = priorityOrder[a.priorityCategory || 'MEDIUM'] ?? 2;
      const priorityB = priorityOrder[b.priorityCategory || 'MEDIUM'] ?? 2;

      // Primeiro critério: categoria de prioridade
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      // Segundo critério: score de prioridade (maior primeiro)
      const scoreA = a.priorityScore || 0;
      const scoreB = b.priorityScore || 0;
      if (scoreA !== scoreB) {
        return scoreB - scoreA;
      }

      // Terceiro critério: data de criação (mais recente primeiro)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  async findOne(id: string, tenantId: string): Promise<Patient> {
    const patient = await this.prisma.patient.findFirst({
      where: {
        id,
        tenantId, // SEMPRE incluir tenantId para isolamento
      },
      include: {
        journey: true,
        cancerDiagnoses: {
          where: { isActive: true, primaryDiagnosisId: null },
          orderBy: [{ isPrimary: 'desc' }, { diagnosisDate: 'desc' }],
          include: {
            metastaticDiagnoses: {
              where: { isActive: true },
              orderBy: { diagnosisDate: 'desc' },
            },
          },
        },
        medications: {
          where: { isActive: true },
          orderBy: { name: 'asc' },
        },
        comorbidities: {
          orderBy: [{ severity: 'desc' }, { name: 'asc' }],
        },
        performanceStatusHistory: {
          orderBy: { assessedAt: 'desc' },
          take: 5, // Últimas 5 avaliações para calcular delta
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        alerts: {
          where: { status: { not: 'RESOLVED' } },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!patient) {
      throw new NotFoundException(`Patient with ID ${id} not found`);
    }

    return patient;
  }

  /**
   * Buscar paciente por número de telefone
   * Usa hash do telefone para busca eficiente mesmo com campo criptografado
   *
   * @param phone Número de telefone (qualquer formato)
   * @param tenantId ID do tenant
   * @returns Paciente encontrado ou null
   */
  async findByPhone(phone: string, tenantId: string): Promise<Patient | null> {
    try {
      // Normalizar telefone
      const normalizedPhone = normalizePhoneNumber(phone);

      // Gerar hash para busca
      const phoneHash = hashPhoneNumber(normalizedPhone);

      // Buscar paciente usando hash (busca eficiente mesmo com phone criptografado)
      const patient = await this.prisma.patient.findFirst({
        where: {
          tenantId, // SEMPRE incluir tenantId para isolamento
          phoneHash, // Busca por hash indexado
        },
        include: {
          journey: true,
          cancerDiagnoses: {
            where: { isActive: true, primaryDiagnosisId: null },
            orderBy: [{ isPrimary: 'desc' }, { diagnosisDate: 'desc' }],
            include: {
              metastaticDiagnoses: {
                where: { isActive: true },
                orderBy: { diagnosisDate: 'desc' },
              },
            },
          },
          medications: {
            where: { isActive: true },
            orderBy: { name: 'asc' },
          },
          comorbidities: {
            orderBy: [{ severity: 'desc' }, { name: 'asc' }],
          },
          performanceStatusHistory: {
            orderBy: { assessedAt: 'desc' },
            take: 5,
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
          alerts: {
            where: {
              status: { not: 'RESOLVED' },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      return patient;
    } catch (error) {
      // Se erro na normalização, retornar null
      if (error instanceof Error && error.message.includes('Invalid phone')) {
        throw new BadRequestException(`Invalid phone number format: ${phone}`);
      }
      throw error;
    }
  }

  async create(
    createPatientDto: CreatePatientDto,
    tenantId: string
  ): Promise<Patient> {
    // Normalizar telefone e calcular hash para busca eficiente
    const normalizedPhone = createPatientDto.phone
      ? normalizePhoneNumber(createPatientDto.phone)
      : null;
    const phoneHash = normalizedPhone
      ? hashPhoneNumber(normalizedPhone)
      : null;

    // Validar tipos de câncer habilitados para o tenant
    if (createPatientDto.cancerType) {
      await this.validateCancerType(createPatientDto.cancerType, tenantId);
    }
    for (const diag of createPatientDto.cancerDiagnoses ?? []) {
      if (diag.cancerType) {
        await this.validateCancerType(String(diag.cancerType), tenantId);
      }
    }

    // Extrair listas aninhadas do DTO
    const {
      cancerDiagnoses,
      comorbidities: comorbidityCreates,
      currentMedications: medicationCreates,
      allergyEntries: rawAllergyEntries,
      ...patientData
    } = createPatientDto;

    const allergyEntriesJson =
      normalizeAllergyEntriesForStorage(rawAllergyEntries);

    // Processar cancerDiagnoses se fornecidos
    const processedDiagnoses = cancerDiagnoses?.map((diagnosis) => {
      // Calcular stage automaticamente se campos TNM fornecidos
      const calculatedStage = this.calculateStageFromTNM(
        diagnosis.tStage,
        diagnosis.nStage,
        diagnosis.mStage,
        diagnosis.grade
      );

      return {
        ...diagnosis,
        tenantId,
        stage: calculatedStage, // Usar stage calculado a partir de TNM
        diagnosisDate: diagnosis.diagnosisDate
          ? new Date(diagnosis.diagnosisDate)
          : new Date(),
      };
    });

    const patient = await this.prisma.patient.create({
      data: {
        name: patientData.name,
        cpf: patientData.cpf,
        birthDate: new Date(createPatientDto.birthDate),
        gender: patientData.gender,
        phone: normalizedPhone,
        email: patientData.email,
        cancerType: patientData.cancerType,
        stage: patientData.stage,
        diagnosisDate: patientData.diagnosisDate
          ? new Date(patientData.diagnosisDate)
          : undefined,
        performanceStatus: patientData.performanceStatus,
        currentStage: patientData.currentStage as JourneyStage,
        smokingHistory: patientData.smokingHistory,
        alcoholHistory: patientData.alcoholHistory,
        occupationalExposure: patientData.occupationalExposure,
        smokingProfile: patientData.smokingProfile as
          | Prisma.InputJsonValue
          | undefined,
        alcoholProfile: patientData.alcoholProfile as
          | Prisma.InputJsonValue
          | undefined,
        occupationalExposureEntries: patientData.occupationalExposureEntries as
          | Prisma.InputJsonValue
          | undefined,
        allergyEntries: allergyEntriesJson,
        familyHistory: patientData.familyHistory as any,
        priorSurgeries: patientData.priorSurgeries as any,
        priorHospitalizations: patientData.priorHospitalizations as any,
        allergies: patientData.allergies,
        ehrPatientId: patientData.ehrId,
        tenantId, // SEMPRE incluir tenantId
        phoneHash, // Hash para busca eficiente
        cancerDiagnoses: processedDiagnoses
          ? {
              create: processedDiagnoses,
            }
          : undefined,
      },
      include: {
        cancerDiagnoses: {
          where: { isActive: true },
          orderBy: { isPrimary: 'desc' },
        },
      },
    });

    // Inicializar etapas de navegação oncológica se tipo de câncer informado
    // Prioridade: cancerType direto > primeiro cancerDiagnosis primário
    const patientWithDiagnoses = patient as PatientWithDiagnoses;
    const primaryDiagnosis = patientWithDiagnoses.cancerDiagnoses?.[0];
    const cancerTypeToInitialize =
      createPatientDto.cancerType ||
      (primaryDiagnosis?.cancerType
        ? String(primaryDiagnosis.cancerType)
        : null);

    if (cancerTypeToInitialize && this.navigationService) {
      try {
        // Usar currentStage do paciente criado (pode ser default SCREENING)
        await this.navigationService.initializeNavigationSteps(
          patient.id,
          tenantId,
          cancerTypeToInitialize,
          patient.currentStage || JourneyStage.SCREENING
        );
      } catch (error) {
        // Log erro mas não falha a criação do paciente
        this.logger.error(
          'Erro ao inicializar etapas de navegação:',
          error instanceof Error ? error.stack : String(error)
        );
      }
    }

    if (comorbidityCreates?.length) {
      if (!this.comorbiditiesService) {
        this.logger.warn(
          'comorbidities no create ignoradas: ComorbiditiesService indisponível'
        );
      } else {
        for (const row of comorbidityCreates) {
          await this.comorbiditiesService.create(patient.id, tenantId, row);
        }
      }
    }

    if (medicationCreates?.length) {
      if (!this.medicationsService) {
        this.logger.warn(
          'medicamentos no create ignorados: MedicationsService indisponível'
        );
      } else {
        for (const row of medicationCreates) {
          await this.medicationsService.create(patient.id, tenantId, row);
        }
      }
    }

    return patient;
  }

  async update(
    id: string,
    updatePatientDto: UpdatePatientDto,
    tenantId: string
  ): Promise<Patient> {
    // Verificar se paciente existe e pertence ao tenant
    const existingPatient = await this.prisma.patient.findFirst({
      where: { id, tenantId },
      include: {
        cancerDiagnoses: {
          where: { isActive: true },
          orderBy: { isPrimary: 'desc' },
        },
      },
    });

    if (!existingPatient) {
      throw new NotFoundException(`Patient with ID ${id} not found`);
    }

    const updateData: Prisma.PatientUpdateInput = {};

    // Copiar campos permitidos do DTO
    if (updatePatientDto.name !== undefined) {
      updateData.name = updatePatientDto.name;
    }
    if (updatePatientDto.cpf !== undefined) {
      updateData.cpf = updatePatientDto.cpf;
    }
    if (updatePatientDto.birthDate !== undefined) {
      updateData.birthDate = new Date(updatePatientDto.birthDate);
    }
    if (updatePatientDto.gender !== undefined) {
      updateData.gender = updatePatientDto.gender;
    }
    if (updatePatientDto.phone !== undefined) {
      const normalizedPhone = normalizePhoneNumber(updatePatientDto.phone);
      updateData.phone = normalizedPhone;
      updateData.phoneHash = hashPhoneNumber(normalizedPhone);
    }
    if (updatePatientDto.email !== undefined) {
      updateData.email = updatePatientDto.email;
    }
    if (updatePatientDto.cancerType !== undefined) {
      await this.validateCancerType(updatePatientDto.cancerType, tenantId);
      updateData.cancerType = updatePatientDto.cancerType;
    }
    if (updatePatientDto.stage !== undefined) {
      updateData.stage = updatePatientDto.stage;
    }
    if (updatePatientDto.diagnosisDate !== undefined) {
      updateData.diagnosisDate = new Date(updatePatientDto.diagnosisDate);
    }
    if (updatePatientDto.performanceStatus !== undefined) {
      updateData.performanceStatus = updatePatientDto.performanceStatus;
    }
    if (updatePatientDto.currentStage !== undefined) {
      updateData.currentStage = updatePatientDto.currentStage as JourneyStage;
    }
    if (updatePatientDto.smokingHistory !== undefined) {
      updateData.smokingHistory = updatePatientDto.smokingHistory;
    }
    if (updatePatientDto.alcoholHistory !== undefined) {
      updateData.alcoholHistory = updatePatientDto.alcoholHistory;
    }
    if (updatePatientDto.occupationalExposure !== undefined) {
      updateData.occupationalExposure = updatePatientDto.occupationalExposure;
    }
    if (updatePatientDto.familyHistory !== undefined) {
      updateData.familyHistory = updatePatientDto.familyHistory as any;
    }
    if (updatePatientDto.priorSurgeries !== undefined) {
      updateData.priorSurgeries = updatePatientDto.priorSurgeries as any;
    }
    if (updatePatientDto.priorHospitalizations !== undefined) {
      updateData.priorHospitalizations =
        updatePatientDto.priorHospitalizations as any;
    }
    if (updatePatientDto.allergies !== undefined) {
      updateData.allergies = updatePatientDto.allergies;
    }
    if (updatePatientDto.smokingProfile !== undefined) {
      updateData.smokingProfile = updatePatientDto.smokingProfile as any;
    }
    if (updatePatientDto.alcoholProfile !== undefined) {
      updateData.alcoholProfile = updatePatientDto.alcoholProfile as any;
    }
    if (updatePatientDto.occupationalExposureEntries !== undefined) {
      updateData.occupationalExposureEntries =
        updatePatientDto.occupationalExposureEntries as any;
    }
    if (updatePatientDto.allergyEntries !== undefined) {
      updateData.allergyEntries = normalizeAllergyEntriesForStorage(
        updatePatientDto.allergyEntries
      ) as any;
    }
    if (updatePatientDto.ehrId !== undefined) {
      updateData.ehrPatientId = updatePatientDto.ehrId;
    }
    if ((updatePatientDto as any).clinicalDisposition !== undefined) {
      updateData.clinicalDisposition = (updatePatientDto as any).clinicalDisposition;
    }
    if ((updatePatientDto as any).clinicalDispositionAt !== undefined) {
      updateData.clinicalDispositionAt = new Date((updatePatientDto as any).clinicalDispositionAt);
    }
    if ((updatePatientDto as any).clinicalDispositionReason !== undefined) {
      updateData.clinicalDispositionReason = (updatePatientDto as any).clinicalDispositionReason;
    }
    if ((updatePatientDto as any).preferredEmergencyHospital !== undefined) {
      updateData.preferredEmergencyHospital = (updatePatientDto as any).preferredEmergencyHospital;
    }

    const updatedPatient = await this.prisma.patient.update({
      where: { id, tenantId },
      data: updateData,
      include: {
        cancerDiagnoses: {
          where: { isActive: true },
          orderBy: { isPrimary: 'desc' },
        },
      },
    });

    // Se mudou o tipo de câncer ou fase, reinicializar etapas
    if (this.navigationService) {
      const existingPatientWithDiagnoses =
        existingPatient as PatientWithDiagnoses;
      const updatedPatientWithDiagnoses =
        updatedPatient as PatientWithDiagnoses;
      const oldPrimaryDiagnosis =
        existingPatientWithDiagnoses.cancerDiagnoses?.[0];
      const newPrimaryDiagnosis =
        updatedPatientWithDiagnoses.cancerDiagnoses?.[0];
      const oldCancerType =
        existingPatient.cancerType ||
        (oldPrimaryDiagnosis?.cancerType
          ? String(oldPrimaryDiagnosis.cancerType)
          : null);
      const newCancerType =
        updatedPatient.cancerType ||
        (newPrimaryDiagnosis?.cancerType
          ? String(newPrimaryDiagnosis.cancerType)
          : null);
      const oldStage = existingPatient.currentStage;
      const newStage = updatedPatient.currentStage || JourneyStage.SCREENING;

      // Quando cancerType muda: reinicializar todas as etapas (delete + create)
      // Quando apenas a fase avança (mesmo cancer type): criar etapas faltantes da nova fase
      if (newCancerType && newCancerType !== oldCancerType) {
        try {
          await this.navigationService.initializeNavigationSteps(
            id,
            tenantId,
            newCancerType,
            newStage
          );
        } catch (error) {
          this.logger.error(
            'Erro ao atualizar etapas de navegação:',
            error instanceof Error ? error.stack : String(error)
          );
        }
      } else if (newCancerType && newStage !== oldStage) {
        // Apenas fase mudou — criar etapas faltantes da nova fase sem deletar as anteriores
        try {
          await this.navigationService.createMissingStepsForStage(
            id,
            tenantId,
            newStage,
          );
        } catch (error) {
          this.logger.error(
            'Erro ao criar etapas da nova fase:',
            error instanceof Error ? error.stack : String(error)
          );
        }
      } else {
        // Sem reinit: garantir que etapas de fases futuras não tenham prazo (dados legados)
        try {
          await this.navigationService.clearFuturePhaseStepDates(
            id,
            tenantId
          );
        } catch (err) {
          this.logger.warn(
            'Falha ao limpar prazos de etapas futuras:',
            err instanceof Error ? err.message : err
          );
        }
      }
    }

    return updatedPatient;
  }

  /**
   * Atualizar score de priorização do paciente
   * Atualiza o campo priorityScore no paciente e cria registro histórico
   *
   * @param id ID do paciente
   * @param updatePriorityDto Dados do score de priorização
   * @param tenantId ID do tenant
   * @returns Paciente atualizado
   */
  async updatePriority(
    id: string,
    updatePriorityDto: UpdatePriorityDto,
    tenantId: string
  ): Promise<Patient> {
    // Verificar se paciente existe e pertence ao tenant
    const existingPatient = await this.prisma.patient.findFirst({
      where: { id, tenantId },
    });

    if (!existingPatient) {
      throw new NotFoundException(`Patient with ID ${id} not found`);
    }

    // Atualizar paciente e criar registro histórico em transação
    const [updatedPatient] = await this.prisma.$transaction([
      // Atualizar score no paciente
      this.prisma.patient.update({
        where: { id, tenantId },
        data: {
          priorityScore: updatePriorityDto.score,
          priorityCategory: updatePriorityDto.category,
          priorityReason: updatePriorityDto.reason,
          priorityUpdatedAt: new Date(),
        },
      }),
      // Criar registro histórico
      this.prisma.priorityScore.create({
        data: {
          tenantId,
          patientId: id,
          score: updatePriorityDto.score,
          category: updatePriorityDto.category,
          reason: updatePriorityDto.reason,
          modelVersion: updatePriorityDto.modelVersion,
        },
      }),
    ]);

    return updatedPatient;
  }

  async remove(id: string, tenantId: string): Promise<void> {
    const patient = await this.prisma.patient.findFirst({
      where: { id, tenantId },
    });

    if (!patient) {
      throw new NotFoundException(`Patient with ID ${id} not found`);
    }

    await this.prisma.patient.delete({
      where: { id, tenantId },
    });
  }

  /**
   * Importa pacientes de um arquivo CSV
   * @param csvBuffer Buffer do arquivo CSV
   * @param tenantId ID do tenant
   * @returns Resultado da importação com sucessos e erros
   */
  async importFromCsv(
    csvBuffer: Buffer,
    tenantId: string
  ): Promise<{
    success: number;
    errors: Array<{ row: number; errors: string[] }>;
    created: Patient[];
  }> {
    const results: ImportPatientRowDto[] = [];
    const errors: Array<{ row: number; errors: string[] }> = [];
    const created: Patient[] = [];

    return new Promise((resolve, reject) => {
      let streamError: Error | null = null;

      try {
        const stream = Readable.from(csvBuffer.toString('utf-8'));

        stream
          .pipe(
            csv({
              headers: [
                'name',
                'cpf',
                'dataNascimento',
                'sexo',
                'telefone',
                'email',
                'tipoCancer',
                'dataDiagnostico',
                'estagio',
                'oncologistaResponsavel',
                'currentStage',
              ],
            })
          )
          .on('data', (row) => {
            try {
              results.push(row);
            } catch (error) {
              this.logger.error('Erro ao processar linha do CSV:', error);
              // Continuar processamento mesmo com erro em uma linha
            }
          })
          .on('end', async () => {
            try {
              // Validar e criar pacientes
              for (let i = 0; i < results.length; i++) {
                const row = results[i];
                const rowErrors: string[] = [];

                // Validações básicas
                if (!row.name || row.name.trim().length < 2) {
                  rowErrors.push(
                    'Nome é obrigatório e deve ter pelo menos 2 caracteres'
                  );
                }
                if (
                  row.sexo &&
                  !['male', 'female', 'other'].includes(row.sexo)
                ) {
                  rowErrors.push('Sexo deve ser male, female ou other');
                }
                // Normalizar tipo de câncer: valor canônico é em inglês (ex.: lung)
                if (row.tipoCancer) {
                  const raw = (row.tipoCancer as string).trim();
                  const normalizedTipoCancer =
                    raw === 'Pulmão' || raw === 'pulmão' || raw === 'pulmao'
                      ? 'lung'
                      : raw;
                  row.tipoCancer = normalizedTipoCancer as CancerType;
                }
                // Data de diagnóstico só é obrigatória se não estiver em rastreio
                // Por padrão, assumimos SCREENING se não especificado
                const currentStage = (row as any).currentStage || 'SCREENING';
                if (!row.dataDiagnostico && currentStage !== 'SCREENING') {
                  rowErrors.push(
                    'Data de diagnóstico é obrigatória quando o paciente não está em rastreio'
                  );
                }

                // Validar formato de data
                if (
                  row.dataNascimento &&
                  isNaN(Date.parse(row.dataNascimento))
                ) {
                  rowErrors.push('Data de nascimento inválida');
                }
                if (
                  row.dataDiagnostico &&
                  isNaN(Date.parse(row.dataDiagnostico))
                ) {
                  rowErrors.push('Data de diagnóstico inválida');
                }

                if (rowErrors.length > 0) {
                  errors.push({ row: i + 2, errors: rowErrors }); // +2 porque linha 1 é header
                  continue;
                }

                try {
                  // Normalizar telefone (opcional)
                  let normalizedPhone: string | null = null;
                  let phoneHash: string | null = null;
                  if (row.telefone && row.telefone.trim().length >= 10) {
                    try {
                      normalizedPhone = normalizePhoneNumber(
                        row.telefone.trim()
                      );
                      phoneHash = hashPhoneNumber(normalizedPhone);
                    } catch (error) {
                      this.logger.warn(
                        `Telefone inválido na linha ${i + 2}, ignorando: ${row.telefone}`
                      );
                    }
                  }

                  // Criar paciente
                  const createDto: CreatePatientDto = {
                    name: row.name.trim(),
                    cpf: row.cpf?.trim(),
                    birthDate: row.dataNascimento,
                    gender: row.sexo,
                    phone: normalizedPhone,
                    email: row.email?.trim() || undefined,
                    cancerType: row.tipoCancer,
                    stage: row.estagio?.trim() || undefined,
                    currentTreatment: undefined,
                    ehrId: undefined,
                    ehrSystem: undefined,
                  };

                  // Determinar estágio da jornada
                  const currentStage =
                    (row as any).currentStage ||
                    (row.dataDiagnostico ? 'DIAGNOSIS' : 'SCREENING');

                  // Criar paciente
                  let patient;
                  try {
                    patient = await this.prisma.patient.create({
                      data: {
                        name: createDto.name,
                        cpf: createDto.cpf || null,
                        birthDate: row.dataNascimento
                          ? new Date(row.dataNascimento)
                          : new Date(),
                        gender: createDto.gender,
                        phone: normalizedPhone,
                        email: createDto.email,
                        cancerType: createDto.cancerType,
                        stage: createDto.stage,
                        diagnosisDate: row.dataDiagnostico
                          ? new Date(row.dataDiagnostico)
                          : null,
                        currentStage: currentStage as JourneyStage,
                        tenantId,
                        phoneHash,
                      },
                    });
                  } catch (error) {
                    // Erro específico de constraint (ex: CPF duplicado)
                    if (error instanceof Error) {
                      if (
                        error.message.includes('Unique constraint') ||
                        error.message.includes('duplicate')
                      ) {
                        rowErrors.push(
                          `CPF ou telefone já cadastrado: ${error.message}`
                        );
                      } else {
                        rowErrors.push(
                          `Erro ao criar paciente: ${error.message}`
                        );
                      }
                    } else {
                      rowErrors.push('Erro desconhecido ao criar paciente');
                    }
                    errors.push({ row: i + 2, errors: rowErrors });
                    continue;
                  }

                  // Criar diagnóstico de câncer se tipoCancer fornecido
                  if (row.tipoCancer) {
                    try {
                      await this.prisma.cancerDiagnosis.create({
                        data: {
                          tenantId,
                          patientId: patient.id,
                          cancerType: row.tipoCancer,
                          diagnosisDate: row.dataDiagnostico
                            ? new Date(row.dataDiagnostico)
                            : new Date(),
                          diagnosisConfirmed: true,
                          isPrimary: true,
                          isActive: true,
                        },
                      });
                    } catch (error) {
                      this.logger.error(
                        `Erro ao criar diagnóstico para paciente ${patient.id}:`,
                        error instanceof Error ? error.stack : String(error)
                      );
                      // Não falhar o import por erro no diagnóstico, apenas logar
                    }
                  }

                  // Inicializar etapas de navegação
                  if (row.tipoCancer && this.navigationService) {
                    try {
                      await this.navigationService.initializeNavigationSteps(
                        patient.id,
                        tenantId,
                        row.tipoCancer,
                        currentStage as JourneyStage
                      );
                    } catch (error) {
                      this.logger.error(
                        `Erro ao inicializar navegação para paciente ${patient.id}:`,
                        error instanceof Error ? error.stack : String(error)
                      );
                    }
                  }

                  created.push(patient);
                } catch (error) {
                  if (error instanceof Error) {
                    rowErrors.push(error.message);
                  } else {
                    rowErrors.push('Erro desconhecido ao criar paciente');
                  }
                  errors.push({ row: i + 2, errors: rowErrors });
                }
              }

              resolve({
                success: created.length,
                errors,
                created,
              });
            } catch (error) {
              this.logger.error('Erro ao processar CSV:', error);
              reject(
                error instanceof Error
                  ? error
                  : new Error('Erro desconhecido ao processar CSV')
              );
            }
          })
          .on('error', (error) => {
            streamError =
              error instanceof Error ? error : new Error(String(error));
            this.logger.error('Erro no stream do CSV:', streamError);
            reject(new Error(`Erro ao ler CSV: ${streamError.message}`));
          });
      } catch (error) {
        this.logger.error('Erro ao criar stream do CSV:', error);
        reject(
          error instanceof Error
            ? error
            : new Error('Erro ao processar arquivo CSV')
        );
      }
    });
  }

  async importFromSpreadsheet(
    rows: ImportSpreadsheetRowDto[],
    tenantId: string
  ): Promise<{
    created: number;
    updated: number;
    surgeries: number;
    errors: Array<{ row: number; errors: string[] }>;
  }> {
    let createdCount = 0;
    let updatedCount = 0;
    let surgeriesCount = 0;
    const errors: Array<{ row: number; errors: string[] }> = [];

    // Obter tipos de câncer habilitados para o tenant
    const enabledTypes = await this.getEnabledCancerTypes(tenantId);
    const defaultCancerType = enabledTypes.includes('bladder')
      ? 'bladder'
      : enabledTypes[0] || 'other';

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowErrors: string[] = [];

      // Validação: nome é obrigatório
      if (!row.name || row.name.trim().length < 2) {
        rowErrors.push('Nome é obrigatório (mínimo 2 caracteres)');
        errors.push({ row: i + 1, errors: rowErrors });
        continue;
      }

      try {
        // Deduplicação por prontuário
        let patient = null;
        if (row.medicalRecordNumber) {
          patient = await this.prisma.patient.findFirst({
            where: {
              tenantId,
              medicalRecordNumber: row.medicalRecordNumber.trim(),
            },
            include: { cancerDiagnoses: { where: { isActive: true } } },
          });
        }

        if (patient) {
          // Paciente já existe — atualizar dados básicos se necessário
          const updateData: Record<string, any> = {};
          if (row.occupation && !patient.occupation) {
            updateData.occupation = row.occupation.trim();
          }
          if (row.smokingHistory && !patient.smokingHistory) {
            updateData.smokingHistory = row.smokingHistory.trim();
          }
          if (row.gender && !patient.gender) {
            updateData.gender = row.gender;
          }

          if (Object.keys(updateData).length > 0) {
            await this.prisma.patient.update({
              where: { id: patient.id, tenantId },
              data: updateData,
            });
            updatedCount++;
          }
        } else {
          // Criar novo paciente
          const birthDate = row.birthDate
            ? new Date(row.birthDate)
            : new Date(1970, 0, 1);

          // Normalizar telefone se fornecido
          let normalizedPhone: string | null = null;
          let phoneHash: string | null = null;
          if (row.phone && row.phone.trim().length >= 10) {
            try {
              normalizedPhone = normalizePhoneNumber(row.phone.trim());
              phoneHash = hashPhoneNumber(normalizedPhone);
            } catch {
              this.logger.warn(
                `Telefone inválido na linha ${i + 1}, ignorando`
              );
            }
          }

          patient = await this.prisma.patient.create({
            data: {
              tenantId,
              name: row.name.trim(),
              cpf: row.cpf?.trim() || null,
              birthDate,
              gender: row.gender || null,
              phone: normalizedPhone,
              phoneHash,
              email: null,
              medicalRecordNumber: row.medicalRecordNumber?.trim() || null,
              occupation: row.occupation?.trim() || null,
              smokingHistory: row.smokingHistory?.trim() || null,
              cancerType: defaultCancerType,
              currentStage: 'TREATMENT' as JourneyStage,
              status: 'ACTIVE',
            },
            include: { cancerDiagnoses: { where: { isActive: true } } },
          });

          // Criar diagnóstico de câncer
          const diagnosisText = row.diagnosis?.trim() || null;
          await this.prisma.cancerDiagnosis.create({
            data: {
              tenantId,
              patientId: patient.id,
              cancerType: defaultCancerType,
              diagnosisDate: row.referenceDate
                ? new Date(row.referenceDate)
                : new Date(),
              diagnosisConfirmed: true,
              isPrimary: true,
              isActive: true,
              histologicalType: diagnosisText,
            },
          });

          // Inicializar etapas de navegação
          if (this.navigationService) {
            try {
              await this.navigationService.initializeNavigationSteps(
                patient.id,
                tenantId,
                defaultCancerType,
                'TREATMENT' as JourneyStage
              );
            } catch (error) {
              this.logger.warn(
                `Erro ao inicializar navegação para paciente ${patient.id}:`,
                error instanceof Error ? error.message : String(error)
              );
            }
          }

          createdCount++;
        }

        // Criar registro de cirurgia (Treatment) se houver dados cirúrgicos
        if (row.surgeryDate || row.surgeryType) {
          const diagnosisId =
            (patient as any).cancerDiagnoses?.[0]?.id || null;

          if (diagnosisId) {
            await this.prisma.treatment.create({
              data: {
                tenantId,
                patientId: patient.id,
                diagnosisId,
                treatmentType: 'SURGERY',
                treatmentName: row.surgeryType?.trim() || 'Cirurgia',
                startDate: row.surgeryDate
                  ? new Date(row.surgeryDate)
                  : null,
                status: 'COMPLETED',
                isActive: false,
                admissionDate: row.admissionDate
                  ? new Date(row.admissionDate)
                  : null,
                dischargeDate: row.dischargeDate
                  ? new Date(row.dischargeDate)
                  : null,
                aihEmissionDate: row.aihEmissionDate
                  ? new Date(row.aihEmissionDate)
                  : null,
                isReadmission: row.isReadmission || false,
                readmissionReason: row.readmissionReason?.trim() || null,
                isReoperation: row.isReoperation || false,
                hadNeoadjuvantChemo: row.hadNeoadjuvantChemo || false,
                neoadjuvantChemoDetail:
                  row.neoadjuvantChemoDetail?.trim() || null,
                hadUrinaryDiversion: row.hadUrinaryDiversion || false,
                intraoperativeMortality:
                  row.intraoperativeMortality || false,
                mortality30Days: row.mortality30Days || false,
                mortality90Days: row.mortality90Days || false,
                mortality90DaysDetail:
                  row.mortality90DaysDetail?.trim() || null,
                notes: row.diagnosis?.trim() || null,
              },
            });
            surgeriesCount++;
          } else {
            rowErrors.push(
              'Não foi possível criar registro cirúrgico: diagnóstico não encontrado'
            );
          }
        }

        if (rowErrors.length > 0) {
          errors.push({ row: i + 1, errors: rowErrors });
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Erro desconhecido';
        errors.push({ row: i + 1, errors: [message] });
      }
    }

    this.logger.log(
      `Importação de planilha concluída: ${createdCount} criados, ${updatedCount} atualizados, ${surgeriesCount} cirurgias, ${errors.length} erros`
    );

    return {
      created: createdCount,
      updated: updatedCount,
      surgeries: surgeriesCount,
      errors,
    };
  }

  /**
   * Retorna paciente com todos os relacionamentos necessários
   * @param id ID do paciente
   * @param tenantId ID do tenant
   * @returns Dados completos do paciente
   */
  async getDetail(
    id: string,
    tenantId: string
  ): Promise<PatientDetailResponse> {
    const patient = await this.prisma.patient.findFirst({
      where: {
        id,
        tenantId,
      },
      include: {
        journey: true,
        cancerDiagnoses: {
          where: { isActive: true },
          orderBy: [{ isPrimary: 'desc' }, { diagnosisDate: 'desc' }],
        },
        complementaryExams: {
          include: {
            results: { orderBy: { performedAt: 'desc' } },
          },
        },
        medications: {
          where: { isActive: true },
          orderBy: { updatedAt: 'desc' },
        },
        comorbidities: {
          orderBy: { updatedAt: 'desc' },
        },
        alerts: {
          where: {
            status: { not: 'RESOLVED' },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        _count: {
          select: {
            messages: true,
            alerts: true,
            observations: true,
          },
        },
      },
    });

    if (!patient) {
      throw new NotFoundException(`Patient with ID ${id} not found`);
    }

    // Buscar etapas de navegação usando o serviço de navegação
    // Isso garante que etapas faltantes sejam criadas automaticamente
    let navigationSteps: any[] = [];
    if (this.navigationService) {
      try {
        navigationSteps =
          await this.navigationService.getPatientNavigationSteps(id, tenantId);
      } catch (error) {
        // Se houver erro ao buscar etapas, usar array vazio
        this.logger.error(
          'Erro ao buscar etapas de navegação:',
          error instanceof Error ? error.stack : String(error)
        );
        navigationSteps = [];
      }
    }

    // Adicionar navigationSteps ao objeto patient
    return {
      ...patient,
      navigationSteps,
    } as unknown as PatientDetailResponse;
  }

  /**
   * Calcula o campo stage a partir dos campos TNM estruturados
   * @param tStage T stage (T1-T4, Tis, Tx)
   * @param nStage N stage (N0-N3, Nx)
   * @param mStage M stage (M0, M1, Mx)
   * @param grade Grade (G1-G4, Gx)
   * @returns String formatada como "T2N1M0 G2" ou null se não houver dados suficientes
   */
  calculateStageFromTNM(
    tStage?: string | null,
    nStage?: string | null,
    mStage?: string | null,
    grade?: string | null
  ): string | null {
    const parts: string[] = [];

    if (tStage && tStage !== 'Tx') {
      parts.push(tStage);
    }
    if (nStage && nStage !== 'Nx') {
      parts.push(nStage);
    }
    if (mStage && mStage !== 'Mx') {
      parts.push(mStage);
    }

    if (parts.length === 0) {
      return null;
    }

    const tnmString = parts.join('');
    if (grade && grade !== 'Gx') {
      return `${tnmString} ${grade}`;
    }

    return tnmString;
  }

  /**
   * Cria um novo diagnóstico de câncer para um paciente
   * @param patientId ID do paciente
   * @param tenantId ID do tenant
   * @param createDto Dados do diagnóstico
   * @returns Diagnóstico criado
   */
  async createCancerDiagnosis(
    patientId: string,
    tenantId: string,
    createDto: CreateCancerDiagnosisDto
  ) {
    // Verificar se paciente existe e pertence ao tenant
    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, tenantId },
    });

    if (!patient) {
      throw new NotFoundException(`Patient with ID ${patientId} not found`);
    }

    // Se for diagnóstico metastático, validar que o primário existe e pertence ao mesmo paciente
    if (createDto.primaryDiagnosisId) {
      const primary = await this.prisma.cancerDiagnosis.findFirst({
        where: {
          id: createDto.primaryDiagnosisId,
          patientId,
          tenantId,
          primaryDiagnosisId: null, // deve ser um primário
        },
      });
      if (!primary) {
        throw new BadRequestException(
          'Diagnóstico primário não encontrado ou não pertence a este paciente.'
        );
      }
    }

    // Calcular stage automaticamente se tStage, nStage, mStage estiverem preenchidos
    const calculatedStage = this.calculateStageFromTNM(
      createDto.tStage,
      createDto.nStage,
      createDto.mStage,
      createDto.grade
    );

    const diagnosisData: Prisma.CancerDiagnosisCreateInput = {
      tenant: { connect: { id: tenantId } },
      patient: { connect: { id: patientId } },
      cancerType: createDto.cancerType,
      icd10Code: createDto.icd10Code,
      tStage: createDto.tStage,
      nStage: createDto.nStage,
      mStage: createDto.mStage,
      grade: createDto.grade,
      stage: calculatedStage, // Usar stage calculado a partir de TNM
      stagingDate: createDto.stagingDate
        ? new Date(createDto.stagingDate)
        : undefined,
      histologicalType: createDto.histologicalType,
      diagnosisDate: new Date(createDto.diagnosisDate),
      diagnosisConfirmed: createDto.diagnosisConfirmed ?? true,
      pathologyReport: createDto.pathologyReport,
      confirmedBy: createDto.confirmedBy,
      // Biomarcadores - Mama
      her2Status: createDto.her2Status,
      erStatus: createDto.erStatus,
      prStatus: createDto.prStatus,
      ki67Percentage: createDto.ki67Percentage,
      // Biomarcadores - Pulmão/Colorretal
      egfrMutation: createDto.egfrMutation,
      alkRearrangement: createDto.alkRearrangement,
      ros1Rearrangement: createDto.ros1Rearrangement,
      brafMutation: createDto.brafMutation,
      krasMutation: createDto.krasMutation,
      nrasMutation: createDto.nrasMutation,
      pdl1Expression: createDto.pdl1Expression,
      msiStatus: createDto.msiStatus,
      // Biomarcadores - Próstata
      psaBaseline: createDto.psaBaseline,
      gleasonScore: createDto.gleasonScore,
      // Marcadores Tumorais
      ceaBaseline: createDto.ceaBaseline,
      ca199Baseline: createDto.ca199Baseline,
      ca125Baseline: createDto.ca125Baseline,
      ca153Baseline: createDto.ca153Baseline,
      afpBaseline: createDto.afpBaseline,
      hcgBaseline: createDto.hcgBaseline,
      // Status (metastático = não primário, vinculado ao primário)
      isPrimary: createDto.primaryDiagnosisId ? false : (createDto.isPrimary ?? true),
      isActive: createDto.isActive ?? true,
      // Vincular ao diagnóstico primário quando for metastático
      ...(createDto.primaryDiagnosisId && {
        primaryDiagnosis: { connect: { id: createDto.primaryDiagnosisId } },
      }),
    };

    const diagnosis = await this.prisma.cancerDiagnosis.create({
      data: diagnosisData,
    });

    // Inicializar etapas de navegação vinculadas a este diagnóstico (excluídas em cascata ao excluir o diagnóstico)
    if (this.navigationService) {
      try {
        const cancerTypeStr = String(createDto.cancerType);
        const journeyStage = patient.currentStage || JourneyStage.SCREENING;
        await this.navigationService.initializeNavigationSteps(
          patientId,
          tenantId,
          cancerTypeStr,
          journeyStage,
          diagnosis.id
        );
      } catch (error) {
        this.logger.error(
          'Erro ao inicializar etapas de navegação após diagnóstico:',
          error instanceof Error ? error.stack : String(error)
        );
      }
    }

    this.priorityRecalculationService?.triggerRecalculation(patientId, tenantId);

    return diagnosis;
  }

  /**
   * Atualiza um diagnóstico de câncer existente
   * @param diagnosisId ID do diagnóstico
   * @param patientId ID do paciente
   * @param tenantId ID do tenant
   * @param updateDto Dados para atualização
   * @returns Diagnóstico atualizado
   */
  async updateCancerDiagnosis(
    diagnosisId: string,
    patientId: string,
    tenantId: string,
    updateDto: UpdateCancerDiagnosisDto
  ) {
    // Verificar se diagnóstico existe e pertence ao paciente/tenant
    const existingDiagnosis = await this.prisma.cancerDiagnosis.findFirst({
      where: {
        id: diagnosisId,
        patientId,
        tenantId,
      },
    });

    if (!existingDiagnosis) {
      throw new NotFoundException(
        `Cancer diagnosis with ID ${diagnosisId} not found`
      );
    }

    // Calcular stage automaticamente se tStage, nStage, mStage foram atualizados
    const tStage = updateDto.tStage ?? existingDiagnosis.tStage;
    const nStage = updateDto.nStage ?? existingDiagnosis.nStage;
    const mStage = updateDto.mStage ?? existingDiagnosis.mStage;
    const grade = updateDto.grade ?? existingDiagnosis.grade;

    const calculatedStage = this.calculateStageFromTNM(
      tStage,
      nStage,
      mStage,
      grade
    );

    const updateData: Prisma.CancerDiagnosisUpdateInput = {
      ...updateDto,
      stage: calculatedStage || existingDiagnosis.stage,
    };

    // Converter datas se fornecidas
    if (updateDto.diagnosisDate) {
      updateData.diagnosisDate = new Date(updateDto.diagnosisDate);
    }
    if (updateDto.stagingDate) {
      updateData.stagingDate = new Date(updateDto.stagingDate);
    }

    const updated = await this.prisma.cancerDiagnosis.update({
      where: { id: diagnosisId, tenantId },
      data: updateData,
    });

    this.priorityRecalculationService?.triggerRecalculation(patientId, tenantId);

    return updated;
  }

  /**
   * Lista todos os diagnósticos de câncer de um paciente
   * @param patientId ID do paciente
   * @param tenantId ID do tenant
   * @param includeInactive Incluir diagnósticos inativos
   * @returns Lista de diagnósticos
   */
  async getCancerDiagnoses(
    patientId: string,
    tenantId: string,
    includeInactive: boolean = false
  ) {
    // Verificar se paciente existe e pertence ao tenant
    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, tenantId },
    });

    if (!patient) {
      throw new NotFoundException(`Patient with ID ${patientId} not found`);
    }

    return this.prisma.cancerDiagnosis.findMany({
      where: {
        patientId,
        tenantId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: [{ isPrimary: 'desc' }, { diagnosisDate: 'desc' }],
    });
  }

  /**
   * Remove um diagnóstico de câncer do paciente
   * @param diagnosisId ID do diagnóstico
   * @param patientId ID do paciente
   * @param tenantId ID do tenant
   */
  async deleteCancerDiagnosis(
    diagnosisId: string,
    patientId: string,
    tenantId: string
  ): Promise<void> {
    const existingDiagnosis = await this.prisma.cancerDiagnosis.findFirst({
      where: {
        id: diagnosisId,
        patientId,
        tenantId,
      },
    });

    if (!existingDiagnosis) {
      throw new NotFoundException(
        `Cancer diagnosis with ID ${diagnosisId} not found`
      );
    }

    await this.prisma.cancerDiagnosis.delete({
      where: { id: diagnosisId, tenantId },
    });
  }
}
