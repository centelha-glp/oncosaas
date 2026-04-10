import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PatientsService } from './patients.service';
import { PrismaService } from '../prisma/prisma.service';
import { OncologyNavigationService } from '../oncology-navigation/oncology-navigation.service';
import { PriorityRecalculationService } from '../oncology-navigation/priority-recalculation.service';
import { ComorbiditiesService } from '../comorbidities/comorbidities.service';
import { MedicationsService } from '../medications/medications.service';

const mockPrisma = {
  patient: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  alert: {
    groupBy: jest.fn(),
  },
  tenant: {
    findUnique: jest.fn(),
  },
};

const mockNavigationService = {
  initializeNavigationSteps: jest.fn(),
  clearFuturePhaseStepDates: jest.fn(),
};

const mockPriorityRecalculation = {
  recalculate: jest.fn(),
};

const mockComorbiditiesService = {
  create: jest.fn(),
};

const mockMedicationsService = {
  create: jest.fn(),
};

const TENANT = 'tenant-abc';
const OTHER_TENANT = 'tenant-xyz';
const PATIENT_ID = 'patient-1';

const basePatient = {
  id: PATIENT_ID,
  tenantId: TENANT,
  name: 'Ana Silva',
  cpf: '12345678900',
  birthDate: new Date('1980-01-01'),
  gender: 'FEMALE',
  phone: '+5511999999999',
  phoneHash: 'hash123',
  email: 'ana@example.com',
  cancerType: 'bladder',
  stage: 'II',
  priorityScore: 75,
  priorityCategory: 'HIGH',
  currentStage: 'SCREENING',
  status: 'ACTIVE',
  createdAt: new Date(),
  updatedAt: new Date(),
  cancerDiagnoses: [],
  _count: { messages: 0, alerts: 0, observations: 0 },
};

describe('PatientsService', () => {
  let service: PatientsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PatientsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: OncologyNavigationService, useValue: mockNavigationService },
        { provide: PriorityRecalculationService, useValue: mockPriorityRecalculation },
        { provide: ComorbiditiesService, useValue: mockComorbiditiesService },
        { provide: MedicationsService, useValue: mockMedicationsService },
      ],
    }).compile();

    service = module.get<PatientsService>(PatientsService);
    // Injetar dependências opcionais diretamente
    (service as any).navigationService = mockNavigationService;
    (service as any).priorityRecalculationService = mockPriorityRecalculation;
  });

  // ─── findAll ────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('deve retornar pacientes ordenados por prioridade (CRITICAL > HIGH > MEDIUM > LOW)', async () => {
      const patients = [
        { ...basePatient, id: 'p1', priorityCategory: 'MEDIUM', priorityScore: 50 },
        { ...basePatient, id: 'p2', priorityCategory: 'CRITICAL', priorityScore: 90 },
        { ...basePatient, id: 'p3', priorityCategory: 'HIGH', priorityScore: 75 },
      ];
      mockPrisma.patient.findMany.mockResolvedValue(patients);
      mockPrisma.alert.groupBy.mockResolvedValue([]);

      const result = await service.findAll(TENANT);

      expect(result[0].priorityCategory).toBe('CRITICAL');
      expect(result[1].priorityCategory).toBe('HIGH');
      expect(result[2].priorityCategory).toBe('MEDIUM');
    });

    it('deve escopar a query ao tenantId correto', async () => {
      mockPrisma.patient.findMany.mockResolvedValue([]);
      mockPrisma.alert.groupBy.mockResolvedValue([]);

      await service.findAll(TENANT);

      expect(mockPrisma.patient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: TENANT } })
      );
    });

    it('deve adicionar pendingAlertsCount a partir dos alertas agrupados', async () => {
      const patients = [{ ...basePatient, id: PATIENT_ID }];
      mockPrisma.patient.findMany.mockResolvedValue(patients);
      mockPrisma.alert.groupBy.mockResolvedValue([
        { patientId: PATIENT_ID, _count: { id: 3 } },
      ]);

      const result = await service.findAll(TENANT);

      expect((result[0] as any).pendingAlertsCount).toBe(3);
    });

    it('deve respeitar o limite máximo de 500', async () => {
      mockPrisma.patient.findMany.mockResolvedValue([]);
      mockPrisma.alert.groupBy.mockResolvedValue([]);

      await service.findAll(TENANT, { limit: 9999 });

      expect(mockPrisma.patient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 500 })
      );
    });
  });

  // ─── findOne ────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('deve lançar NotFoundException quando paciente não existe', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue(null);

      await expect(service.findOne(PATIENT_ID, TENANT)).rejects.toThrow(NotFoundException);
    });

    it('deve lançar NotFoundException para paciente de outro tenant', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue(null); // DB retorna null para tenantId errado

      await expect(service.findOne(PATIENT_ID, OTHER_TENANT)).rejects.toThrow(NotFoundException);

      expect(mockPrisma.patient.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ tenantId: OTHER_TENANT }) })
      );
    });

    it('deve retornar o paciente quando tenant corresponde', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue(basePatient);

      const result = await service.findOne(PATIENT_ID, TENANT);

      expect(result.id).toBe(PATIENT_ID);
    });
  });

  // ─── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    const createDto = {
      name: 'Maria Souza',
      birthDate: '1985-06-15',
      gender: 'FEMALE' as any,
      phone: '+5511988888888',
      cancerType: 'bladder',
    };

    it('deve criar paciente com tenantId correto', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: TENANT,
        settings: { enabledCancerTypes: ['bladder'] },
      });
      mockPrisma.patient.create.mockResolvedValue({ ...basePatient, ...createDto });

      const result = await service.create(createDto as any, TENANT);

      expect(mockPrisma.patient.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tenantId: TENANT }),
        })
      );
      expect(result.name).toBe(createDto.name);
    });

    it('deve lançar BadRequestException para tipo de câncer não habilitado', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: TENANT,
        settings: { enabledCancerTypes: ['bladder'] },
      });

      await expect(
        service.create({ ...createDto, cancerType: 'lung' } as any, TENANT)
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.patient.create).not.toHaveBeenCalled();
    });

    it('deve usar bladder como padrão quando enabledCancerTypes não está configurado', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({ id: TENANT, settings: null });
      mockPrisma.patient.create.mockResolvedValue(basePatient);

      // bladder deve ser permitido no tenant sem configuração explícita
      await expect(service.create(createDto as any, TENANT)).resolves.toBeDefined();
    });

    it('deve normalizar o número de telefone e calcular phoneHash', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: TENANT,
        settings: { enabledCancerTypes: ['bladder'] },
      });
      mockPrisma.patient.create.mockResolvedValue(basePatient);

      await service.create(createDto as any, TENANT);

      const callData = mockPrisma.patient.create.mock.calls[0][0].data;
      expect(callData.phoneHash).toBeDefined();
      expect(callData.phoneHash).not.toBe(createDto.phone); // hash é diferente do telefone bruto
    });
  });

  // ─── update ─────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('deve lançar NotFoundException quando paciente não pertence ao tenant', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue(null);

      await expect(
        service.update(PATIENT_ID, { name: 'Novo Nome' } as any, OTHER_TENANT)
      ).rejects.toThrow(NotFoundException);

      expect(mockPrisma.patient.update).not.toHaveBeenCalled();
    });

    it('deve incluir tenantId no where da query de update', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue(basePatient);
      mockPrisma.patient.update.mockResolvedValue({ ...basePatient, name: 'Novo Nome' });
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: TENANT,
        settings: { enabledCancerTypes: ['bladder'] },
      });

      await service.update(PATIENT_ID, { name: 'Novo Nome' } as any, TENANT);

      expect(mockPrisma.patient.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: PATIENT_ID, tenantId: TENANT },
        })
      );
    });

    it('deve rejeitar tipo de câncer não habilitado ao atualizar', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue(basePatient);
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: TENANT,
        settings: { enabledCancerTypes: ['bladder'] },
      });

      await expect(
        service.update(PATIENT_ID, { cancerType: 'pancreatic' } as any, TENANT)
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── remove ─────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('deve lançar NotFoundException ao remover paciente de outro tenant', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue(null);

      await expect(service.remove(PATIENT_ID, OTHER_TENANT)).rejects.toThrow(NotFoundException);

      expect(mockPrisma.patient.delete).not.toHaveBeenCalled();
    });

    it('deve incluir tenantId no where da query de delete', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue(basePatient);
      mockPrisma.patient.delete.mockResolvedValue(basePatient);

      await service.remove(PATIENT_ID, TENANT);

      expect(mockPrisma.patient.delete).toHaveBeenCalledWith({
        where: { id: PATIENT_ID, tenantId: TENANT },
      });
    });
  });
});
