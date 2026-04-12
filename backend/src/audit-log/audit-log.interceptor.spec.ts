import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, firstValueFrom } from 'rxjs';
import { AuditLogInterceptor } from './audit-log.interceptor';
import { AuditLogService } from './audit-log.service';

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildContext(
  method: string,
  path: string,
  user: Record<string, unknown> = { tenantId: 'tenant-1', sub: 'user-uuid-1' }
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        method,
        path,
        user,
        headers: {},
        socket: { remoteAddress: '127.0.0.1' },
      }),
    }),
  } as unknown as ExecutionContext;
}

function buildCallHandler(responseBody: unknown = { id: 'resource-uuid-1' }): CallHandler {
  return { handle: () => of(responseBody) };
}

// ─── Mock AuditLogService ────────────────────────────────────────────────────

const mockAuditLogService = {
  log: jest.fn(),
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('AuditLogInterceptor', () => {
  let interceptor: AuditLogInterceptor;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockAuditLogService.log.mockResolvedValue({ id: 'audit-1' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogInterceptor,
        { provide: AuditLogService, useValue: mockAuditLogService },
      ],
    }).compile();

    interceptor = module.get<AuditLogInterceptor>(AuditLogInterceptor);
  });

  describe('recursos PHI — audit síncrono', () => {
    it('deve aguardar auditLogService.log antes de emitir a resposta (patients)', async () => {
      const callOrder: string[] = [];

      mockAuditLogService.log.mockImplementation(async () => {
        callOrder.push('audit');
        return { id: 'audit-1' };
      });

      const ctx = buildContext('POST', '/api/v1/patients');
      const handler: CallHandler = {
        handle: () => of({ id: 'patient-uuid-1', name: 'Paciente Teste' }),
      };

      const observable = interceptor.intercept(ctx, handler);

      // Ao subscrever o observable, registrar quando o dado é emitido
      await new Promise<void>((resolve) => {
        observable.subscribe({
          next: () => {
            callOrder.push('response');
          },
          complete: resolve,
        });
      });

      // O audit deve ter ocorrido ANTES da resposta chegar ao subscriber
      expect(callOrder.indexOf('audit')).toBeLessThan(
        callOrder.indexOf('response')
      );
    });

    it('deve chamar auditLogService.log com resourceType "patients" para caminho PHI', async () => {
      const ctx = buildContext('POST', '/api/v1/patients');
      const handler = buildCallHandler({ id: 'patient-uuid-1' });

      await firstValueFrom(interceptor.intercept(ctx, handler));

      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          resourceType: 'patients',
          tenantId: 'tenant-1',
          action: 'CREATE',
        })
      );
    });

    it('não deve quebrar o request quando auditLogService.log lança exceção (recurso PHI)', async () => {
      mockAuditLogService.log.mockRejectedValue(new Error('DB down'));

      const ctx = buildContext('PATCH', '/api/v1/medications/uuid-1');
      const handler = buildCallHandler({ id: 'uuid-1', name: 'Medicamento' });

      // Deve resolver sem lançar a exceção do audit
      const result = await firstValueFrom(interceptor.intercept(ctx, handler));
      expect(result).toMatchObject({ id: 'uuid-1' });
    });

    it('deve usar audit síncrono para todos os tipos PHI declarados', async () => {
      const phiPaths = [
        '/api/v1/patients',
        '/api/v1/cancer-diagnoses',
        '/api/v1/clinical-disposition',
        '/api/v1/medications',
        '/api/v1/performance-status',
        '/api/v1/observations',
        '/api/v1/questionnaire-responses',
      ];

      for (const path of phiPaths) {
        mockAuditLogService.log.mockClear();
        mockAuditLogService.log.mockResolvedValue({ id: 'audit-1' });

        const ctx = buildContext('POST', path);
        const handler = buildCallHandler({ id: 'resource-1' });

        await firstValueFrom(interceptor.intercept(ctx, handler));

        expect(mockAuditLogService.log).toHaveBeenCalledTimes(1);
      }
    });
  });

  describe('recursos não-PHI — audit fire-and-forget (setImmediate)', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('deve completar o observable ANTES de auditLogService.log ser chamado', async () => {
      const callOrder: string[] = [];

      mockAuditLogService.log.mockImplementation(async () => {
        callOrder.push('audit');
        return { id: 'audit-1' };
      });

      const ctx = buildContext('POST', '/api/v1/conversations');
      const handler: CallHandler = {
        handle: () =>
          of({ id: 'conv-uuid-1' }).pipe(
            // Registrar quando a resposta é emitida
          ),
      };

      await new Promise<void>((resolve) => {
        interceptor.intercept(ctx, handler).subscribe({
          next: () => callOrder.push('response'),
          complete: resolve,
        });
      });

      // Antes de runAllTimers, audit ainda não foi chamado (fire-and-forget)
      expect(callOrder).toEqual(['response']);
      expect(mockAuditLogService.log).not.toHaveBeenCalled();

      // Após runAllTimers, setImmediate executa e o audit é chamado
      jest.runAllTimers();
      await Promise.resolve(); // flush microtasks
      expect(mockAuditLogService.log).toHaveBeenCalledTimes(1);
    });

    it('deve chamar auditLogService.log com resourceType correto para recurso não-PHI', async () => {
      const ctx = buildContext('DELETE', '/api/v1/conversations/uuid-1');
      const handler = buildCallHandler({ id: 'uuid-1' });

      await firstValueFrom(interceptor.intercept(ctx, handler));
      jest.runAllTimers();
      await Promise.resolve();

      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          resourceType: 'conversations',
          action: 'DELETE',
          tenantId: 'tenant-1',
        })
      );
    });
  });

  describe('rotas GET — audit NÃO é chamado', () => {
    it('não deve chamar auditLogService.log para método GET', async () => {
      const ctx = buildContext('GET', '/api/v1/patients');
      const handler = buildCallHandler([{ id: 'patient-1' }]);

      await firstValueFrom(interceptor.intercept(ctx, handler));

      expect(mockAuditLogService.log).not.toHaveBeenCalled();
    });

    it('não deve chamar auditLogService.log para método GET em recurso PHI', async () => {
      const ctx = buildContext('GET', '/api/v1/medications/uuid-1');
      const handler = buildCallHandler({ id: 'uuid-1' });

      await firstValueFrom(interceptor.intercept(ctx, handler));

      expect(mockAuditLogService.log).not.toHaveBeenCalled();
    });
  });

  describe('requests sem tenantId autenticado', () => {
    it('não deve chamar auditLogService.log quando user não tem tenantId', async () => {
      const ctx = buildContext('POST', '/api/v1/patients', { sub: 'user-1' }); // sem tenantId
      const handler = buildCallHandler({ id: 'patient-1' });

      await firstValueFrom(interceptor.intercept(ctx, handler));

      expect(mockAuditLogService.log).not.toHaveBeenCalled();
    });
  });
});
