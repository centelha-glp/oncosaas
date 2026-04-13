import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { OncologyNavigationScheduler } from './oncology-navigation.scheduler';
import { OncologyNavigationService } from './oncology-navigation.service';
import { PrismaService } from '../prisma/prisma.service';
import { AlertsService } from '../alerts/alerts.service';

const mockPrisma = {
  tenant: { findMany: jest.fn() },
  patient: {
    findMany: jest.fn(),
    update: jest.fn(),
  },
};

const mockNavigationService = {
  checkOverdueSteps: jest.fn(),
};

const mockAlertsService = {
  create: jest.fn(),
};

const mockConfig = {
  get: jest.fn((key: string) => {
    if (key === 'AI_SERVICE_URL') {
      return 'http://ai-service:8001';
    }
    return undefined;
  }),
};

const TENANT_ID = 'tenant-uuid-1';
const TENANT_NAME = 'Hospital Teste';

describe('OncologyNavigationScheduler', () => {
  let scheduler: OncologyNavigationScheduler;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OncologyNavigationScheduler,
        { provide: OncologyNavigationService, useValue: mockNavigationService },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AlertsService, useValue: mockAlertsService },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    scheduler = module.get<OncologyNavigationScheduler>(OncologyNavigationScheduler);
  });

  describe('handleOverdueStepsCheck', () => {
    it('deve iterar sobre todos os tenants e chamar checkOverdueSteps', async () => {
      mockPrisma.tenant.findMany.mockResolvedValue([
        { id: TENANT_ID, name: TENANT_NAME },
      ]);
      mockNavigationService.checkOverdueSteps.mockResolvedValue({
        checked: 5,
        markedOverdue: 1,
        alertsCreated: 1,
      });

      await scheduler.handleOverdueStepsCheck();

      expect(mockNavigationService.checkOverdueSteps).toHaveBeenCalledWith(TENANT_ID);
    });

    it('nao deve lançar quando nenhum tenant existe', async () => {
      mockPrisma.tenant.findMany.mockResolvedValue([]);

      await expect(scheduler.handleOverdueStepsCheck()).resolves.not.toThrow();
      expect(mockNavigationService.checkOverdueSteps).not.toHaveBeenCalled();
    });
  });

  describe('handleAIPriorityRecalculation — tenant isolation no update', () => {
    it('deve incluir tenantId no where do patient.update ao processar resultados da IA', async () => {
      const PATIENT_ID = 'patient-uuid-1';
      const OTHER_TENANT_ID = 'tenant-uuid-other';

      mockPrisma.tenant.findMany.mockResolvedValue([
        { id: TENANT_ID, name: TENANT_NAME },
        { id: OTHER_TENANT_ID, name: 'Outro Hospital' },
      ]);
      mockPrisma.patient.findMany.mockResolvedValue([
        { id: PATIENT_ID },
      ]);

      // Mock global.fetch para simular resposta do AI Service
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          results: [
            {
              patient_id: PATIENT_ID,
              priority_score: 75,
              priority_category: 'high',
              reason: 'Dor elevada',
            },
          ],
        }),
      });
      global.fetch = mockFetch as any;

      mockPrisma.patient.update.mockResolvedValue({ id: PATIENT_ID });

      await scheduler.handleDailyPriorityRecalculation();

      // Verificar que cada chamada a patient.update contém tenantId no where
      const updateCalls = mockPrisma.patient.update.mock.calls;
      expect(updateCalls.length).toBeGreaterThan(0);

      for (const [args] of updateCalls) {
        expect(args.where).toHaveProperty('tenantId');
        // tenantId no where deve ser o tenant do contexto, nunca ausente
        expect(args.where.tenantId).toBeDefined();
      }
    });

    it('nao deve atualizar paciente de outro tenant com o tenantId errado', async () => {
      const PATIENT_ID_TENANT_A = 'patient-uuid-tenant-a';

      mockPrisma.tenant.findMany.mockResolvedValue([
        { id: TENANT_ID, name: TENANT_NAME },
      ]);
      mockPrisma.patient.findMany.mockResolvedValue([
        { id: PATIENT_ID_TENANT_A },
      ]);

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          results: [
            {
              patient_id: PATIENT_ID_TENANT_A,
              priority_score: 50,
              priority_category: 'medium',
              reason: 'Monitoramento rotineiro',
            },
          ],
        }),
      });
      global.fetch = mockFetch as any;
      mockPrisma.patient.update.mockResolvedValue({ id: PATIENT_ID_TENANT_A });

      await scheduler.handleDailyPriorityRecalculation();

      // Verificar que o update usa o tenantId do tenant iterado (TENANT_ID), nunca omitido
      expect(mockPrisma.patient.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: PATIENT_ID_TENANT_A,
            tenantId: TENANT_ID,
          }),
        })
      );
    });
  });
});
