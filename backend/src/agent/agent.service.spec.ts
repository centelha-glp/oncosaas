import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  AppointmentConfirmationStatus,
  NavigationStepStatus,
} from '@generated/prisma/client';
import { AgentService } from './agent.service';
import { PrismaService } from '../prisma/prisma.service';
import { ChannelGatewayService } from '../channel-gateway/channel-gateway.service';
import { ConversationService } from './conversation.service';
import { DecisionGateService } from './decision-gate.service';
import { AlertsGateway } from '../gateways/alerts.gateway';
import { PriorityRecalculationService } from '../oncology-navigation/priority-recalculation.service';
import { OncologyNavigationService } from '../oncology-navigation/oncology-navigation.service';
import { PatientsService } from '../patients/patients.service';
import {
  CANCEL_CONSULTATION_APPOINTMENT,
  CONFIRM_CONSULTATION_APPOINTMENT,
  CREATE_CONSULTATION_APPOINTMENT,
  RESCHEDULE_CONSULTATION_APPOINTMENT,
} from './scheduling-secretary.constants';
import { hashPhoneNumber } from '../common/utils/phone.util';

const TENANT = 'tenant-uuid-abc';
const OTHER_TENANT = 'tenant-uuid-xyz';
const PATIENT_CTX = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
const PRO_ID = '550e8400-e29b-41d4-a716-446655440000';
const STEP_ID = '7ba7b810-9dad-11d1-80b4-00c04fd430c8';
const PHONE_RAW = '+5511988887777';

const mockPrisma = {
  patient: {
    findFirst: jest.fn(),
  },
  navigationStep: {
    findFirst: jest.fn(),
  },
};

const mockPatientsService = {
  create: jest.fn(),
  update: jest.fn(),
  findByPhone: jest.fn(),
};

const mockOncologyNavigationService = {
  createConsultationAppointment: jest.fn(),
  updateStep: jest.fn(),
};

describe('AgentService — intake WhatsApp e secretária', () => {
  let service: AgentService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentService,
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(undefined) },
        },
        { provide: ChannelGatewayService, useValue: { sendMessage: jest.fn() } },
        {
          provide: ConversationService,
          useValue: { findOne: jest.fn(), getRecentHistory: jest.fn() },
        },
        {
          provide: DecisionGateService,
          useValue: { evaluate: jest.fn(), logDecision: jest.fn() },
        },
        { provide: AlertsGateway, useValue: {} },
        {
          provide: PriorityRecalculationService,
          useValue: { recalculate: jest.fn() },
        },
        { provide: OncologyNavigationService, useValue: mockOncologyNavigationService },
        { provide: PatientsService, useValue: mockPatientsService },
      ],
    }).compile();

    service = module.get(AgentService);
  });

  describe('ensureWhatsAppIntakePatient', () => {
    it('retorna paciente existente e filtra por tenantId + phoneHash', async () => {
      const phoneHash = hashPhoneNumber(PHONE_RAW);
      const existing = { id: 'p-existing', tenantId: TENANT, phoneHash };
      mockPrisma.patient.findFirst.mockResolvedValue(existing);

      const result = await service.ensureWhatsAppIntakePatient(TENANT, PHONE_RAW);

      expect(result).toBe(existing);
      expect(mockPrisma.patient.findFirst).toHaveBeenCalledWith({
        where: { tenantId: TENANT, phoneHash },
      });
      expect(mockPatientsService.create).not.toHaveBeenCalled();
    });

    it('cria stub via PatientsService quando não existe registro', async () => {
      const created = { id: 'p-new', tenantId: TENANT };
      mockPrisma.patient.findFirst.mockResolvedValueOnce(null);
      mockPatientsService.create.mockResolvedValue(created);

      const result = await service.ensureWhatsAppIntakePatient(TENANT, PHONE_RAW);

      expect(result).toEqual(created);
      expect(mockPatientsService.create).toHaveBeenCalled();
      const [dto, tid] = mockPatientsService.create.mock.calls[0];
      expect(tid).toBe(TENANT);
      expect(dto.name).toBe('Cadastro WhatsApp (incompleto)');
    });

    it('após falha na criação, reconsulta por hash no mesmo tenant (corrida)', async () => {
      const phoneHash = hashPhoneNumber(PHONE_RAW);
      const concurrent = { id: 'p-race', tenantId: TENANT };
      mockPrisma.patient.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(concurrent);
      mockPatientsService.create.mockRejectedValue(new Error('unique'));

      const result = await service.ensureWhatsAppIntakePatient(TENANT, PHONE_RAW);

      expect(result).toEqual(concurrent);
      expect(mockPrisma.patient.findFirst).toHaveBeenLastCalledWith({
        where: { tenantId: TENANT, phoneHash },
      });
    });
  });

  describe('executeApprovedDecision — CREATE_CONSULTATION_APPOINTMENT', () => {
    const convId = 'conv-uuid-1';

    const validCreatePayload = {
      scheduledProfessionalId: PRO_ID,
      expectedDate: '2026-06-15T14:00:00.000Z',
      stepKey: 'navigation_consultation',
      stepName: 'Consulta de navegação',
      journeyStage: 'TREATMENT',
    };

    it('sem newPatient: valida paciente no tenant e chama OncologyNavigationService', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue({ id: PATIENT_CTX });
      mockOncologyNavigationService.createConsultationAppointment.mockResolvedValue(
        undefined
      );

      await service.executeApprovedDecision({
        tenantId: TENANT,
        patientId: PATIENT_CTX,
        conversationId: convId,
        outputAction: {
          type: CREATE_CONSULTATION_APPOINTMENT,
          payload: validCreatePayload,
        },
        inputData: {},
      });

      expect(mockPrisma.patient.findFirst).toHaveBeenCalledWith({
        where: { id: PATIENT_CTX, tenantId: TENANT },
        select: { id: true },
      });
      expect(mockOncologyNavigationService.createConsultationAppointment).toHaveBeenCalledWith(
        expect.objectContaining({
          patientId: PATIENT_CTX,
          stepKey: 'navigation_consultation',
          scheduledProfessionalId: PRO_ID,
        }),
        TENANT,
        undefined
      );
    });

    it('sem newPatient: paciente inexistente no tenant não chama createConsultationAppointment', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue(null);

      await service.executeApprovedDecision({
        tenantId: OTHER_TENANT,
        patientId: PATIENT_CTX,
        conversationId: convId,
        outputAction: {
          type: CREATE_CONSULTATION_APPOINTMENT,
          payload: validCreatePayload,
        },
        inputData: {},
      });

      expect(mockOncologyNavigationService.createConsultationAppointment).not.toHaveBeenCalled();
    });

    it('com newPatient: conflito de telefone com outro cadastro no tenant aborta criação', async () => {
      mockPatientsService.findByPhone.mockResolvedValue({
        id: 'outro-paciente',
        tenantId: TENANT,
      });

      await service.executeApprovedDecision({
        tenantId: TENANT,
        patientId: PATIENT_CTX,
        conversationId: convId,
        outputAction: {
          type: CREATE_CONSULTATION_APPOINTMENT,
          payload: {
            ...validCreatePayload,
            newPatient: {
              name: 'Maria',
              birthDate: '1985-03-10',
              phone: '+5511999000111',
            },
          },
        },
        inputData: {},
      });

      expect(mockPatientsService.findByPhone).toHaveBeenCalled();
      expect(mockOncologyNavigationService.createConsultationAppointment).not.toHaveBeenCalled();
      expect(mockPatientsService.create).not.toHaveBeenCalled();
    });

    it('com newPatient no stub WhatsApp: atualiza cadastro e agenda para o mesmo patientId', async () => {
      mockPatientsService.findByPhone.mockResolvedValue({
        id: PATIENT_CTX,
        tenantId: TENANT,
      });
      mockPrisma.patient.findFirst.mockResolvedValue({
        name: 'Cadastro WhatsApp (incompleto)',
      });
      mockPatientsService.update.mockResolvedValue(undefined);
      mockOncologyNavigationService.createConsultationAppointment.mockResolvedValue(undefined);

      await service.executeApprovedDecision({
        tenantId: TENANT,
        patientId: PATIENT_CTX,
        conversationId: convId,
        outputAction: {
          type: CREATE_CONSULTATION_APPOINTMENT,
          payload: {
            ...validCreatePayload,
            newPatient: {
              name: 'Maria Souza',
              birthDate: '1985-03-10',
              phone: '+5511999000111',
            },
          },
        },
        inputData: {},
      });

      expect(mockPatientsService.update).toHaveBeenCalledWith(
        PATIENT_CTX,
        expect.objectContaining({
          name: 'Maria Souza',
          birthDate: '1985-03-10',
        }),
        TENANT
      );
      expect(mockOncologyNavigationService.createConsultationAppointment).toHaveBeenCalledWith(
        expect.objectContaining({ patientId: PATIENT_CTX }),
        TENANT,
        undefined
      );
    });

    it('com patientIntake (alias ai-service) no stub WhatsApp: mesmos efeitos que newPatient', async () => {
      mockPatientsService.findByPhone.mockResolvedValue({
        id: PATIENT_CTX,
        tenantId: TENANT,
      });
      mockPrisma.patient.findFirst.mockResolvedValue({
        name: 'Cadastro WhatsApp (incompleto)',
      });
      mockPatientsService.update.mockResolvedValue(undefined);
      mockOncologyNavigationService.createConsultationAppointment.mockResolvedValue(undefined);

      await service.executeApprovedDecision({
        tenantId: TENANT,
        patientId: PATIENT_CTX,
        conversationId: convId,
        outputAction: {
          type: CREATE_CONSULTATION_APPOINTMENT,
          payload: {
            ...validCreatePayload,
            patientIntake: {
              name: 'Maria Souza',
              birthDate: '1985-03-10',
              phone: '+5511999000111',
            },
          },
        },
        inputData: {},
      });

      expect(mockPatientsService.update).toHaveBeenCalledWith(
        PATIENT_CTX,
        expect.objectContaining({
          name: 'Maria Souza',
          birthDate: '1985-03-10',
        }),
        TENANT
      );
      expect(mockOncologyNavigationService.createConsultationAppointment).toHaveBeenCalledWith(
        expect.objectContaining({ patientId: PATIENT_CTX }),
        TENANT,
        undefined
      );
    });
  });

  describe('executeApprovedDecision — reschedule / cancel / confirm', () => {
    const convId = 'conv-uuid-2';

    it('RESCHEDULE: etapa inexistente para o par tenant+paciente não chama updateStep', async () => {
      mockPrisma.navigationStep.findFirst.mockResolvedValue(null);

      await service.executeApprovedDecision({
        tenantId: TENANT,
        patientId: PATIENT_CTX,
        conversationId: convId,
        outputAction: {
          type: RESCHEDULE_CONSULTATION_APPOINTMENT,
          payload: {
            navigationStepId: STEP_ID,
            newExpectedDate: '2026-08-01T09:00:00.000Z',
          },
        },
        inputData: {},
      });

      expect(mockPrisma.navigationStep.findFirst).toHaveBeenCalledWith({
        where: { id: STEP_ID, tenantId: TENANT, patientId: PATIENT_CTX },
      });
      expect(mockOncologyNavigationService.updateStep).not.toHaveBeenCalled();
    });

    it('RESCHEDULE: sucesso chama updateStep com tenant', async () => {
      mockPrisma.navigationStep.findFirst.mockResolvedValue({
        id: STEP_ID,
        stepKey: 'navigation_consultation',
        status: NavigationStepStatus.PENDING,
      });
      mockOncologyNavigationService.updateStep.mockResolvedValue(undefined);

      await service.executeApprovedDecision({
        tenantId: TENANT,
        patientId: PATIENT_CTX,
        conversationId: convId,
        outputAction: {
          type: RESCHEDULE_CONSULTATION_APPOINTMENT,
          payload: {
            navigationStepId: STEP_ID,
            newExpectedDate: '2026-08-01T09:00:00.000Z',
          },
        },
        inputData: {},
      });

      expect(mockOncologyNavigationService.updateStep).toHaveBeenCalledWith(
        STEP_ID,
        expect.objectContaining({ expectedDate: '2026-08-01T09:00:00.000Z' }),
        TENANT,
        undefined
      );
    });

    it('CANCEL: etapa cancelada não chama updateStep', async () => {
      mockPrisma.navigationStep.findFirst.mockResolvedValue({
        id: STEP_ID,
        stepKey: 'navigation_consultation',
        status: NavigationStepStatus.CANCELLED,
      });

      await service.executeApprovedDecision({
        tenantId: TENANT,
        patientId: PATIENT_CTX,
        conversationId: convId,
        outputAction: {
          type: CANCEL_CONSULTATION_APPOINTMENT,
          payload: { navigationStepId: STEP_ID },
        },
        inputData: {},
      });

      expect(mockOncologyNavigationService.updateStep).not.toHaveBeenCalled();
    });

    it('CONFIRM: confirma agendamento quando etapa válida', async () => {
      mockPrisma.navigationStep.findFirst.mockResolvedValue({
        id: STEP_ID,
        stepKey: 'specialist_consultation',
        status: NavigationStepStatus.PENDING,
      });
      mockOncologyNavigationService.updateStep.mockResolvedValue(undefined);

      await service.executeApprovedDecision({
        tenantId: TENANT,
        patientId: PATIENT_CTX,
        conversationId: convId,
        outputAction: {
          type: CONFIRM_CONSULTATION_APPOINTMENT,
          payload: { navigationStepId: STEP_ID },
        },
        inputData: {},
      });

      expect(mockOncologyNavigationService.updateStep).toHaveBeenCalledWith(
        STEP_ID,
        expect.objectContaining({
          appointmentConfirmationStatus: AppointmentConfirmationStatus.CONFIRMED,
        }),
        TENANT,
        undefined
      );
    });
  });
});
