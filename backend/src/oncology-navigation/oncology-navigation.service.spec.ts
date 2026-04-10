import { BadRequestException, NotFoundException } from '@nestjs/common';
import { JourneyStage, PatientStatus, NavigationStepStatus } from '@generated/prisma/client';
import { AlertsService } from '../alerts/alerts.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  OncologyNavigationService,
  StepConfig,
} from './oncology-navigation.service';

type MockPrisma = {
  patient: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
  };
  patientJourney: {
    findUnique: jest.Mock;
  };
  navigationStep: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    aggregate: jest.Mock;
  };
  alert: {
    findFirst: jest.Mock;
  };
};

const TENANT = 'tenant-abc';
const OTHER_TENANT = 'tenant-xyz';
const PATIENT_ID = 'patient-uuid-1';
const JOURNEY_ID = 'journey-uuid-1';

const basePatient = {
  cancerType: 'bladder',
  status: PatientStatus.ACTIVE,
  cancerDiagnoses: [],
};

const baseJourney = { id: JOURNEY_ID };

describe('OncologyNavigationService', () => {
  let service: OncologyNavigationService;
  let mockPrisma: MockPrisma;

  beforeEach((): void => {
    mockPrisma = {
      patient: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      patientJourney: {
        findUnique: jest.fn(),
      },
      navigationStep: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        aggregate: jest.fn(),
      },
      alert: {
        findFirst: jest.fn(),
      },
    };

    const mockAlertsService = {} as AlertsService;
    service = new OncologyNavigationService(
      mockPrisma as unknown as PrismaService,
      mockAlertsService
    );
  });

  // ─── getAvailableStepTemplates ───────────────────────────────────────────────

  describe('getAvailableStepTemplates', () => {
    it('should throw NotFoundException when patient does not exist', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue(null);

      await expect(
        service.getAvailableStepTemplates(PATIENT_ID, TENANT, JourneyStage.TREATMENT)
      ).rejects.toThrow(NotFoundException);
    });

    it('should not find patient outside tenant scope', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue(null);

      await expect(
        service.getAvailableStepTemplates(PATIENT_ID, OTHER_TENANT, JourneyStage.TREATMENT)
      ).rejects.toThrow(NotFoundException);

      expect(mockPrisma.patient.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: OTHER_TENANT }),
        })
      );
    });

    it('should throw BadRequestException when patient has no cancer type', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue({
        cancerType: null,
        status: PatientStatus.ACTIVE,
        cancerDiagnoses: [],
      });

      await expect(
        service.getAvailableStepTemplates(PATIENT_ID, TENANT, JourneyStage.TREATMENT)
      ).rejects.toThrow(BadRequestException);
    });

    it('should return templates with existingCount = 0 when no steps exist', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue(basePatient);
      mockPrisma.navigationStep.findMany.mockResolvedValue([]);

      const templates = await service.getAvailableStepTemplates(
        PATIENT_ID,
        TENANT,
        JourneyStage.TREATMENT
      );

      expect(templates).toBeInstanceOf(Array);
      expect(templates.length).toBeGreaterThan(0);
      expect(templates[0]).toHaveProperty('stepKey');
      expect(templates[0]).toHaveProperty('stepName');
      expect(templates[0]).toHaveProperty('existingCount', 0);
      for (const t of templates) {
        expect(t.journeyStage).toBe(JourneyStage.TREATMENT);
      }
    });

    it('should count existing instances correctly for base key', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue(basePatient);
      // transurethral_resection is a DIAGNOSIS step for bladder cancer
      // Simulate 2 existing steps: one base + one suffixed
      mockPrisma.navigationStep.findMany.mockResolvedValue([
        { stepKey: 'transurethral_resection' },
        { stepKey: 'transurethral_resection-2' },
      ]);

      const templates = await service.getAvailableStepTemplates(
        PATIENT_ID,
        TENANT,
        JourneyStage.DIAGNOSIS
      );

      const rtu = templates.find((t) => t.stepKey === 'transurethral_resection');
      expect(rtu).toBeDefined();
      expect(rtu!.existingCount).toBe(2);
    });

    it('should only return templates for the requested journeyStage', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue(basePatient);
      mockPrisma.navigationStep.findMany.mockResolvedValue([]);

      const templates = await service.getAvailableStepTemplates(
        PATIENT_ID,
        TENANT,
        JourneyStage.DIAGNOSIS
      );

      for (const t of templates) {
        expect(t.journeyStage).toBe(JourneyStage.DIAGNOSIS);
      }
    });

    it('should use cancerType from cancerDiagnoses when patient.cancerType is null', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue({
        cancerType: null,
        status: PatientStatus.ACTIVE,
        cancerDiagnoses: [{ cancerType: 'BLADDER' }],
      });
      mockPrisma.navigationStep.findMany.mockResolvedValue([]);

      const templates = await service.getAvailableStepTemplates(
        PATIENT_ID,
        TENANT,
        JourneyStage.TREATMENT
      );

      expect(templates.length).toBeGreaterThan(0);
    });

    it('returns palliative templates when journeyStage is PALLIATIVE even if patient status is ACTIVE', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue({
        cancerType: 'breast',
        status: PatientStatus.ACTIVE,
        cancerDiagnoses: [],
      });
      mockPrisma.navigationStep.findMany.mockResolvedValue([]);

      const templates = await service.getAvailableStepTemplates(
        PATIENT_ID,
        TENANT,
        JourneyStage.PALLIATIVE
      );

      expect(templates.length).toBeGreaterThan(0);
      expect(templates.map((t) => t.stepKey)).toContain('palliative_comfort_care');
    });
  });

  // ─── createStepFromTemplate ──────────────────────────────────────────────────

  describe('createStepFromTemplate', () => {
    it('should throw NotFoundException when patient does not exist', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue(null);

      await expect(
        service.createStepFromTemplate(
          PATIENT_ID,
          TENANT,
          JourneyStage.TREATMENT,
          'intravesical_bcg'
        )
      ).rejects.toThrow(NotFoundException);
    });

    it('should not create step for patient outside tenant scope', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue(null);

      await expect(
        service.createStepFromTemplate(
          PATIENT_ID,
          OTHER_TENANT,
          JourneyStage.TREATMENT,
          'intravesical_bcg'
        )
      ).rejects.toThrow(NotFoundException);

      expect(mockPrisma.patient.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: OTHER_TENANT }),
        })
      );
    });

    it('should throw NotFoundException when template stepKey does not exist', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue(basePatient);
      mockPrisma.navigationStep.findMany.mockResolvedValue([]);

      await expect(
        service.createStepFromTemplate(
          PATIENT_ID,
          TENANT,
          JourneyStage.TREATMENT,
          'nonexistent_step_key'
        )
      ).rejects.toThrow(NotFoundException);
    });

    it('should create first instance with base stepKey when none exists', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue(basePatient);
      // intravesical_bcg is a valid TREATMENT step for bladder cancer
      mockPrisma.navigationStep.findMany.mockResolvedValue([]);
      mockPrisma.patientJourney.findUnique.mockResolvedValue(baseJourney);

      const createdStep = {
        id: 'step-uuid-1',
        stepKey: 'intravesical_bcg',
        stepName: 'BCG Intravesical',
        journeyStage: JourneyStage.TREATMENT,
        tenantId: TENANT,
        patientId: PATIENT_ID,
        status: NavigationStepStatus.PENDING,
        isCompleted: false,
        dueDate: null,
        expectedDate: null,
      };
      mockPrisma.navigationStep.create.mockResolvedValue(createdStep);

      const result = await service.createStepFromTemplate(
        PATIENT_ID,
        TENANT,
        JourneyStage.TREATMENT,
        'intravesical_bcg'
      );

      expect(result.stepKey).toBe('intravesical_bcg');
      expect(mockPrisma.navigationStep.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            stepKey: 'intravesical_bcg',
            tenantId: TENANT,
            patientId: PATIENT_ID,
          }),
        })
      );
    });

    it('should create second instance with -2 suffix when one already exists', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue(basePatient);
      mockPrisma.navigationStep.findMany.mockResolvedValue([
        { stepKey: 'intravesical_bcg' },
      ]);
      mockPrisma.patientJourney.findUnique.mockResolvedValue(baseJourney);

      const createdStep = {
        id: 'step-uuid-2',
        stepKey: 'intravesical_bcg-2',
        journeyStage: JourneyStage.TREATMENT,
        tenantId: TENANT,
        patientId: PATIENT_ID,
        status: NavigationStepStatus.PENDING,
        isCompleted: false,
        dueDate: null,
        expectedDate: null,
      };
      mockPrisma.navigationStep.create.mockResolvedValue(createdStep);

      const result = await service.createStepFromTemplate(
        PATIENT_ID,
        TENANT,
        JourneyStage.TREATMENT,
        'intravesical_bcg'
      );

      expect(result.stepKey).toBe('intravesical_bcg-2');
      expect(mockPrisma.navigationStep.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ stepKey: 'intravesical_bcg-2' }),
        })
      );
    });

    it('should create third instance with -3 suffix when two already exist', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue(basePatient);
      mockPrisma.navigationStep.findMany.mockResolvedValue([
        { stepKey: 'intravesical_bcg' },
        { stepKey: 'intravesical_bcg-2' },
      ]);
      mockPrisma.patientJourney.findUnique.mockResolvedValue(baseJourney);

      const createdStep = {
        id: 'step-uuid-3',
        stepKey: 'intravesical_bcg-3',
        journeyStage: JourneyStage.TREATMENT,
        tenantId: TENANT,
        patientId: PATIENT_ID,
        status: NavigationStepStatus.PENDING,
        isCompleted: false,
        dueDate: null,
        expectedDate: null,
      };
      mockPrisma.navigationStep.create.mockResolvedValue(createdStep);

      const result = await service.createStepFromTemplate(
        PATIENT_ID,
        TENANT,
        JourneyStage.TREATMENT,
        'intravesical_bcg'
      );

      expect(result.stepKey).toBe('intravesical_bcg-3');
    });

    it('should create step with PENDING status and no dueDate', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue(basePatient);
      mockPrisma.navigationStep.findMany.mockResolvedValue([]);
      mockPrisma.patientJourney.findUnique.mockResolvedValue(baseJourney);

      const createdStep = {
        id: 'step-uuid-1',
        stepKey: 'intravesical_bcg',
        status: NavigationStepStatus.PENDING,
        isCompleted: false,
        dueDate: null,
        expectedDate: null,
      };
      mockPrisma.navigationStep.create.mockResolvedValue(createdStep);

      const result = await service.createStepFromTemplate(
        PATIENT_ID,
        TENANT,
        JourneyStage.TREATMENT,
        'intravesical_bcg'
      );

      expect(result.status).toBe(NavigationStepStatus.PENDING);
      expect(result.isCompleted).toBe(false);
      expect(result.dueDate).toBeNull();
      expect(mockPrisma.navigationStep.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: NavigationStepStatus.PENDING,
            isCompleted: false,
            expectedDate: null,
            dueDate: null,
          }),
        })
      );
    });
  });

  // ─── createMissingStepsForStage ──────────────────────────────────────────────

  describe('createMissingStepsForStage', () => {
    it('should throw NotFoundException when patient does not exist', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue(null);

      await expect(
        service.createMissingStepsForStage(PATIENT_ID, TENANT, JourneyStage.TREATMENT)
      ).rejects.toThrow(NotFoundException);
    });

    it('should not process patient outside tenant scope', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue(null);

      await expect(
        service.createMissingStepsForStage(PATIENT_ID, OTHER_TENANT, JourneyStage.TREATMENT)
      ).rejects.toThrow(NotFoundException);

      expect(mockPrisma.patient.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: OTHER_TENANT }),
        })
      );
    });

    it('should throw BadRequestException when patient has no cancer type', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue({
        cancerType: null,
        status: PatientStatus.ACTIVE,
        cancerDiagnoses: [],
      });

      await expect(
        service.createMissingStepsForStage(PATIENT_ID, TENANT, JourneyStage.TREATMENT)
      ).rejects.toThrow(BadRequestException);
    });

    it('should return { created: 0, skipped: N } when all steps already exist', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue(basePatient);

      const allTreatmentKeys = [
        'intravesical_bcg',
        'radical_cystectomy',
        'neobladder_or_urostomy',
        'chemotherapy',
        'transurethral_resection_therapeutic',
        'specialist_consultation',
        'navigation_consultation',
      ];
      mockPrisma.navigationStep.findMany.mockResolvedValue(
        allTreatmentKeys.map((stepKey) => ({ stepKey }))
      );

      const result = await service.createMissingStepsForStage(
        PATIENT_ID,
        TENANT,
        JourneyStage.TREATMENT
      );

      expect(result.created).toBe(0);
      expect(result.skipped).toBe(allTreatmentKeys.length);
      expect(mockPrisma.navigationStep.create).not.toHaveBeenCalled();
    });

    it('should only create steps that are missing', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue(basePatient);
      mockPrisma.patientJourney.findUnique.mockResolvedValue(baseJourney);

      // Only one step exists
      mockPrisma.navigationStep.findMany.mockResolvedValue([
        { stepKey: 'intravesical_bcg' },
      ]);

      mockPrisma.navigationStep.create.mockResolvedValue({
        id: 'new-step',
        stepKey: 'radical_cystectomy',
        dueDate: null,
        isCompleted: false,
      });

      const result = await service.createMissingStepsForStage(
        PATIENT_ID,
        TENANT,
        JourneyStage.TREATMENT
      );

      expect(result.created).toBeGreaterThan(0);
      expect(result.skipped).toBe(1);

      // Verify it did NOT attempt to create intravesical_bcg again
      const createCalls = mockPrisma.navigationStep.create.mock.calls;
      const createdKeys = createCalls.map((call: any) => call[0].data.stepKey as string);
      expect(createdKeys).not.toContain('intravesical_bcg');
    });

    it('should not treat suffixed key as equivalent to base key', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue(basePatient);
      mockPrisma.patientJourney.findUnique.mockResolvedValue(baseJourney);

      // Only a suffixed version exists, NOT the base key
      mockPrisma.navigationStep.findMany.mockResolvedValue([
        { stepKey: 'intravesical_bcg-2' },
      ]);

      mockPrisma.navigationStep.create.mockResolvedValue({
        id: 'new-step',
        stepKey: 'intravesical_bcg',
        dueDate: null,
        isCompleted: false,
      });

      const result = await service.createMissingStepsForStage(
        PATIENT_ID,
        TENANT,
        JourneyStage.TREATMENT
      );

      const createCalls = mockPrisma.navigationStep.create.mock.calls;
      const createdKeys = createCalls.map((call: any) => call[0].data.stepKey as string);
      expect(createdKeys).toContain('intravesical_bcg');
      expect(result.created).toBeGreaterThan(0);
    });

    it('should return correct counts when all steps are missing', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue(basePatient);
      mockPrisma.patientJourney.findUnique.mockResolvedValue(baseJourney);
      mockPrisma.navigationStep.findMany.mockResolvedValue([]);

      mockPrisma.navigationStep.create.mockResolvedValue({
        id: 'new-step',
        stepKey: 'any',
        dueDate: null,
        isCompleted: false,
      });

      const result = await service.createMissingStepsForStage(
        PATIENT_ID,
        TENANT,
        JourneyStage.TREATMENT
      );

      expect(result.created).toBeGreaterThan(0);
      expect(result.skipped).toBe(0);
    });

    it('creates all missing steps when onlyStepKey is omitted (undefined)', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue({
        cancerType: 'breast',
        status: PatientStatus.ACTIVE,
        cancerDiagnoses: [],
      });
      mockPrisma.patientJourney.findUnique.mockResolvedValue({ id: 'journey-1' });
      mockPrisma.navigationStep.findMany.mockResolvedValue([]);
      mockPrisma.navigationStep.create.mockResolvedValue({ id: 'step-created' });

      const stepConfigs: StepConfig[] = [
        {
          journeyStage: JourneyStage.DIAGNOSIS,
          stepKey: 'step-a',
          stepName: 'Step A',
          stepDescription: 'A',
          isRequired: true,
          dependsOnStepKey: null,
          relativeDaysMin: null,
          relativeDaysMax: null,
          stepOrder: 1,
        },
        {
          journeyStage: JourneyStage.DIAGNOSIS,
          stepKey: 'step-b',
          stepName: 'Step B',
          stepDescription: 'B',
          isRequired: true,
          dependsOnStepKey: null,
          relativeDaysMin: null,
          relativeDaysMax: null,
          stepOrder: 2,
        },
      ];

      jest
        .spyOn(
          service as unknown as {
            getStepConfigs: (
              cancerType: string,
              status?: string | null,
              currentStage?: JourneyStage
            ) => StepConfig[];
          },
          'getStepConfigs'
        )
        .mockReturnValue(stepConfigs);

      const result = await service.createMissingStepsForStage(
        'patient-1',
        'tenant-1',
        JourneyStage.DIAGNOSIS
      );

      expect(result.created).toBe(2);
      expect(mockPrisma.navigationStep.create).toHaveBeenCalledTimes(2);
    });

    it('creates only the requested step when onlyStepKey is provided', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue({
        cancerType: 'breast',
        status: PatientStatus.ACTIVE,
        cancerDiagnoses: [],
      });
      mockPrisma.patientJourney.findUnique.mockResolvedValue({ id: 'journey-1' });
      mockPrisma.navigationStep.findMany.mockResolvedValue([]);
      mockPrisma.navigationStep.create.mockResolvedValue({ id: 'step-created' });

      const stepConfigs: StepConfig[] = [
        {
          journeyStage: JourneyStage.DIAGNOSIS,
          stepKey: 'step-a',
          stepName: 'Step A',
          stepDescription: 'A',
          isRequired: true,
          dependsOnStepKey: null,
          relativeDaysMin: null,
          relativeDaysMax: null,
          stepOrder: 1,
        },
        {
          journeyStage: JourneyStage.DIAGNOSIS,
          stepKey: 'step-b',
          stepName: 'Step B',
          stepDescription: 'B',
          isRequired: true,
          dependsOnStepKey: null,
          relativeDaysMin: null,
          relativeDaysMax: null,
          stepOrder: 2,
        },
      ];

      jest
        .spyOn(
          service as unknown as {
            getStepConfigs: (
              cancerType: string,
              status?: string | null,
              currentStage?: JourneyStage
            ) => StepConfig[];
          },
          'getStepConfigs'
        )
        .mockReturnValue(stepConfigs);

      const result = await service.createMissingStepsForStage(
        'patient-1',
        'tenant-1',
        JourneyStage.DIAGNOSIS,
        'step-b'
      );

      expect(result.created).toBe(1);
      expect(mockPrisma.navigationStep.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.navigationStep.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ stepKey: 'step-b' }),
        })
      );
    });

    it('creates missing palliative steps for PALLIATIVE stage even when status is ACTIVE', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue({
        cancerType: 'breast',
        status: PatientStatus.ACTIVE,
        cancerDiagnoses: [],
      });
      mockPrisma.patientJourney.findUnique.mockResolvedValue({ id: 'journey-1' });
      mockPrisma.navigationStep.findMany.mockResolvedValue([]);
      mockPrisma.navigationStep.create.mockResolvedValue({ id: 'step-created' });

      const result = await service.createMissingStepsForStage(
        PATIENT_ID,
        TENANT,
        JourneyStage.PALLIATIVE
      );

      expect(result.created).toBeGreaterThan(0);
      const createdStepKeys = mockPrisma.navigationStep.create.mock.calls.map(
        (args: any) => (args[0] as { data: { stepKey: string } }).data.stepKey
      );
      expect(createdStepKeys).toContain('palliative_comfort_care');
    });
  });

  // ─── initializeAllPatientsSteps ──────────────────────────────────────────────

  describe('initializeAllPatientsSteps', () => {
    it('reinitializes patients that already have legacy navigation steps', async () => {
      mockPrisma.patient.findMany.mockResolvedValue([
        {
          id: 'patient-legacy',
          cancerType: 'breast',
          currentStage: JourneyStage.DIAGNOSIS,
          cancerDiagnoses: [],
          navigationSteps: [{ id: 'existing-step' }],
        },
      ]);
      mockPrisma.navigationStep.findFirst.mockResolvedValue({ id: 'legacy-step' });

      const initializeSpy = jest
        .spyOn(
          service as unknown as {
            initializeNavigationSteps: (
              patientId: string,
              tenantId: string,
              cancerType: string,
              stage: JourneyStage
            ) => Promise<void>;
          },
          'initializeNavigationSteps'
        )
        .mockResolvedValue(undefined);

      const result = await service.initializeAllPatientsSteps('tenant-1');

      expect(result).toEqual({ initialized: 1, skipped: 0, errors: 0 });
      expect(initializeSpy).toHaveBeenCalledWith(
        'patient-legacy',
        'tenant-1',
        'breast',
        JourneyStage.DIAGNOSIS
      );
    });

    it('skips patients that already have non-legacy navigation graph', async () => {
      mockPrisma.patient.findMany.mockResolvedValue([
        {
          id: 'patient-modern',
          cancerType: 'breast',
          currentStage: JourneyStage.DIAGNOSIS,
          cancerDiagnoses: [],
          navigationSteps: [{ id: 'existing-step' }],
        },
      ]);
      mockPrisma.navigationStep.findFirst.mockResolvedValue(null);

      const initializeSpy = jest
        .spyOn(
          service as unknown as {
            initializeNavigationSteps: (
              patientId: string,
              tenantId: string,
              cancerType: string,
              stage: JourneyStage
            ) => Promise<void>;
          },
          'initializeNavigationSteps'
        )
        .mockResolvedValue(undefined);

      const result = await service.initializeAllPatientsSteps('tenant-1');

      expect(result).toEqual({ initialized: 0, skipped: 1, errors: 0 });
      expect(initializeSpy).not.toHaveBeenCalled();
    });

    it('initializes patients with no existing navigation steps', async () => {
      mockPrisma.patient.findMany.mockResolvedValue([
        {
          id: 'patient-empty',
          cancerType: 'breast',
          currentStage: JourneyStage.SCREENING,
          cancerDiagnoses: [],
          navigationSteps: [],
        },
      ]);

      const initializeSpy = jest
        .spyOn(
          service as unknown as {
            initializeNavigationSteps: (
              patientId: string,
              tenantId: string,
              cancerType: string,
              stage: JourneyStage
            ) => Promise<void>;
          },
          'initializeNavigationSteps'
        )
        .mockResolvedValue(undefined);

      const result = await service.initializeAllPatientsSteps('tenant-1');

      expect(result).toEqual({ initialized: 1, skipped: 0, errors: 0 });
      expect(initializeSpy).toHaveBeenCalledWith(
        'patient-empty',
        'tenant-1',
        'breast',
        JourneyStage.SCREENING
      );
    });
  });

  describe('updateStep — journeyStage (mover etapa)', () => {
    it('should update stage, clear dependencies and assign next stepOrder', async () => {
      const existing = {
        id: 'step-move-1',
        tenantId: TENANT,
        patientId: PATIENT_ID,
        journeyStage: JourneyStage.DIAGNOSIS,
        isCompleted: false,
        dependsOnStepKey: 'cystoscopy',
        relativeDaysMin: 1,
        relativeDaysMax: 7,
        expectedDate: null,
        dueDate: null,
        status: NavigationStepStatus.PENDING,
        actualDate: null,
        completedAt: null,
      };
      mockPrisma.navigationStep.findFirst.mockResolvedValue(existing);
      mockPrisma.navigationStep.aggregate.mockResolvedValue({
        _max: { stepOrder: 5 },
      });
      mockPrisma.navigationStep.update.mockResolvedValue({
        ...existing,
        journeyStage: JourneyStage.TREATMENT,
        stepOrder: 6,
        dependsOnStepKey: null,
        relativeDaysMin: null,
        relativeDaysMax: null,
        expectedDate: null,
        dueDate: null,
      });

      await service.updateStep(
        'step-move-1',
        { journeyStage: JourneyStage.TREATMENT },
        TENANT
      );

      expect(mockPrisma.navigationStep.aggregate).toHaveBeenCalledWith({
        where: {
          patientId: PATIENT_ID,
          tenantId: TENANT,
          journeyStage: JourneyStage.TREATMENT,
        },
        _max: { stepOrder: true },
      });
      expect(mockPrisma.navigationStep.update).toHaveBeenCalledWith({
        where: { id: 'step-move-1', tenantId: TENANT },
        data: expect.objectContaining({
          journeyStage: JourneyStage.TREATMENT,
          stepOrder: 6,
          dependsOnStepKey: null,
          relativeDaysMin: null,
          relativeDaysMax: null,
          expectedDate: null,
          dueDate: null,
        }),
      });
    });
  });
});
