import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DispositionFeedbackService } from './disposition-feedback.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  patient: {
    findFirst: jest.fn(),
  },
  clinicalDispositionFeedback: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  $queryRaw: jest.fn(),
};

const TENANT = 'tenant-abc';
const USER_ID = 'user-1';
const PATIENT_ID = 'patient-1';

const baseFeedback = {
  id: 'fb-1',
  tenantId: TENANT,
  patientId: PATIENT_ID,
  predictedDisposition: 'ER_DAYS',
  correctedDisposition: 'ER_IMMEDIATE',
  correctedBy: USER_ID,
  predictionSource: 'ML',
  predictionConfidence: 0.72,
  createdAt: new Date(),
};

describe('DispositionFeedbackService', () => {
  let service: DispositionFeedbackService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DispositionFeedbackService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<DispositionFeedbackService>(DispositionFeedbackService);
  });

  // ─── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    const dto = {
      patientId: PATIENT_ID,
      predictedDisposition: 'ER_DAYS',
      correctedDisposition: 'ER_IMMEDIATE',
      predictionSource: 'ML',
      predictionConfidence: 0.72,
    };

    it('deve criar feedback com tenantId e correctedBy corretos', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue({ id: PATIENT_ID });
      mockPrisma.clinicalDispositionFeedback.create.mockResolvedValue(baseFeedback);

      await service.create(dto as any, TENANT, USER_ID);

      expect(mockPrisma.clinicalDispositionFeedback.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: TENANT,
            patientId: PATIENT_ID,
            correctedBy: USER_ID,
            predictedDisposition: 'ER_DAYS',
            correctedDisposition: 'ER_IMMEDIATE',
          }),
        })
      );
    });

    it('deve lançar NotFoundException se paciente não pertence ao tenant', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue(null);

      await expect(service.create(dto as any, TENANT, USER_ID)).rejects.toThrow(
        NotFoundException
      );
      expect(mockPrisma.clinicalDispositionFeedback.create).not.toHaveBeenCalled();
    });
  });

  // ─── findByTenant ────────────────────────────────────────────────────────────

  describe('findByTenant', () => {
    it('deve retornar feedbacks ordenados por data decrescente', async () => {
      mockPrisma.clinicalDispositionFeedback.findMany.mockResolvedValue([baseFeedback]);

      const result = await service.findByTenant(TENANT);

      expect(result).toEqual([baseFeedback]);
      expect(mockPrisma.clinicalDispositionFeedback.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: TENANT },
          orderBy: { createdAt: 'desc' },
          take: 200,
        })
      );
    });

    it('deve respeitar o limite customizado', async () => {
      mockPrisma.clinicalDispositionFeedback.findMany.mockResolvedValue([]);

      await service.findByTenant(TENANT, 50);

      expect(mockPrisma.clinicalDispositionFeedback.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50 })
      );
    });

    it('deve limitar take a no máximo 500', async () => {
      mockPrisma.clinicalDispositionFeedback.findMany.mockResolvedValue([]);

      await service.findByTenant(TENANT, 99_999);

      expect(mockPrisma.clinicalDispositionFeedback.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 500 })
      );
    });
  });

  // ─── exportTrainingData ──────────────────────────────────────────────────────

  describe('exportTrainingData', () => {
    it('deve exportar com label = correctedDisposition', async () => {
      mockPrisma.clinicalDispositionFeedback.findMany.mockResolvedValue([
        {
          featureSnapshot: { fever: true, chemoDay: 8 },
          correctedDisposition: 'ER_IMMEDIATE',
          predictionSource: 'ML',
          createdAt: new Date(),
        },
      ]);

      const result = await service.exportTrainingData(TENANT);

      expect(result).toHaveLength(1);
      const row = result[0] as any;
      expect(row.label).toBe('ER_IMMEDIATE');
      expect(row.fever).toBe(true);
      expect(row.chemoDay).toBe(8);
    });

    it('deve incluir prediction_source no export', async () => {
      mockPrisma.clinicalDispositionFeedback.findMany.mockResolvedValue([
        {
          featureSnapshot: {},
          correctedDisposition: 'ADVANCE_CONSULT',
          predictionSource: 'RULES',
          createdAt: new Date(),
        },
      ]);

      const result = await service.exportTrainingData(TENANT);

      expect(result[0].prediction_source).toBe('RULES');
    });

    it('deve sempre filtrar por tenantId no export', async () => {
      mockPrisma.clinicalDispositionFeedback.findMany.mockResolvedValue([]);

      await service.exportTrainingData(TENANT);

      expect(mockPrisma.clinicalDispositionFeedback.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: TENANT } })
      );
    });

    it('deve não incluir patientId no export (dados anonimizados)', async () => {
      mockPrisma.clinicalDispositionFeedback.findMany.mockResolvedValue([
        {
          featureSnapshot: { ecogScore: 1 },
          correctedDisposition: 'SCHEDULED_CONSULT',
          predictionSource: 'ML',
          createdAt: new Date(),
        },
      ]);

      const result = await service.exportTrainingData(TENANT);

      expect(result[0]).not.toHaveProperty('patientId');
    });

    it('deve repassar limit e offset ao findMany', async () => {
      mockPrisma.clinicalDispositionFeedback.findMany.mockResolvedValue([]);

      await service.exportTrainingData(TENANT, { limit: 500, offset: 1000 });

      expect(mockPrisma.clinicalDispositionFeedback.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: TENANT },
          take: 500,
          skip: 1000,
        })
      );
    });
  });

  // ─── stats ───────────────────────────────────────────────────────────────────

  describe('stats', () => {
    it('deve retornar total e contagem de correções', async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{ total: 3n, corrections: 1n }])
        .mockResolvedValueOnce([
          { predictedDisposition: 'ER_DAYS', total: 2n, correct: 1n },
          { predictedDisposition: 'ADVANCE_CONSULT', total: 1n, correct: 1n },
        ]);

      const result = await service.stats(TENANT);

      expect(result.total).toBe(3);
      expect(result.corrections).toBe(1);
    });

    it('deve calcular accuracy corretamente (2/3)', async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{ total: 3n, corrections: 1n }])
        .mockResolvedValueOnce([]);

      const result = await service.stats(TENANT);

      expect(result.accuracy).toBeCloseTo(2 / 3);
    });

    it('deve retornar accuracy null quando total é zero', async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{ total: 0n, corrections: 0n }])
        .mockResolvedValueOnce([]);

      const result = await service.stats(TENANT);

      expect(result.total).toBe(0);
      expect(result.accuracy).toBeNull();
    });

    it('deve calcular classAccuracy por classe prevista', async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{ total: 2n, corrections: 1n }])
        .mockResolvedValueOnce([
          { predictedDisposition: 'ER_DAYS', total: 2n, correct: 1n },
        ]);

      const result = await service.stats(TENANT);

      expect(result.classAccuracy['ER_DAYS'].total).toBe(2);
      expect(result.classAccuracy['ER_DAYS'].correct).toBe(1);
    });
  });
});
