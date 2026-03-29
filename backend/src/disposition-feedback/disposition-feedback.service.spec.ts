import { Test, TestingModule } from '@nestjs/testing';
import { DispositionFeedbackService } from './disposition-feedback.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  clinicalDispositionFeedback: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
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

    it('deve exportar sem filtro de tenant quando tenantId não fornecido', async () => {
      mockPrisma.clinicalDispositionFeedback.findMany.mockResolvedValue([]);

      await service.exportTrainingData();

      expect(mockPrisma.clinicalDispositionFeedback.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} })
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
  });

  // ─── stats ───────────────────────────────────────────────────────────────────

  describe('stats', () => {
    it('deve retornar total e contagem de correções', async () => {
      mockPrisma.clinicalDispositionFeedback.findMany.mockResolvedValue([
        { predictedDisposition: 'ER_DAYS', correctedDisposition: 'ER_IMMEDIATE' }, // correção
        { predictedDisposition: 'ER_DAYS', correctedDisposition: 'ER_DAYS' }, // correto
        { predictedDisposition: 'ADVANCE_CONSULT', correctedDisposition: 'ADVANCE_CONSULT' }, // correto
      ]);

      const result = await service.stats(TENANT);

      expect(result.total).toBe(3);
      expect(result.corrections).toBe(1);
    });

    it('deve calcular accuracy corretamente (2/3)', async () => {
      mockPrisma.clinicalDispositionFeedback.findMany.mockResolvedValue([
        { predictedDisposition: 'ER_DAYS', correctedDisposition: 'ER_IMMEDIATE' }, // errado
        { predictedDisposition: 'ER_DAYS', correctedDisposition: 'ER_DAYS' }, // certo
        { predictedDisposition: 'ADVANCE_CONSULT', correctedDisposition: 'ADVANCE_CONSULT' }, // certo
      ]);

      const result = await service.stats(TENANT);

      expect(result.accuracy).toBeCloseTo(2 / 3);
    });

    it('deve retornar accuracy null quando total é zero', async () => {
      mockPrisma.clinicalDispositionFeedback.findMany.mockResolvedValue([]);

      const result = await service.stats(TENANT);

      expect(result.total).toBe(0);
      expect(result.accuracy).toBeNull();
    });

    it('deve calcular classAccuracy por classe prevista', async () => {
      mockPrisma.clinicalDispositionFeedback.findMany.mockResolvedValue([
        { predictedDisposition: 'ER_DAYS', correctedDisposition: 'ER_DAYS' },
        { predictedDisposition: 'ER_DAYS', correctedDisposition: 'ER_IMMEDIATE' },
      ]);

      const result = await service.stats(TENANT);

      expect(result.classAccuracy['ER_DAYS'].total).toBe(2);
      expect(result.classAccuracy['ER_DAYS'].correct).toBe(1);
    });
  });
});
