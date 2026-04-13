import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { AlertsService } from '@/alerts/alerts.service';
import { PrismaService } from '@/prisma/prisma.service';
import { AlertsGateway } from '@/gateways/alerts.gateway';

const mockPrisma = {
  patient: { findFirst: jest.fn() },
  alert: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    count: jest.fn(),
  },
};

const mockGateway = {
  emitCriticalAlert: jest.fn(),
  emitNewAlert: jest.fn(),
  emitAlertUpdate: jest.fn(),
  emitOpenAlertsCount: jest.fn(),
};

const TENANT = 'tenant-abc';
const OTHER_TENANT = 'tenant-xyz';
const PATIENT_ID = 'patient-1';
const ALERT_ID = 'alert-1';

const baseAlert = {
  id: ALERT_ID,
  patientId: PATIENT_ID,
  tenantId: TENANT,
  type: 'NO_RESPONSE',
  severity: 'HIGH',
  status: 'PENDING',
  message: 'No response from patient',
  context: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  resolvedAt: null,
  resolvedBy: null,
  acknowledgedAt: null,
  acknowledgedBy: null,
  // phone omitido intencionalmente — LGPD: campo sensível não deve aparecer em responses
  patient: { id: PATIENT_ID, name: 'Ana Silva' },
};

describe('AlertsService', () => {
  let service: AlertsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AlertsGateway, useValue: mockGateway },
      ],
    }).compile();

    service = module.get<AlertsService>(AlertsService);
  });

  // ─── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    const dto = {
      patientId: PATIENT_ID,
      type: 'NO_RESPONSE' as any,
      severity: 'HIGH' as any,
      message: 'No response from patient',
    };

    it('should throw NotFoundException when patient does not exist', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue(null);

      await expect(service.create(dto, TENANT)).rejects.toThrow(NotFoundException);
    });

    it('should not find patient outside tenant scope', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue(null);

      await expect(service.create(dto, OTHER_TENANT)).rejects.toThrow(NotFoundException);

      expect(mockPrisma.patient.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ tenantId: OTHER_TENANT }) })
      );
    });

    it('should return existing open alert instead of creating a duplicate', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue({ id: PATIENT_ID });
      mockPrisma.alert.findFirst.mockResolvedValue(baseAlert);

      const result = await service.create(dto, TENANT);

      expect(result).toEqual(baseAlert);
      expect(mockPrisma.alert.create).not.toHaveBeenCalled();
      expect(mockGateway.emitNewAlert).not.toHaveBeenCalled();
    });

    it('should create a new alert when no open alert of same type exists', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue({ id: PATIENT_ID });
      mockPrisma.alert.findFirst.mockResolvedValue(null); // no duplicate
      mockPrisma.alert.create.mockResolvedValue(baseAlert);
      mockPrisma.alert.count.mockResolvedValue(3);

      const result = await service.create(dto, TENANT);

      expect(result).toEqual(baseAlert);
      expect(mockPrisma.alert.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tenantId: TENANT, status: 'PENDING' }),
        })
      );
      expect(mockGateway.emitNewAlert).toHaveBeenCalledWith(TENANT, baseAlert);
    });

    it('should emit critical alert event when severity is CRITICAL', async () => {
      const criticalAlert = { ...baseAlert, severity: 'CRITICAL' };
      mockPrisma.patient.findFirst.mockResolvedValue({ id: PATIENT_ID });
      mockPrisma.alert.findFirst.mockResolvedValue(null);
      mockPrisma.alert.create.mockResolvedValue(criticalAlert);
      mockPrisma.alert.count.mockResolvedValue(1);

      await service.create({ ...dto, severity: 'CRITICAL' as any }, TENANT);

      expect(mockGateway.emitCriticalAlert).toHaveBeenCalledWith(TENANT, criticalAlert);
    });

    it('should not emit critical alert event when severity is not CRITICAL', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue({ id: PATIENT_ID });
      mockPrisma.alert.findFirst.mockResolvedValue(null);
      mockPrisma.alert.create.mockResolvedValue(baseAlert);
      mockPrisma.alert.count.mockResolvedValue(2);

      await service.create(dto, TENANT);

      expect(mockGateway.emitCriticalAlert).not.toHaveBeenCalled();
    });
  });

  // ─── update — status transition direction ───────────────────────────────────

  describe('update — status transition validation', () => {
    it('should throw NotFoundException when alert does not exist', async () => {
      mockPrisma.alert.findFirst.mockResolvedValue(null);

      await expect(
        service.update(ALERT_ID, { status: 'ACKNOWLEDGED' as any }, TENANT)
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject RESOLVED → ACKNOWLEDGED (backward transition)', async () => {
      mockPrisma.alert.findFirst.mockResolvedValue({ ...baseAlert, status: 'RESOLVED' });

      await expect(
        service.update(ALERT_ID, { status: 'ACKNOWLEDGED' as any }, TENANT)
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject RESOLVED → PENDING (backward transition)', async () => {
      mockPrisma.alert.findFirst.mockResolvedValue({ ...baseAlert, status: 'RESOLVED' });

      await expect(
        service.update(ALERT_ID, { status: 'PENDING' as any }, TENANT)
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject DISMISSED → RESOLVED (terminal state)', async () => {
      mockPrisma.alert.findFirst.mockResolvedValue({ ...baseAlert, status: 'DISMISSED' });

      await expect(
        service.update(ALERT_ID, { status: 'RESOLVED' as any }, TENANT)
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow PENDING → ACKNOWLEDGED', async () => {
      mockPrisma.alert.findFirst.mockResolvedValue({ ...baseAlert, status: 'PENDING' });
      mockPrisma.alert.updateMany.mockResolvedValue({ count: 1 });
      const updated = { ...baseAlert, status: 'ACKNOWLEDGED', acknowledgedAt: new Date() };
      mockPrisma.alert.findFirst
        .mockResolvedValueOnce({ ...baseAlert, status: 'PENDING' }) // first call (existence check)
        .mockResolvedValueOnce(updated); // second call (findOne after update)

      const result = await service.update(
        ALERT_ID,
        { status: 'ACKNOWLEDGED' as any, acknowledgedBy: 'user-99' },
        TENANT
      );

      expect(result.status).toBe('ACKNOWLEDGED');
    });

    it('should allow PENDING → RESOLVED', async () => {
      mockPrisma.alert.findFirst
        .mockResolvedValueOnce({ ...baseAlert, status: 'PENDING' })
        .mockResolvedValueOnce({ ...baseAlert, status: 'RESOLVED', resolvedAt: new Date() });
      mockPrisma.alert.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.update(
        ALERT_ID,
        { status: 'RESOLVED' as any, resolvedBy: 'user-99' },
        TENANT
      );

      expect(result.status).toBe('RESOLVED');
    });

    it('should allow ACKNOWLEDGED → RESOLVED', async () => {
      mockPrisma.alert.findFirst
        .mockResolvedValueOnce({ ...baseAlert, status: 'ACKNOWLEDGED' })
        .mockResolvedValueOnce({ ...baseAlert, status: 'RESOLVED', resolvedAt: new Date() });
      mockPrisma.alert.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.update(
        ALERT_ID,
        { status: 'RESOLVED' as any },
        TENANT
      );

      expect(result.status).toBe('RESOLVED');
    });
  });

  // ─── update — atomic concurrent transition ──────────────────────────────────

  describe('update — concurrency protection', () => {
    it('should throw ConflictException when updateMany matches 0 rows (concurrent transition)', async () => {
      mockPrisma.alert.findFirst.mockResolvedValue({ ...baseAlert, status: 'PENDING' });
      mockPrisma.alert.updateMany.mockResolvedValue({ count: 0 }); // concurrent request won

      await expect(
        service.update(ALERT_ID, { status: 'ACKNOWLEDGED' as any }, TENANT)
      ).rejects.toThrow(ConflictException);
    });

    it('should use updateMany with status precondition for atomic transition', async () => {
      mockPrisma.alert.findFirst
        .mockResolvedValueOnce({ ...baseAlert, status: 'PENDING' })
        .mockResolvedValueOnce({ ...baseAlert, status: 'ACKNOWLEDGED' });
      mockPrisma.alert.updateMany.mockResolvedValue({ count: 1 });

      await service.update(ALERT_ID, { status: 'ACKNOWLEDGED' as any }, TENANT);

      expect(mockPrisma.alert.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: ALERT_ID, tenantId: TENANT, status: 'PENDING' }),
        })
      );
    });

    it('should use plain update (not updateMany) when no status change', async () => {
      mockPrisma.alert.findFirst
        .mockResolvedValueOnce(baseAlert)
        .mockResolvedValueOnce({ ...baseAlert, message: 'updated' });
      mockPrisma.alert.update.mockResolvedValue({ ...baseAlert, message: 'updated' });

      await service.update(ALERT_ID, { message: 'updated' }, TENANT);

      expect(mockPrisma.alert.updateMany).not.toHaveBeenCalled();
      expect(mockPrisma.alert.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: ALERT_ID, tenantId: TENANT } })
      );
    });
  });

  // ─── findOne — tenant isolation ─────────────────────────────────────────────

  describe('findOne', () => {
    it('should throw NotFoundException when alert belongs to different tenant', async () => {
      mockPrisma.alert.findFirst.mockResolvedValue(null); // DB returns nothing for wrong tenant

      await expect(service.findOne(ALERT_ID, OTHER_TENANT)).rejects.toThrow(NotFoundException);

      expect(mockPrisma.alert.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ tenantId: OTHER_TENANT }) })
      );
    });

    it('should return alert when tenant matches', async () => {
      mockPrisma.alert.findFirst.mockResolvedValue(baseAlert);

      const result = await service.findOne(ALERT_ID, TENANT);

      expect(result).toEqual(baseAlert);
    });
  });

  // ─── acknowledge / resolve convenience wrappers ────────────────────────────

  describe('acknowledge', () => {
    it('should delegate to update with ACKNOWLEDGED status', async () => {
      mockPrisma.alert.findFirst
        .mockResolvedValueOnce({ ...baseAlert, status: 'PENDING' })
        .mockResolvedValueOnce({ ...baseAlert, status: 'ACKNOWLEDGED' });
      mockPrisma.alert.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.alert.count.mockResolvedValue(2);

      await service.acknowledge(ALERT_ID, TENANT, 'user-99');

      expect(mockPrisma.alert.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'ACKNOWLEDGED', acknowledgedBy: 'user-99' }),
        })
      );
    });
  });

  describe('resolve', () => {
    it('should delegate to update with RESOLVED status', async () => {
      mockPrisma.alert.findFirst
        .mockResolvedValueOnce({ ...baseAlert, status: 'ACKNOWLEDGED' })
        .mockResolvedValueOnce({ ...baseAlert, status: 'RESOLVED' });
      mockPrisma.alert.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.alert.count.mockResolvedValue(1);

      await service.resolve(ALERT_ID, TENANT, 'user-99');

      expect(mockPrisma.alert.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'RESOLVED', resolvedBy: 'user-99' }),
        })
      );
    });
  });

  // ─── LGPD: phone não exposto em respostas públicas ──────────────────────────

  describe('LGPD — campo phone nao exposto nas respostas', () => {
    it('findAll nao deve solicitar phone no select de patient', async () => {
      mockPrisma.alert.findMany.mockResolvedValue([baseAlert]);

      await service.findAll(TENANT);

      const callArgs = mockPrisma.alert.findMany.mock.calls[0][0];
      const patientSelect = callArgs?.include?.patient?.select ?? {};
      expect(patientSelect).not.toHaveProperty('phone');
    });

    it('findOne nao deve solicitar phone no select de patient', async () => {
      mockPrisma.alert.findFirst.mockResolvedValue(baseAlert);

      await service.findOne(ALERT_ID, TENANT);

      const callArgs = mockPrisma.alert.findFirst.mock.calls[0][0];
      const patientSelect = callArgs?.include?.patient?.select ?? {};
      expect(patientSelect).not.toHaveProperty('phone');
    });

    it('create nao deve solicitar phone no select de patient', async () => {
      const dto = {
        patientId: PATIENT_ID,
        type: 'NO_RESPONSE' as any,
        severity: 'HIGH' as any,
        message: 'No response',
      };
      mockPrisma.patient.findFirst.mockResolvedValue({ id: PATIENT_ID });
      mockPrisma.alert.findFirst.mockResolvedValue(null);
      mockPrisma.alert.create.mockResolvedValue(baseAlert);
      mockPrisma.alert.count.mockResolvedValue(1);

      await service.create(dto, TENANT);

      const createCall = mockPrisma.alert.create.mock.calls[0][0];
      const patientSelect = createCall?.include?.patient?.select ?? {};
      expect(patientSelect).not.toHaveProperty('phone');
    });

    it('getCriticalAlerts nao deve solicitar phone no select de patient', async () => {
      mockPrisma.alert.findMany.mockResolvedValue([baseAlert]);

      await service.getCriticalAlerts(TENANT);

      const callArgs = mockPrisma.alert.findMany.mock.calls[0][0];
      const patientSelect = callArgs?.include?.patient?.select ?? {};
      expect(patientSelect).not.toHaveProperty('phone');
    });
  });

  describe('getCriticalAlerts', () => {
    it('should cap list with take 500', async () => {
      mockPrisma.alert.findMany.mockResolvedValue([]);

      await service.getCriticalAlerts(TENANT);

      expect(mockPrisma.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: TENANT,
            severity: 'CRITICAL',
          }),
          take: 500,
        })
      );
    });
  });
});
