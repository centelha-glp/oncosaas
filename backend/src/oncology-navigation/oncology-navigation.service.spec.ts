import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  JourneyStage,
  PatientStatus,
  NavigationStepStatus,
  AppointmentConfirmationStatus,
  ClinicalSubrole,
  UserRole,
  ConsultationAttendance,
} from '@generated/prisma/client';
import { AlertsService } from '../alerts/alerts.service';
import { ChannelGatewayService } from '../channel-gateway/channel-gateway.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  OncologyNavigationService,
  StepConfig,
} from './oncology-navigation.service';
import { ConsultationAgendaAvailabilityService } from './consultation-agenda-availability.service';

type MockPrisma = {
  $transaction: jest.Mock;
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
    count: jest.Mock;
  };
  consultationAgendaConfig: {
    findFirst: jest.Mock;
    upsert: jest.Mock;
  };
  consultationAgendaBlock: {
    findMany: jest.Mock;
    create: jest.Mock;
    deleteMany: jest.Mock;
    count: jest.Mock;
  };
  alert: {
    findFirst: jest.Mock;
  };
  conversation: {
    findFirst: jest.Mock;
  };
  scheduledAction: {
    updateMany: jest.Mock;
    create: jest.Mock;
  };
  user: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
  };
  cancerDiagnosis: {
    findFirst: jest.Mock;
  };
};

const TENANT = 'tenant-abc';
const OTHER_TENANT = 'tenant-xyz';
const PATIENT_ID = 'patient-uuid-1';
const JOURNEY_ID = 'journey-uuid-1';
const PROFESSIONAL_ID = 'professional-uuid-1';
const OTHER_ONCOLOGIST_ID = 'other-oncologist-uuid';
const ACTING_ONCOLOGIST_ID = 'acting-oncologist-uuid';

const basePatient = {
  cancerType: 'bladder',
  status: PatientStatus.ACTIVE,
  cancerDiagnoses: [],
};

const baseJourney = { id: JOURNEY_ID };

const mockAgendaConfigRow = (whatsappConfirmationLeadHours: number) => ({
  defaultConsultationDurationMinutes: 30,
  maxConsultationsPerDay: null as number | null,
  weeklyPattern: {
    activeWeekdays: [1, 2, 3, 4, 5],
    shifts: [{ startLocal: '08:00', endLocal: '12:00' }],
  },
  whatsappConfirmationLeadHours,
});

describe('OncologyNavigationService', () => {
  let service: OncologyNavigationService;
  let mockPrisma: MockPrisma;
  let mockChannelGateway: { sendMessage: jest.Mock };
  let consultationAgendaAvailability: ConsultationAgendaAvailabilityService;

  beforeEach((): void => {
    mockPrisma = {
      $transaction: jest.fn(),
      patient: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      patientJourney: {
        findUnique: jest.fn(),
      },
      navigationStep: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        aggregate: jest.fn(),
        count: jest.fn(),
      },
      alert: {
        findFirst: jest.fn(),
      },
      conversation: {
        findFirst: jest.fn(),
      },
      scheduledAction: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn(),
      },
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: PROFESSIONAL_ID,
          role: UserRole.ONCOLOGIST,
          clinicalSubrole: null,
        }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      consultationAgendaConfig: {
        findFirst: jest.fn().mockResolvedValue(null),
        upsert: jest.fn(),
      },
      consultationAgendaBlock: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        deleteMany: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      cancerDiagnosis: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };

    const mockAlertsService = {} as AlertsService;
    consultationAgendaAvailability = new ConsultationAgendaAvailabilityService(
      mockPrisma as unknown as PrismaService
    );
    mockChannelGateway = {
      sendMessage: jest.fn().mockResolvedValue({
        message: { id: 'msg-1' },
        sendResult: { success: true, externalMessageId: 'ext-1' },
      }),
    };
    service = new OncologyNavigationService(
      mockPrisma as unknown as PrismaService,
      mockAlertsService,
      consultationAgendaAvailability,
      mockChannelGateway as unknown as ChannelGatewayService
    );
  });

  describe('listConsultationAgendaSchedulableProfessionals', () => {
    it('filtra por tenantId e exclui perfis sem slot na agenda', async () => {
      mockPrisma.user.findMany.mockResolvedValueOnce([
        {
          id: 'u-onc',
          name: 'Onco',
          role: UserRole.ONCOLOGIST,
          clinicalSubrole: null,
        },
        {
          id: 'u-nurse',
          name: 'Enf',
          role: UserRole.NURSE,
          clinicalSubrole: null,
        },
        {
          id: 'u-admin-bare',
          name: 'Admin',
          role: UserRole.ADMIN,
          clinicalSubrole: null,
        },
      ]);

      const out = await service.listConsultationAgendaSchedulableProfessionals(
        TENANT
      );

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: TENANT }),
        })
      );
      expect(out.map((r) => r.id).sort()).toEqual(['u-nurse', 'u-onc'].sort());
    });
  });

  describe('bootstrapProntuarioEvolutionNavigationStep', () => {
    it('não chama assertNoConsultationIntervalOverlap nem assertSlotWithinAgendaRules', async () => {
      const assertOverlap = jest.spyOn(
        consultationAgendaAvailability,
        'assertNoConsultationIntervalOverlap'
      );
      const assertSlot = jest.spyOn(
        consultationAgendaAvailability,
        'assertSlotWithinAgendaRules'
      );

      mockPrisma.patient.findFirst.mockResolvedValueOnce({
        id: PATIENT_ID,
        cancerType: 'bladder',
        currentStage: JourneyStage.TREATMENT,
      });
      mockPrisma.user.findFirst.mockResolvedValueOnce({
        id: PROFESSIONAL_ID,
        role: UserRole.NURSE,
        clinicalSubrole: null,
      });
      mockPrisma.cancerDiagnosis.findFirst.mockResolvedValueOnce({ id: 'dx-1' });
      mockPrisma.patientJourney.findUnique.mockResolvedValueOnce(baseJourney);
      mockPrisma.navigationStep.aggregate.mockResolvedValueOnce({
        _max: { stepOrder: 5 },
      });
      mockPrisma.navigationStep.create.mockResolvedValueOnce({
        id: 'step-new',
        patientId: PATIENT_ID,
        stepKey: 'navigation_consultation',
      });

      const before = Date.now();
      await service.bootstrapProntuarioEvolutionNavigationStep(
        TENANT,
        PATIENT_ID,
        PROFESSIONAL_ID,
        'navigation_consultation'
      );
      const after = Date.now();

      expect(assertOverlap).not.toHaveBeenCalled();
      expect(assertSlot).not.toHaveBeenCalled();
      expect(mockPrisma.navigationStep.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metadata: {
              source: 'prontuario_evolution_bootstrap',
              skipAgendaSlotValidation: true,
            },
            scheduledProfessionalId: PROFESSIONAL_ID,
            journeyStage: JourneyStage.TREATMENT,
            diagnosisId: 'dx-1',
            isRequired: false,
          }),
        })
      );
      const createArg = mockPrisma.navigationStep.create.mock.calls[0][0] as {
        data: { expectedDate: Date };
      };
      expect(createArg.data.expectedDate.getTime()).toBeGreaterThanOrEqual(before);
      expect(createArg.data.expectedDate.getTime()).toBeLessThanOrEqual(after);

      assertOverlap.mockRestore();
      assertSlot.mockRestore();
    });

    it('BadRequest quando profissional não é elegível ao tipo de consulta', async () => {
      mockPrisma.patient.findFirst.mockResolvedValueOnce({
        id: PATIENT_ID,
        cancerType: 'bladder',
        currentStage: JourneyStage.TREATMENT,
      });
      mockPrisma.user.findFirst.mockResolvedValueOnce({
        id: PROFESSIONAL_ID,
        role: UserRole.NURSE,
        clinicalSubrole: null,
      });

      await expect(
        service.bootstrapProntuarioEvolutionNavigationStep(
          TENANT,
          PATIENT_ID,
          PROFESSIONAL_ID,
          'specialist_consultation'
        )
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.navigationStep.create).not.toHaveBeenCalled();
    });

    it('NotFound quando paciente não existe', async () => {
      mockPrisma.patient.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.bootstrapProntuarioEvolutionNavigationStep(
          TENANT,
          PATIENT_ID,
          PROFESSIONAL_ID,
          'navigation_consultation'
        )
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('markConsultationNavigationStepCompletedFromSignedEvolution', () => {
    const stepId = 'aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee';

    it('NotFound quando etapa não existe', async () => {
      mockPrisma.navigationStep.findFirst.mockResolvedValueOnce(null);
      await expect(
        service.markConsultationNavigationStepCompletedFromSignedEvolution(
          stepId,
          TENANT,
          'user-1'
        )
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.navigationStep.update).not.toHaveBeenCalled();
    });

    it('não altera etapa quando stepKey não é consulta clínica', async () => {
      mockPrisma.navigationStep.findFirst.mockResolvedValueOnce({
        id: stepId,
        tenantId: TENANT,
        patientId: PATIENT_ID,
        stepKey: 'colonoscopy',
        isCompleted: false,
        actualDate: null,
      } as any);
      await service.markConsultationNavigationStepCompletedFromSignedEvolution(
        stepId,
        TENANT,
        'user-1'
      );
      expect(mockPrisma.navigationStep.update).not.toHaveBeenCalled();
    });

    it('não altera etapa já concluída (idempotente)', async () => {
      mockPrisma.navigationStep.findFirst.mockResolvedValueOnce({
        id: stepId,
        tenantId: TENANT,
        patientId: PATIENT_ID,
        stepKey: 'specialist_consultation',
        isCompleted: true,
        actualDate: null,
      } as any);
      await service.markConsultationNavigationStepCompletedFromSignedEvolution(
        stepId,
        TENANT,
        'user-1'
      );
      expect(mockPrisma.scheduledAction.updateMany).not.toHaveBeenCalled();
      expect(mockPrisma.navigationStep.update).not.toHaveBeenCalled();
    });

    it('marca consulta como COMPLETED e corre cascata', async () => {
      const existing = {
        id: stepId,
        tenantId: TENANT,
        patientId: PATIENT_ID,
        stepKey: 'specialist_consultation',
        journeyStage: JourneyStage.TREATMENT,
        isCompleted: false,
        actualDate: null,
      };
      mockPrisma.navigationStep.findFirst.mockResolvedValueOnce(existing);
      const updated = {
        ...existing,
        isCompleted: true,
        status: NavigationStepStatus.COMPLETED,
        completedAt: new Date(),
        completedBy: 'user-1',
        actualDate: new Date(),
      };
      mockPrisma.navigationStep.update.mockResolvedValueOnce(updated);
      const cascadeSpy = jest
        .spyOn(service as any, 'runAfterMarkingStepCompleted')
        .mockResolvedValue(undefined);

      await service.markConsultationNavigationStepCompletedFromSignedEvolution(
        stepId,
        TENANT,
        'user-1'
      );

      expect(mockPrisma.scheduledAction.updateMany).toHaveBeenCalled();
      expect(mockPrisma.navigationStep.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: stepId, tenantId: TENANT },
          data: expect.objectContaining({
            isCompleted: true,
            status: NavigationStepStatus.COMPLETED,
            completedBy: 'user-1',
          }),
        })
      );
      expect(cascadeSpy).toHaveBeenCalledWith(updated, TENANT);
      cascadeSpy.mockRestore();
    });
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

    it('should return cancer-type TREATMENT templates when status is PALLIATIVE_CARE (not empty list)', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue({
        cancerType: 'colorectal',
        status: PatientStatus.PALLIATIVE_CARE,
        cancerDiagnoses: [],
      });
      mockPrisma.navigationStep.findMany.mockResolvedValue([]);

      const templates = await service.getAvailableStepTemplates(
        PATIENT_ID,
        TENANT,
        JourneyStage.TREATMENT
      );

      expect(templates.length).toBeGreaterThan(0);
      for (const t of templates) {
        expect(t.journeyStage).toBe(JourneyStage.TREATMENT);
      }
    });
  });

  // ─── createStep ────────────────────────────────────────────────────────────────

  describe('createStep', () => {
    const baseCreateDto = {
      patientId: PATIENT_ID,
      journeyStage: JourneyStage.TREATMENT,
      stepKey: 'lab_work',
      stepName: 'Exame laboratorial',
    };

    it('throws NotFoundException when patient does not exist', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue(null);

      await expect(
        service.createStep({ ...baseCreateDto, cancerType: 'bladder' }, TENANT)
      ).rejects.toThrow(NotFoundException);
    });

    it('persists cancerType "other" when omitted and patient has no type nor diagnosis', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue({
        id: PATIENT_ID,
        cancerType: null,
      });
      mockPrisma.patientJourney.findUnique.mockResolvedValue(baseJourney);
      mockPrisma.cancerDiagnosis.findFirst.mockResolvedValue(null);
      mockPrisma.navigationStep.create.mockResolvedValue({
        id: 'step-new',
        tenantId: TENANT,
        patientId: PATIENT_ID,
        cancerType: 'other',
      });

      await service.createStep({ ...baseCreateDto }, TENANT);

      expect(mockPrisma.cancerDiagnosis.findFirst).toHaveBeenCalled();
      expect(mockPrisma.navigationStep.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ cancerType: 'other' }),
        })
      );
    });

    it('uses patient.cancerType when dto omits cancerType', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue({
        id: PATIENT_ID,
        cancerType: 'bladder',
      });
      mockPrisma.patientJourney.findUnique.mockResolvedValue(baseJourney);
      mockPrisma.navigationStep.create.mockResolvedValue({
        id: 'step-new',
        tenantId: TENANT,
        patientId: PATIENT_ID,
        cancerType: 'bladder',
      });

      await service.createStep({ ...baseCreateDto }, TENANT);

      expect(mockPrisma.navigationStep.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ cancerType: 'bladder' }),
        })
      );
    });

    it('prefers dto cancerType over patient record', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue({
        id: PATIENT_ID,
        cancerType: 'bladder',
      });
      mockPrisma.patientJourney.findUnique.mockResolvedValue(baseJourney);
      mockPrisma.navigationStep.create.mockResolvedValue({
        id: 'step-new',
        tenantId: TENANT,
        patientId: PATIENT_ID,
        cancerType: 'lung',
      });

      await service.createStep({ ...baseCreateDto, cancerType: 'lung' }, TENANT);

      expect(mockPrisma.navigationStep.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ cancerType: 'lung' }),
        })
      );
    });

    it('uses active diagnosis cancerType when patient has no cancerType', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue({
        id: PATIENT_ID,
        cancerType: null,
      });
      mockPrisma.patientJourney.findUnique.mockResolvedValue(baseJourney);
      mockPrisma.cancerDiagnosis.findFirst.mockResolvedValue({
        cancerType: 'colorectal',
      });
      mockPrisma.navigationStep.create.mockResolvedValue({
        id: 'step-new',
        tenantId: TENANT,
        patientId: PATIENT_ID,
        cancerType: 'colorectal',
      });

      await service.createStep({ ...baseCreateDto }, TENANT);

      expect(mockPrisma.navigationStep.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ cancerType: 'colorectal' }),
        })
      );
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
      mockPrisma.patient.findMany
        .mockResolvedValueOnce([
          {
            id: 'patient-legacy',
            cancerType: 'breast',
            currentStage: JourneyStage.DIAGNOSIS,
            cancerDiagnoses: [],
            navigationSteps: [{ id: 'existing-step' }],
          },
        ])
        .mockResolvedValueOnce([]);
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
      mockPrisma.patient.findMany
        .mockResolvedValueOnce([
          {
            id: 'patient-modern',
            cancerType: 'breast',
            currentStage: JourneyStage.DIAGNOSIS,
            cancerDiagnoses: [],
            navigationSteps: [{ id: 'existing-step' }],
          },
        ])
        .mockResolvedValueOnce([]);
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
      mockPrisma.patient.findMany
        .mockResolvedValueOnce([
          {
            id: 'patient-empty',
            cancerType: 'breast',
            currentStage: JourneyStage.SCREENING,
            cancerDiagnoses: [],
            navigationSteps: [],
          },
        ])
        .mockResolvedValueOnce([]);

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

  // ─── updateStep — expectedDate ────────────────────────────────────────────────

  describe('updateStep — expectedDate', () => {
    const stepId = 'step-test-1';
    const tenantScopedExisting = {
      id: stepId,
      tenantId: TENANT,
      patientId: PATIENT_ID,
      isCompleted: false,
      status: NavigationStepStatus.PENDING,
      journeyStage: JourneyStage.TREATMENT,
      expectedDate: null,
      dueDate: null,
      actualDate: null,
      completedAt: null,
    };

    beforeEach(() => {
      mockPrisma.navigationStep.findFirst.mockResolvedValue(tenantScopedExisting as never);
      mockPrisma.navigationStep.update.mockResolvedValue({
        ...tenantScopedExisting,
        expectedDate: new Date('2026-06-15T12:00:00.000Z'),
      } as never);
    });

    it('persiste expectedDate quando enviado no DTO', async () => {
      await service.updateStep(
        stepId,
        { expectedDate: '2026-06-15' },
        TENANT
      );

      expect(mockPrisma.navigationStep.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: stepId, tenantId: TENANT },
          data: expect.objectContaining({
            expectedDate: expect.any(Date),
          }),
        })
      );
    });
  });

  // ─── getConsultationAgenda ───────────────────────────────────────────────────

  describe('getConsultationAgenda', () => {
    const agendaRow = {
      id: 'step-agenda-1',
      patientId: PATIENT_ID,
      stepKey: 'specialist_consultation',
      stepName: 'Consulta especialista',
      journeyStage: JourneyStage.TREATMENT,
      status: NavigationStepStatus.PENDING,
      isCompleted: false,
      expectedDate: new Date('2026-05-10T00:00:00.000Z'),
      dueDate: new Date('2026-05-12T00:00:00.000Z'),
      actualDate: null,
      appointmentConfirmationStatus:
        AppointmentConfirmationStatus.NOT_APPLICABLE,
      consultationCheckedInAt: null,
      consultationCheckedInByUserId: null,
      consultationStartedAt: null,
      consultationStartedByUserId: null,
      consultationWaitingDurationMinutes: null,
      consultationLateDurationMinutes: null,
      consultationAttendance: ConsultationAttendance.EXPECTED,
      consultationNoShowSource: null,
      patient: { id: PATIENT_ID, name: 'Paciente Teste' },
      scheduledProfessional: {
        id: PROFESSIONAL_ID,
        name: 'Dr. Teste',
      },
    };

    it('throws BadRequestException when from is after to', async () => {
      await expect(
        service.getConsultationAgenda(TENANT, {
          from: '2026-05-10',
          to: '2026-05-01',
        })
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when dates are invalid', async () => {
      await expect(
        service.getConsultationAgenda(TENANT, {
          from: 'not-a-date',
          to: '2026-05-01',
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('scopes Prisma where to tenantId and excludes CANCELLED', async () => {
      mockPrisma.$transaction.mockResolvedValue([1, [agendaRow]]);

      await service.getConsultationAgenda(TENANT, {
        from: '2026-05-01',
        to: '2026-05-31',
        scope: 'consultations',
      });

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.navigationStep.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: TENANT,
            status: { not: NavigationStepStatus.CANCELLED },
            stepKey: {
              in: ['specialist_consultation', 'navigation_consultation'],
            },
            AND: expect.arrayContaining([
              { expectedDate: { not: null } },
              {
                expectedDate: expect.objectContaining({
                  gte: expect.any(Date),
                  lte: expect.any(Date),
                }),
              },
            ]),
          }),
        })
      );
    });

    it('filtra agenda somente por expectedDate (não considera dueDate para inclusão)', async () => {
      mockPrisma.$transaction.mockResolvedValue([0, []]);

      await service.getConsultationAgenda(TENANT, {
        from: '2026-05-01',
        to: '2026-05-31',
      });

      const countArg = mockPrisma.navigationStep.count.mock.calls[0][0];
      expect(countArg.where).toEqual(
        expect.objectContaining({
          tenantId: TENANT,
          AND: expect.arrayContaining([
            { expectedDate: { not: null } },
            {
              expectedDate: expect.objectContaining({
                gte: expect.any(Date),
                lte: expect.any(Date),
              }),
            },
          ]),
        })
      );
      expect(JSON.stringify(countArg.where)).not.toContain('dueDate');
    });

    it('omits stepKey filter when scope is all', async () => {
      mockPrisma.$transaction.mockResolvedValue([0, []]);

      await service.getConsultationAgenda(TENANT, {
        from: '2026-05-01',
        to: '2026-05-31',
        scope: 'all',
      });

      const countArg = mockPrisma.navigationStep.count.mock.calls[0][0];
      expect(countArg.where).not.toHaveProperty('stepKey');
      expect(countArg.where.tenantId).toBe(TENANT);
    });

    it('applies pagination (skip/take) for page 2', async () => {
      mockPrisma.$transaction.mockResolvedValue([0, []]);

      await service.getConsultationAgenda(TENANT, {
        from: '2026-05-01',
        to: '2026-05-31',
        page: 2,
        limit: 25,
      });

      expect(mockPrisma.navigationStep.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 25,
          take: 25,
        })
      );
    });

    it('caps limit at 100', async () => {
      mockPrisma.$transaction.mockResolvedValue([0, []]);

      await service.getConsultationAgenda(TENANT, {
        from: '2026-05-01',
        to: '2026-05-31',
        limit: 500,
      });

      expect(mockPrisma.navigationStep.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 })
      );
    });

    it('maps agendaDate from expectedDate when present', async () => {
      mockPrisma.$transaction.mockResolvedValue([1, [agendaRow]]);

      const page = await service.getConsultationAgenda(TENANT, {
        from: '2026-05-01',
        to: '2026-05-31',
      });

      expect(page.items).toHaveLength(1);
      expect(page.items[0].agendaDate).toEqual(agendaRow.expectedDate);
      expect(page.total).toBe(1);
      expect(page.page).toBe(1);
      expect(page.limit).toBe(50);
      expect(page.totalPages).toBe(1);
    });

    it('returns totalPages 0 when total is 0', async () => {
      mockPrisma.$transaction.mockResolvedValue([0, []]);

      const page = await service.getConsultationAgenda(TENANT, {
        from: '2026-05-01',
        to: '2026-05-31',
      });

      expect(page.totalPages).toBe(0);
      expect(page.items).toEqual([]);
    });

    it('inclui queueLabel e campos de fila no item mapeado', async () => {
      const futureRow = {
        ...agendaRow,
        expectedDate: new Date('2099-05-10T12:00:00.000Z'),
      };
      mockPrisma.$transaction.mockResolvedValue([1, [futureRow]]);

      const page = await service.getConsultationAgenda(TENANT, {
        from: '2099-05-01',
        to: '2099-05-31',
      });

      expect(page.items[0]).toMatchObject({
        queueLabel: 'SCHEDULED',
        consultationAttendance: ConsultationAttendance.EXPECTED,
        waitingMinutesLive: null,
      });
    });
  });

  describe('patchConsultationCheckIn', () => {
    it('rejeita quando o papel não é secretaria nem admin', async () => {
      await expect(
        service.patchConsultationCheckIn('s1', TENANT, {
          id: PROFESSIONAL_ID,
          role: UserRole.ONCOLOGIST,
        })
      ).rejects.toThrow(ForbiddenException);
    });

    it('grava check-in e atraso quando após expectedDate', async () => {
      const step = {
        id: 's1',
        tenantId: TENANT,
        patientId: PATIENT_ID,
        stepKey: 'specialist_consultation',
        status: NavigationStepStatus.PENDING,
        isCompleted: false,
        consultationAttendance: ConsultationAttendance.EXPECTED,
        consultationCheckedInAt: null,
        expectedDate: new Date('2020-01-01T10:00:00.000Z'),
        scheduledProfessionalId: PROFESSIONAL_ID,
      };
      mockPrisma.navigationStep.findFirst.mockResolvedValue(step);
      mockPrisma.navigationStep.update.mockResolvedValue({
        ...step,
        consultationCheckedInAt: new Date(),
        consultationCheckedInByUserId: 'sec-1',
        consultationLateDurationMinutes: 1,
      });

      await service.patchConsultationCheckIn('s1', TENANT, {
        id: 'sec-1',
        role: UserRole.SECRETARY,
      });

      expect(mockPrisma.navigationStep.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 's1', tenantId: TENANT },
          data: expect.objectContaining({
            consultationCheckedInByUserId: 'sec-1',
            consultationCheckedInAt: expect.any(Date),
          }),
        })
      );
    });
  });

  describe('patchConsultationStart', () => {
    it('rejeita quando o utilizador não é o profissional agendado', async () => {
      const step = {
        id: 's1',
        tenantId: TENANT,
        patientId: PATIENT_ID,
        stepKey: 'specialist_consultation',
        status: NavigationStepStatus.PENDING,
        isCompleted: false,
        consultationAttendance: ConsultationAttendance.EXPECTED,
        consultationCheckedInAt: new Date(),
        consultationStartedAt: null,
        scheduledProfessionalId: PROFESSIONAL_ID,
      };
      mockPrisma.navigationStep.findFirst.mockResolvedValue(step);

      await expect(
        service.patchConsultationStart('s1', TENANT, {
          id: OTHER_ONCOLOGIST_ID,
          role: UserRole.ONCOLOGIST,
        })
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getConsultationAgendaMetrics', () => {
    it('agrega contagens com tenantId no where', async () => {
      mockPrisma.navigationStep.count.mockResolvedValue(0);
      mockPrisma.navigationStep.findMany.mockResolvedValue([]);

      await service.getConsultationAgendaMetrics(TENANT, {
        from: '2026-05-01',
        to: '2026-05-31',
      });

      expect(mockPrisma.navigationStep.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: TENANT }),
        })
      );
      expect(mockPrisma.navigationStep.count).toHaveBeenCalledTimes(2);
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

    it('permite a oncologist mover consulta agendada entre fases mesmo não sendo o profissional do slot', async () => {
      const existing = {
        id: 'step-move-consult',
        tenantId: TENANT,
        patientId: PATIENT_ID,
        cancerType: 'bladder',
        stepKey: 'specialist_consultation',
        journeyStage: JourneyStage.TREATMENT,
        scheduledProfessionalId: OTHER_ONCOLOGIST_ID,
        isCompleted: false,
        dependsOnStepKey: null as string | null,
        relativeDaysMin: null as number | null,
        relativeDaysMax: null as number | null,
        expectedDate: new Date('2026-06-20T12:00:00.000Z'),
        dueDate: null,
        status: NavigationStepStatus.PENDING,
        actualDate: null,
        completedAt: null,
        appointmentConfirmationStatus: AppointmentConfirmationStatus.NOT_APPLICABLE,
      };
      mockPrisma.navigationStep.findFirst.mockResolvedValue(existing);
      mockPrisma.navigationStep.aggregate.mockResolvedValue({
        _max: { stepOrder: 2 },
      });
      mockPrisma.navigationStep.update.mockResolvedValue({
        ...existing,
        journeyStage: JourneyStage.DIAGNOSIS,
        stepOrder: 3,
        expectedDate: null,
        dueDate: null,
      });

      await service.updateStep(
        'step-move-consult',
        { journeyStage: JourneyStage.DIAGNOSIS },
        TENANT,
        { id: ACTING_ONCOLOGIST_ID, role: UserRole.ONCOLOGIST }
      );

      expect(mockPrisma.navigationStep.update).toHaveBeenCalled();
    });

    it('nega alteração de data/horário da consulta de outro profissional (sem bypass)', async () => {
      const existing = {
        id: 'step-slot',
        tenantId: TENANT,
        patientId: PATIENT_ID,
        cancerType: 'bladder',
        stepKey: 'specialist_consultation',
        journeyStage: JourneyStage.TREATMENT,
        scheduledProfessionalId: OTHER_ONCOLOGIST_ID,
        isCompleted: false,
        dependsOnStepKey: null as string | null,
        relativeDaysMin: null as number | null,
        relativeDaysMax: null as number | null,
        expectedDate: new Date('2026-06-20T12:00:00.000Z'),
        dueDate: null,
        status: NavigationStepStatus.PENDING,
        actualDate: null,
        completedAt: null,
        appointmentConfirmationStatus: AppointmentConfirmationStatus.NOT_APPLICABLE,
      };
      mockPrisma.navigationStep.findFirst.mockResolvedValue(existing);

      await expect(
        service.updateStep(
          'step-slot',
          {
            journeyStage: JourneyStage.DIAGNOSIS,
            expectedDate: '2026-07-01T10:00:00.000Z',
          },
          TENANT,
          { id: ACTING_ONCOLOGIST_ID, role: UserRole.ONCOLOGIST }
        )
      ).rejects.toThrow(ForbiddenException);
    });

    it('permite enfermeiro mover consulta agendada entre fases sem ser o profissional do slot', async () => {
      const existing = {
        id: 'step-nurse',
        tenantId: TENANT,
        patientId: PATIENT_ID,
        cancerType: 'bladder',
        stepKey: 'specialist_consultation',
        journeyStage: JourneyStage.TREATMENT,
        scheduledProfessionalId: OTHER_ONCOLOGIST_ID,
        isCompleted: false,
        dependsOnStepKey: null as string | null,
        relativeDaysMin: null as number | null,
        relativeDaysMax: null as number | null,
        expectedDate: null,
        dueDate: null,
        status: NavigationStepStatus.PENDING,
        actualDate: null,
        completedAt: null,
        appointmentConfirmationStatus: AppointmentConfirmationStatus.NOT_APPLICABLE,
      };
      mockPrisma.navigationStep.findFirst.mockResolvedValue(existing);
      mockPrisma.navigationStep.aggregate.mockResolvedValue({
        _max: { stepOrder: 1 },
      });
      mockPrisma.navigationStep.update.mockResolvedValue({
        ...existing,
        journeyStage: JourneyStage.DIAGNOSIS,
        stepOrder: 2,
      });

      await service.updateStep(
        'step-nurse',
        { journeyStage: JourneyStage.DIAGNOSIS },
        TENANT,
        { id: 'nurse-1', role: UserRole.NURSE }
      );

      expect(mockPrisma.navigationStep.update).toHaveBeenCalled();
    });

    it('nega enfermeiro a alterar data da consulta agendada de outro profissional', async () => {
      const existing = {
        id: 'step-nurse-slot',
        tenantId: TENANT,
        patientId: PATIENT_ID,
        cancerType: 'bladder',
        stepKey: 'specialist_consultation',
        journeyStage: JourneyStage.TREATMENT,
        scheduledProfessionalId: OTHER_ONCOLOGIST_ID,
        isCompleted: false,
        dependsOnStepKey: null as string | null,
        relativeDaysMin: null as number | null,
        relativeDaysMax: null as number | null,
        expectedDate: new Date('2026-06-20T12:00:00.000Z'),
        dueDate: null,
        status: NavigationStepStatus.PENDING,
        actualDate: null,
        completedAt: null,
        appointmentConfirmationStatus: AppointmentConfirmationStatus.NOT_APPLICABLE,
      };
      mockPrisma.navigationStep.findFirst.mockResolvedValue(existing);

      await expect(
        service.updateStep(
          'step-nurse-slot',
          { expectedDate: '2026-07-01T10:00:00.000Z' },
          TENANT,
          { id: 'nurse-1', role: UserRole.NURSE }
        )
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('createConsultationAppointment', () => {
    const baseDto = {
      patientId: PATIENT_ID,
      cancerType: 'bladder',
      journeyStage: JourneyStage.TREATMENT,
      stepKey: 'specialist_consultation',
      stepName: 'Consulta especializada',
      expectedDate: '2026-06-20T12:00:00.000Z',
      scheduledProfessionalId: PROFESSIONAL_ID,
    };

    it('throws BadRequestException when stepKey is not a clinical consultation', async () => {
      await expect(
        service.createConsultationAppointment(
          { ...baseDto, stepKey: 'chemotherapy' },
          TENANT
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when expectedDate is missing', async () => {
      await expect(
        service.createConsultationAppointment(
          { ...baseDto, expectedDate: undefined as unknown as string },
          TENANT
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('throws when admin has no clinical subrole for specialist consultation', async () => {
      mockPrisma.user.findFirst.mockResolvedValueOnce({
        id: PROFESSIONAL_ID,
        role: UserRole.ADMIN,
        clinicalSubrole: null,
      });
      mockPrisma.patient.findFirst.mockResolvedValue({ id: PATIENT_ID } as never);

      await expect(
        service.createConsultationAppointment({ ...baseDto }, TENANT)
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.navigationStep.create).not.toHaveBeenCalled();
    });

    it('creates specialist consultation when professional is admin with MEDICAL subrole', async () => {
      mockPrisma.user.findFirst.mockResolvedValueOnce({
        id: PROFESSIONAL_ID,
        role: UserRole.ADMIN,
        clinicalSubrole: ClinicalSubrole.MEDICAL,
      });
      mockPrisma.patient.findFirst.mockResolvedValue({ id: PATIENT_ID } as never);
      mockPrisma.patientJourney.findUnique.mockResolvedValue(baseJourney as never);
      mockPrisma.navigationStep.findMany.mockResolvedValue([]);
      const created = {
        id: 'spec-admin-step',
        tenantId: TENANT,
        patientId: PATIENT_ID,
        stepKey: 'specialist_consultation',
        dueDate: null,
        isCompleted: false,
      };
      mockPrisma.navigationStep.create.mockResolvedValue(created as never);

      const result = await service.createConsultationAppointment(
        { ...baseDto },
        TENANT
      );

      expect(result).toEqual(created);
      expect(mockPrisma.navigationStep.create).toHaveBeenCalled();
    });

    it('throws when professional is not a doctor for specialist consultation', async () => {
      mockPrisma.user.findFirst.mockResolvedValueOnce({
        id: PROFESSIONAL_ID,
        role: UserRole.NURSE,
        clinicalSubrole: null,
      });
      mockPrisma.patient.findFirst.mockResolvedValue({ id: PATIENT_ID } as never);

      await expect(
        service.createConsultationAppointment({ ...baseDto }, TENANT)
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.navigationStep.create).not.toHaveBeenCalled();
    });

    it('throws when professional is not nursing for navigation consultation', async () => {
      mockPrisma.user.findFirst.mockResolvedValueOnce({
        id: PROFESSIONAL_ID,
        role: UserRole.ONCOLOGIST,
        clinicalSubrole: null,
      });
      mockPrisma.patient.findFirst.mockResolvedValue({ id: PATIENT_ID } as never);

      await expect(
        service.createConsultationAppointment(
          {
            ...baseDto,
            stepKey: 'navigation_consultation',
            stepName: 'Consulta de navegação oncológica',
          },
          TENANT
        )
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.navigationStep.create).not.toHaveBeenCalled();
    });

    it('creates navigation consultation when professional is nurse', async () => {
      mockPrisma.user.findFirst.mockResolvedValueOnce({
        id: PROFESSIONAL_ID,
        role: UserRole.NURSE,
        clinicalSubrole: null,
      });
      mockPrisma.patient.findFirst.mockResolvedValue({ id: PATIENT_ID } as never);
      mockPrisma.patientJourney.findUnique.mockResolvedValue(baseJourney as never);
      mockPrisma.navigationStep.findMany.mockResolvedValue([]);
      const created = {
        id: 'nav-step',
        tenantId: TENANT,
        patientId: PATIENT_ID,
        stepKey: 'navigation_consultation',
        dueDate: null,
        isCompleted: false,
      };
      mockPrisma.navigationStep.create.mockResolvedValue(created as never);

      const result = await service.createConsultationAppointment(
        {
          ...baseDto,
          stepKey: 'navigation_consultation',
          stepName: 'Consulta de navegação oncológica',
        },
        TENANT
      );

      expect(result).toEqual(created);
      expect(mockPrisma.navigationStep.create).toHaveBeenCalled();
    });

    it('throws when patient already has consultation in same minute', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue({ id: PATIENT_ID } as never);
      mockPrisma.patientJourney.findUnique.mockResolvedValue(baseJourney as never);
      mockPrisma.navigationStep.findMany
        .mockResolvedValueOnce([
          {
            id: 'other-step',
            expectedDate: new Date(baseDto.expectedDate),
            scheduledProfessionalId: PROFESSIONAL_ID,
          },
        ])
        .mockResolvedValueOnce([]);

      await expect(
        service.createConsultationAppointment({ ...baseDto }, TENANT)
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.navigationStep.create).not.toHaveBeenCalled();
    });

    it('throws when professional already has consultation in same minute', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue({ id: PATIENT_ID } as never);
      mockPrisma.patientJourney.findUnique.mockResolvedValue(baseJourney as never);
      mockPrisma.navigationStep.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: 'other-step',
            expectedDate: new Date(baseDto.expectedDate),
            scheduledProfessionalId: PROFESSIONAL_ID,
          },
        ]);

      await expect(
        service.createConsultationAppointment({ ...baseDto }, TENANT)
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.navigationStep.create).not.toHaveBeenCalled();
    });

    it('schedules CONSULTATION_CONFIRMATION when lead hours > 0 and send time is in the future', async () => {
      const assertSpy = jest
        .spyOn(consultationAgendaAvailability, 'assertSlotWithinAgendaRules')
        .mockResolvedValue(undefined as never);
      mockPrisma.patient.findFirst.mockResolvedValue({ id: PATIENT_ID } as never);
      mockPrisma.patientJourney.findUnique.mockResolvedValue(baseJourney as never);
      mockPrisma.navigationStep.findMany.mockResolvedValue([]);
      const expected = new Date('2026-06-22T15:00:00.000Z');
      const created = {
        id: 'new-step',
        tenantId: TENANT,
        patientId: PATIENT_ID,
        stepKey: 'specialist_consultation',
        stepName: 'Consulta especializada',
        expectedDate: expected,
        appointmentConfirmationStatus:
          AppointmentConfirmationStatus.NOT_APPLICABLE,
        status: NavigationStepStatus.PENDING,
        dueDate: null,
        isCompleted: false,
      };
      mockPrisma.navigationStep.create.mockResolvedValue(created as never);
      mockPrisma.consultationAgendaConfig.findFirst.mockResolvedValue(
        mockAgendaConfigRow(24) as never
      );

      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-01-01T12:00:00.000Z'));

      const result = await service.createConsultationAppointment(
        { ...baseDto, expectedDate: '2026-06-22T15:00:00.000Z' },
        TENANT
      );

      jest.useRealTimers();

      expect(result).toEqual(created);
      expect(mockPrisma.navigationStep.create).toHaveBeenCalled();
      expect(mockChannelGateway.sendMessage).not.toHaveBeenCalled();
      expect(mockPrisma.scheduledAction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actionType: 'CONSULTATION_CONFIRMATION',
          patientId: PATIENT_ID,
          tenantId: TENANT,
          status: 'PENDING',
        }),
      });
      assertSpy.mockRestore();
    });

    it('sends confirmation immediately when whatsappConfirmationLeadHours is 0', async () => {
      const assertSpy = jest
        .spyOn(consultationAgendaAvailability, 'assertSlotWithinAgendaRules')
        .mockResolvedValue(undefined as never);
      mockPrisma.patient.findFirst.mockResolvedValue({ id: PATIENT_ID } as never);
      mockPrisma.patientJourney.findUnique.mockResolvedValue(baseJourney as never);
      const expected = new Date('2026-06-22T15:00:00.000Z');
      const created = {
        id: 'new-step',
        tenantId: TENANT,
        patientId: PATIENT_ID,
        stepKey: 'specialist_consultation',
        stepName: 'Consulta especializada',
        expectedDate: expected,
        appointmentConfirmationStatus:
          AppointmentConfirmationStatus.NOT_APPLICABLE,
        status: NavigationStepStatus.PENDING,
        dueDate: null,
        isCompleted: false,
      };
      mockPrisma.navigationStep.create.mockResolvedValue(created as never);
      mockPrisma.navigationStep.findMany.mockResolvedValue([]);
      mockPrisma.navigationStep.findFirst.mockResolvedValue(created as never);
      mockPrisma.conversation.findFirst.mockResolvedValue(null);
      mockPrisma.consultationAgendaConfig.findFirst.mockResolvedValue(
        mockAgendaConfigRow(0) as never
      );
      const updated = {
        ...created,
        appointmentConfirmationStatus:
          AppointmentConfirmationStatus.AWAITING_RESPONSE,
      };
      mockPrisma.navigationStep.update.mockResolvedValue(updated as never);

      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-01-01T12:00:00.000Z'));

      const result = await service.createConsultationAppointment(
        { ...baseDto, expectedDate: '2026-06-22T15:00:00.000Z' },
        TENANT
      );

      jest.useRealTimers();

      expect(mockChannelGateway.sendMessage).toHaveBeenCalled();
      expect(mockPrisma.scheduledAction.create).toHaveBeenCalled();
      expect(result).toEqual(updated);
      assertSpy.mockRestore();
    });
  });
});
