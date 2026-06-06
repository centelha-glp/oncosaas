import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AppointmentConfirmationStatus,
  ClinicalSubrole,
  NavigationStepStatus,
  UserRole,
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
  CHECK_CONSULTATION_AVAILABILITY,
  CONFIRM_CONSULTATION_APPOINTMENT,
  CREATE_CONSULTATION_APPOINTMENT,
  RESCHEDULE_CONSULTATION_APPOINTMENT,
  SCHEDULING_SECRETARY_AVAILABILITY_OFFERED_SLOTS_MAX,
  SCHEDULING_SECRETARY_AVAILABILITY_STATE_TTL_MS,
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
  conversation: {
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
  getConsultationAvailableSlots: jest.fn(),
  listConsultationAgendaSchedulableProfessionals: jest.fn(),
};

describe('AgentService — intake WhatsApp e secretária', () => {
  let service: AgentService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.conversation.findFirst.mockResolvedValue({ agentState: null });
    mockOncologyNavigationService.getConsultationAvailableSlots.mockResolvedValue({
      slots: [],
    });
    mockOncologyNavigationService.listConsultationAgendaSchedulableProfessionals.mockResolvedValue([]);

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
      expect(mockPrisma.conversation.findFirst).toHaveBeenCalledWith({
        where: { id: convId, tenantId: TENANT },
        select: { agentState: true },
      });
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

  describe('executeApprovedDecision — CHECK_CONSULTATION_AVAILABILITY', () => {
    const convId = 'conv-uuid-check';

    it('getInternalConsultationProfessionals filtra por tenant e stepKey sem expor email', async () => {
      mockOncologyNavigationService.listConsultationAgendaSchedulableProfessionals.mockResolvedValue([
        {
          id: 'u-onc',
          name: 'Dra Onco',
          role: UserRole.ONCOLOGIST,
          clinicalSubrole: null,
        },
        {
          id: 'u-enf',
          name: 'Enf Navegação',
          role: UserRole.NURSE,
          clinicalSubrole: null,
        },
        {
          id: 'u-admin-med',
          name: 'Coord Médico',
          role: UserRole.COORDINATOR,
          clinicalSubrole: ClinicalSubrole.MEDICAL,
        },
      ]);

      const result = await service.getInternalConsultationProfessionals(TENANT, {
        stepKey: 'specialist_consultation',
      });

      expect(
        mockOncologyNavigationService.listConsultationAgendaSchedulableProfessionals
      ).toHaveBeenCalledWith(TENANT);
      expect(result.professionals).toEqual([
        {
          id: 'u-onc',
          name: 'Dra Onco',
          role: UserRole.ONCOLOGIST,
          clinicalSubrole: null,
          consultationStepKeys: ['specialist_consultation'],
        },
        {
          id: 'u-admin-med',
          name: 'Coord Médico',
          role: UserRole.COORDINATOR,
          clinicalSubrole: ClinicalSubrole.MEDICAL,
          consultationStepKeys: ['specialist_consultation'],
        },
      ]);
    });

    it('getInternalConsultationAvailability usa tenant interno e retorna slots ordenados/capados', async () => {
      const many = [
        '2026-06-12T12:00:00.000Z',
        '2026-06-10T08:00:00.000Z',
        '2026-06-11T10:00:00.000Z',
        '2026-06-13T14:00:00.000Z',
        '2026-06-14T16:00:00.000Z',
        '2026-06-15T18:00:00.000Z',
      ];
      mockOncologyNavigationService.getConsultationAvailableSlots.mockResolvedValue({
        slots: many,
      });

      const result = await service.getInternalConsultationAvailability(TENANT, {
        scheduledProfessionalId: PRO_ID,
        stepKey: 'navigation_consultation',
        from: '2026-06-01T00:00:00.000Z',
        to: '2026-06-05T23:59:59.000Z',
        tenantId: OTHER_TENANT,
      });

      expect(mockOncologyNavigationService.getConsultationAvailableSlots).toHaveBeenCalledWith(
        TENANT,
        expect.objectContaining({
          professionalId: PRO_ID,
          stepKey: 'navigation_consultation',
          from: '2026-06-01T00:00:00.000Z',
          to: '2026-06-05T23:59:59.000Z',
        })
      );
      expect(result.slots).toEqual([
        '2026-06-10T08:00:00.000Z',
        '2026-06-11T10:00:00.000Z',
        '2026-06-12T12:00:00.000Z',
        '2026-06-13T14:00:00.000Z',
        '2026-06-14T16:00:00.000Z',
      ]);
      expect(result.slots).toHaveLength(
        SCHEDULING_SECRETARY_AVAILABILITY_OFFERED_SLOTS_MAX
      );
    });

    it('getInternalConsultationAvailability descarta slots passados antes de oferecer', async () => {
      const futureSlot = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      mockOncologyNavigationService.getConsultationAvailableSlots.mockResolvedValue({
        slots: [
          '2000-01-01T12:00:00.000Z',
          futureSlot,
        ],
      });

      const result = await service.getInternalConsultationAvailability(TENANT, {
        scheduledProfessionalId: PRO_ID,
        stepKey: 'navigation_consultation',
        from: '2000-01-01T00:00:00.000Z',
        to: '2026-06-10T23:59:59.000Z',
      });

      expect(result.slots).toEqual([futureSlot]);
    });

    it('getInternalConsultationAvailability lança BadRequest quando payload não normaliza (sem profissional)', async () => {
      await expect(
        service.getInternalConsultationAvailability(TENANT, {
          stepKey: 'navigation_consultation',
          from: '2026-06-01T00:00:00.000Z',
          to: '2026-06-05T23:59:59.000Z',
        })
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(
        mockOncologyNavigationService.getConsultationAvailableSlots
      ).not.toHaveBeenCalled();
    });

    it('consulta slots com tenantId do servidor (ignora tenant no payload)', async () => {
      mockOncologyNavigationService.getConsultationAvailableSlots.mockResolvedValue({
        slots: ['2026-06-01T15:00:00.000Z'],
      });

      await service.executeApprovedDecision({
        tenantId: TENANT,
        patientId: PATIENT_CTX,
        conversationId: convId,
        outputAction: {
          type: CHECK_CONSULTATION_AVAILABILITY,
          payload: {
            scheduledProfessionalId: PRO_ID,
            stepKey: 'navigation_consultation',
            from: '2026-06-01T00:00:00.000Z',
            to: '2026-06-05T23:59:59.000Z',
            tenantId: OTHER_TENANT,
          },
        },
        inputData: {},
      });

      expect(mockOncologyNavigationService.getConsultationAvailableSlots).toHaveBeenCalledWith(
        TENANT,
        expect.objectContaining({
          professionalId: PRO_ID,
          stepKey: 'navigation_consultation',
          from: '2026-06-01T00:00:00.000Z',
          to: '2026-06-05T23:59:59.000Z',
        })
      );
      expect(
        mockOncologyNavigationService.getConsultationAvailableSlots.mock.calls[0][0]
      ).not.toBe(OTHER_TENANT);
    });

    it('sem vagas: resposta determinística e bloco scheduling com slots vazios + expiresAt', async () => {
      mockOncologyNavigationService.getConsultationAvailableSlots.mockResolvedValue({
        slots: [],
      });

      const exec = service as unknown as {
        executeCheckConsultationAvailability: (
          decision: { outputAction?: { type?: string; payload?: unknown } },
          tenantId: string,
          conversationId: string
        ) => Promise<{
          overridePatientResponse?: string;
          schedulingAvailableSlots?: Record<string, unknown>;
        }>;
      };

      const side = await exec.executeCheckConsultationAvailability(
        {
          outputAction: {
            type: CHECK_CONSULTATION_AVAILABILITY,
            payload: {
              scheduledProfessionalId: PRO_ID,
              stepKey: 'navigation_consultation',
              from: '2026-06-01T00:00:00.000Z',
              to: '2026-06-05T23:59:59.000Z',
            },
          },
        },
        TENANT,
        convId
      );

      expect(side.overridePatientResponse).toMatch(/não há horários livres/i);
      expect(side.schedulingAvailableSlots?.slots).toEqual([]);
      expect(typeof side.schedulingAvailableSlots?.expiresAt).toBe('string');
      const expMs = new Date(
        String(side.schedulingAvailableSlots?.expiresAt)
      ).getTime();
      expect(expMs - Date.now()).toBeGreaterThan(
        SCHEDULING_SECRETARY_AVAILABILITY_STATE_TTL_MS - 5000
      );
      expect(expMs - Date.now()).toBeLessThanOrEqual(
        SCHEDULING_SECRETARY_AVAILABILITY_STATE_TTL_MS + 5000
      );
    });

    it('payload incompleto (sem profissional): não chama OncologyNavigation e mensagem orientativa', async () => {
      const exec = service as unknown as {
        executeCheckConsultationAvailability: (
          decision: { outputAction?: { type?: string; payload?: unknown } },
          tenantId: string,
          conversationId: string
        ) => Promise<{ overridePatientResponse?: string }>;
      };

      mockOncologyNavigationService.getConsultationAvailableSlots.mockClear();

      const side = await exec.executeCheckConsultationAvailability(
        {
          outputAction: {
            type: CHECK_CONSULTATION_AVAILABILITY,
            payload: {
              stepKey: 'navigation_consultation',
              from: '2026-06-01T00:00:00.000Z',
              to: '2026-06-05T23:59:59.000Z',
            },
          },
        },
        TENANT,
        convId
      );

      expect(mockOncologyNavigationService.getConsultationAvailableSlots).not.toHaveBeenCalled();
      expect(side.overridePatientResponse).toMatch(/faltam profissional/i);
    });

    it('CHECK: falha do OncologyNavigation retorna mensagem controlada (sem propagar)', async () => {
      mockOncologyNavigationService.getConsultationAvailableSlots.mockRejectedValue(
        new Error('timeout simulado')
      );

      const exec = service as unknown as {
        executeCheckConsultationAvailability: (
          decision: { outputAction?: { type?: string; payload?: unknown } },
          tenantId: string,
          conversationId: string
        ) => Promise<{ overridePatientResponse?: string }>;
      };

      const side = await exec.executeCheckConsultationAvailability(
        {
          outputAction: {
            type: CHECK_CONSULTATION_AVAILABILITY,
            payload: {
              scheduledProfessionalId: PRO_ID,
              stepKey: 'navigation_consultation',
              from: '2026-06-01T00:00:00.000Z',
              to: '2026-06-05T23:59:59.000Z',
            },
          },
        },
        TENANT,
        convId
      );

      expect(side.overridePatientResponse).toMatch(/não consegui consultar as vagas agora/i);
    });

    it('ordena e limita vagas ofertadas ao máximo configurado', async () => {
      const futureSlot = (daysFromNow: number, hourUtc: number): string => {
        const d = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000);
        d.setUTCHours(hourUtc, 0, 0, 0);
        return d.toISOString();
      };
      const from = futureSlot(1, 0);
      const to = futureSlot(30, 23);
      const many = [
        futureSlot(5, 16),
        futureSlot(2, 9),
        futureSlot(3, 11),
        futureSlot(1, 8),
        futureSlot(4, 14),
        futureSlot(6, 10),
        futureSlot(7, 12),
      ];
      mockOncologyNavigationService.getConsultationAvailableSlots.mockResolvedValue({
        slots: many,
      });

      const exec = service as unknown as {
        executeCheckConsultationAvailability: (
          decision: { outputAction?: { type?: string; payload?: unknown } },
          tenantId: string,
          conversationId: string
        ) => Promise<{ schedulingAvailableSlots?: { slots: string[] } }>;
      };

      const side = await exec.executeCheckConsultationAvailability(
        {
          outputAction: {
            type: CHECK_CONSULTATION_AVAILABILITY,
            payload: {
              scheduledProfessionalId: PRO_ID,
              stepKey: 'navigation_consultation',
              from,
              to,
            },
          },
        },
        TENANT,
        convId
      );

      expect(side.schedulingAvailableSlots?.slots).toHaveLength(
        SCHEDULING_SECRETARY_AVAILABILITY_OFFERED_SLOTS_MAX
      );
      const offered = side.schedulingAvailableSlots?.slots ?? [];
      for (let i = 1; i < offered.length; i++) {
        expect(new Date(offered[i - 1]).getTime()).toBeLessThanOrEqual(
          new Date(offered[i]).getTime()
        );
      }
    });
  });

  describe('executeApprovedDecision — revalidação de slot (cache scheduling.availableSlots)', () => {
    const convId = 'conv-uuid-reval';

    const validCreatePayload = {
      scheduledProfessionalId: PRO_ID,
      expectedDate: '2026-06-15T14:00:00.000Z',
      stepKey: 'navigation_consultation',
      stepName: 'Consulta de navegação',
      journeyStage: 'TREATMENT',
    };

    it('CREATE: cache válido e não expirado com o horário escolhido evita nova consulta de slots', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue({ id: PATIENT_CTX });
      mockPrisma.conversation.findFirst.mockResolvedValue({
        agentState: {
          scheduling: {
            availableSlots: {
              slots: ['2026-06-15T14:00:00.000Z'],
              expiresAt: new Date(Date.now() + 120_000).toISOString(),
            },
          },
        },
      });
      mockOncologyNavigationService.createConsultationAppointment.mockResolvedValue(undefined);
      mockOncologyNavigationService.getConsultationAvailableSlots.mockClear();

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

      expect(mockOncologyNavigationService.getConsultationAvailableSlots).not.toHaveBeenCalled();
      expect(mockOncologyNavigationService.createConsultationAppointment).toHaveBeenCalled();
    });

    it('CREATE: cache expirado reconsulta e não agenda se o horário sumiu da agenda', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue({ id: PATIENT_CTX });
      mockPrisma.conversation.findFirst.mockResolvedValue({
        agentState: {
          scheduling: {
            availableSlots: {
              slots: ['2026-06-15T14:00:00.000Z'],
              expiresAt: new Date(Date.now() - 60_000).toISOString(),
            },
          },
        },
      });
      mockOncologyNavigationService.getConsultationAvailableSlots.mockResolvedValue({
        slots: [],
      });

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

      expect(mockOncologyNavigationService.getConsultationAvailableSlots).toHaveBeenCalled();
      expect(mockOncologyNavigationService.createConsultationAppointment).not.toHaveBeenCalled();
    });

    it('CREATE: cache expirado reconsulta e agenda quando o horário ainda aparece na agenda', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue({ id: PATIENT_CTX });
      mockPrisma.conversation.findFirst.mockResolvedValue({
        agentState: {
          scheduling: {
            availableSlots: {
              slots: ['2026-06-15T14:00:00.000Z'],
              expiresAt: new Date(Date.now() - 60_000).toISOString(),
            },
          },
        },
      });
      mockOncologyNavigationService.getConsultationAvailableSlots.mockResolvedValue({
        slots: ['2026-06-15T14:00:00.000Z'],
      });
      mockOncologyNavigationService.createConsultationAppointment.mockResolvedValue(undefined);

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

      expect(mockOncologyNavigationService.createConsultationAppointment).toHaveBeenCalled();
    });

    it('RESCHEDULE: cache expirado revalida slot antes de updateStep', async () => {
      mockPrisma.navigationStep.findFirst.mockResolvedValue({
        id: STEP_ID,
        stepKey: 'navigation_consultation',
        status: NavigationStepStatus.PENDING,
        scheduledProfessionalId: PRO_ID,
      });
      mockPrisma.conversation.findFirst.mockResolvedValue({
        agentState: {
          scheduling: {
            availableSlots: {
              slots: ['2026-08-01T09:00:00.000Z'],
              expiresAt: new Date(Date.now() - 30_000).toISOString(),
            },
          },
        },
      });
      mockOncologyNavigationService.getConsultationAvailableSlots.mockResolvedValue({
        slots: ['2026-08-01T09:00:00.000Z'],
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

      expect(mockOncologyNavigationService.getConsultationAvailableSlots).toHaveBeenCalled();
      expect(mockOncologyNavigationService.updateStep).toHaveBeenCalled();
    });

    it('RESCHEDULE: falha revalidação leve quando horário não está mais na agenda', async () => {
      mockPrisma.navigationStep.findFirst.mockResolvedValue({
        id: STEP_ID,
        stepKey: 'navigation_consultation',
        status: NavigationStepStatus.PENDING,
        scheduledProfessionalId: PRO_ID,
      });
      mockPrisma.conversation.findFirst.mockResolvedValue({
        agentState: {
          scheduling: {
            availableSlots: {
              slots: ['2026-08-01T09:00:00.000Z'],
              expiresAt: new Date(Date.now() - 30_000).toISOString(),
            },
          },
        },
      });
      mockOncologyNavigationService.getConsultationAvailableSlots.mockResolvedValue({
        slots: [],
      });

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

      expect(mockOncologyNavigationService.updateStep).not.toHaveBeenCalled();
    });
  });

  describe('mergeAgentStateForPersistence — availableSlots', () => {
    it('incorpora availableSlots em scheduling sem apagar chaves irmãs', () => {
      const merge = (service as unknown as {
        mergeAgentStateForPersistence: (
          previous: Record<string, unknown> | null,
          aiNewState: Record<string, unknown> | undefined,
          availabilitySlots: Record<string, unknown> | undefined
        ) => Record<string, unknown>;
      }).mergeAgentStateForPersistence;

      const merged = merge(
        { scheduling: { lastIntent: 'agenda' }, other: 1 },
        undefined,
        { slots: ['2026-06-01T10:00:00.000Z'], expiresAt: '2026-06-01T11:00:00.000Z' }
      );

      expect(merged.other).toBe(1);
      const sched = merged.scheduling as Record<string, unknown>;
      expect(sched.lastIntent).toBe('agenda');
      expect(sched.availableSlots).toEqual({
        slots: ['2026-06-01T10:00:00.000Z'],
        expiresAt: '2026-06-01T11:00:00.000Z',
      });
    });
  });
});
