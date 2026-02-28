import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePatientDto, Gender, CancerType } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { UpdatePriorityDto } from './dto/update-priority.dto';
import { ImportPatientRowDto } from './dto/import-patients.dto';
import { PatientDetailResponse } from './dto/patient-detail-response.dto';
import { CreateCancerDiagnosisDto } from './dto/create-cancer-diagnosis.dto';
import { UpdateCancerDiagnosisDto } from './dto/update-cancer-diagnosis.dto';
import { Patient, Prisma, JourneyStage } from '@prisma/client';
import { OncologyNavigationService } from '../oncology-navigation/oncology-navigation.service';
import {
  normalizePhoneNumber,
  hashPhoneNumber,
} from '../common/utils/phone.util';
import * as csv from 'csv-parser';
import { Readable } from 'stream';

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
    private readonly navigationService?: OncologyNavigationService
  ) {}

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

    // Ordenar por prioridade: CRITICAL > HIGH > MEDIUM > LOW
    // Dentro da mesma categoria, ordenar por score (maior primeiro)
    const priorityOrder = {
      CRITICAL: 0,
      HIGH: 1,
      MEDIUM: 2,
      LOW: 3,
    };

    return patients.sort((a, b) => {
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
        journey: true, // Incluir jornada (rastreio, diagnóstico, tratamento)
        cancerDiagnoses: {
          where: { isActive: true }, // Apenas diagnósticos ativos
          orderBy: [
            { isPrimary: 'desc' }, // Primário primeiro
            { diagnosisDate: 'desc' }, // Mais recente primeiro
          ],
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 10, // Últimas 10 mensagens
        },
        alerts: {
          where: {
            status: { not: 'RESOLVED' },
          },
          orderBy: { createdAt: 'desc' },
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
            where: { isActive: true },
            orderBy: [{ isPrimary: 'desc' }, { diagnosisDate: 'desc' }],
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
    const normalizedPhone = normalizePhoneNumber(createPatientDto.phone);
    const phoneHash = hashPhoneNumber(normalizedPhone);

    // Extrair cancerDiagnoses do DTO para processar separadamente
    const { cancerDiagnoses, ...patientData } = createPatientDto;

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
        phone: patientData.phone,
        email: patientData.email,
        cancerType: patientData.cancerType,
        stage: patientData.stage,
        diagnosisDate: patientData.diagnosisDate
          ? new Date(patientData.diagnosisDate)
          : undefined,
        performanceStatus: patientData.performanceStatus,
        currentStage: patientData.currentStage as JourneyStage,
        comorbidities: patientData.comorbidities as any,
        smokingHistory: patientData.smokingHistory,
        alcoholHistory: patientData.alcoholHistory,
        occupationalExposure: patientData.occupationalExposure,
        familyHistory: patientData.familyHistory as any,
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
    if (updatePatientDto.comorbidities !== undefined) {
      updateData.comorbidities = updatePatientDto.comorbidities as any;
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
    if (updatePatientDto.ehrId !== undefined) {
      updateData.ehrPatientId = updatePatientDto.ehrId;
    }

    const updatedPatient = await this.prisma.patient.update({
      where: { id },
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

      // Reinicializar se mudou tipo de câncer ou estágio
      if (
        newCancerType &&
        (newCancerType !== oldCancerType || newStage !== oldStage)
      ) {
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
        where: { id },
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
      where: { id },
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
                if (!row.cpf || row.cpf.trim().length === 0) {
                  rowErrors.push('CPF é obrigatório');
                }
                if (!row.dataNascimento) {
                  rowErrors.push('Data de nascimento é obrigatória');
                }
                if (
                  !row.sexo ||
                  !['male', 'female', 'other'].includes(row.sexo)
                ) {
                  rowErrors.push('Sexo deve ser male, female ou other');
                }
                if (!row.telefone || row.telefone.trim().length < 10) {
                  rowErrors.push(
                    'Telefone é obrigatório e deve ter pelo menos 10 dígitos'
                  );
                }
                if (!row.tipoCancer) {
                  rowErrors.push('Tipo de câncer é obrigatório');
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
                  // Normalizar telefone (já validado como obrigatório acima)
                  let normalizedPhone = row.telefone.trim();
                  let phoneHash = null;
                  try {
                    normalizedPhone = normalizePhoneNumber(normalizedPhone);
                    phoneHash = hashPhoneNumber(normalizedPhone);
                  } catch (error) {
                    rowErrors.push('Telefone inválido');
                    errors.push({ row: i + 2, errors: rowErrors });
                    continue;
                  }

                  // Criar paciente
                  const createDto: CreatePatientDto = {
                    name: row.name.trim(),
                    cpf: row.cpf.trim(),
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
                        cpf: createDto.cpf,
                        birthDate: new Date(row.dataNascimento),
                        gender: createDto.gender,
                        phone: createDto.phone,
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
      // Status
      isPrimary: createDto.isPrimary ?? true,
      isActive: createDto.isActive ?? true,
    };

    const diagnosis = await this.prisma.cancerDiagnosis.create({
      data: diagnosisData,
    });

    // Inicializar etapas de navegação automaticamente ao adicionar diagnóstico
    if (this.navigationService) {
      try {
        const cancerTypeStr = String(createDto.cancerType);
        const journeyStage = patient.currentStage || JourneyStage.SCREENING;
        await this.navigationService.initializeNavigationSteps(
          patientId,
          tenantId,
          cancerTypeStr,
          journeyStage
        );
      } catch (error) {
        this.logger.error(
          'Erro ao inicializar etapas de navegação após diagnóstico:',
          error instanceof Error ? error.stack : String(error)
        );
      }
    }

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

    return this.prisma.cancerDiagnosis.update({
      where: { id: diagnosisId },
      data: updateData,
    });
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
}
