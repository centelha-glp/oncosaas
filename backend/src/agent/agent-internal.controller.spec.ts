import { createHmac } from 'crypto';
import {
  BadRequestException,
  ExecutionContext,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AgentInternalController } from './agent-internal.controller';
import { BackendServiceTokenGuard } from './guards/backend-service-token.guard';

const TENANT = 'tenant-uuid-abc';
const TOKEN = 'service-token-test';

function makeContext(headers: Record<string, string>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers }),
    }),
  } as unknown as ExecutionContext;
}

describe('BackendServiceTokenGuard', () => {
  it('aceita Bearer + X-Tenant-Auth e vincula tenant interno', () => {
    const guard = new BackendServiceTokenGuard({
      get: jest.fn().mockReturnValue(TOKEN),
    } as unknown as ConfigService);
    const req = {
      headers: {
        authorization: `Bearer ${TOKEN}`,
        'x-tenant-id': TENANT,
        'x-tenant-auth': createHmac('sha256', TOKEN)
          .update(TENANT, 'utf8')
          .digest('hex'),
      },
    };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;

    expect(guard.canActivate(ctx)).toBe(true);
    expect(req).toHaveProperty('internalTenantId', TENANT);
  });

  it('rejeita token ausente ou inválido', () => {
    const guard = new BackendServiceTokenGuard({
      get: jest.fn().mockReturnValue(TOKEN),
    } as unknown as ConfigService);

    expect(() => guard.canActivate(makeContext({}))).toThrow(
      UnauthorizedException
    );
    expect(() =>
      guard.canActivate(
        makeContext({
          authorization: 'Bearer wrong',
          'x-tenant-id': TENANT,
          'x-tenant-auth': 'bad',
        })
      )
    ).toThrow(UnauthorizedException);
  });

  it('rejeita quando falta X-Tenant-Id ou X-Tenant-Auth (prova de serviço por tenant)', () => {
    const guard = new BackendServiceTokenGuard({
      get: jest.fn().mockReturnValue(TOKEN),
    } as unknown as ConfigService);
    const auth = createHmac('sha256', TOKEN).update(TENANT, 'utf8').digest('hex');

    expect(() =>
      guard.canActivate(
        makeContext({
          authorization: `Bearer ${TOKEN}`,
          'x-tenant-auth': auth,
        })
      )
    ).toThrow(UnauthorizedException);

    expect(() =>
      guard.canActivate(
        makeContext({
          authorization: `Bearer ${TOKEN}`,
          'x-tenant-id': TENANT,
        })
      )
    ).toThrow(UnauthorizedException);
  });

  it('rejeita prova HMAC de tenant incorreta (timing-safe)', () => {
    const guard = new BackendServiceTokenGuard({
      get: jest.fn().mockReturnValue(TOKEN),
    } as unknown as ConfigService);
    const otherTenant = 'tenant-outro-uuid';
    const wrongProof = createHmac('sha256', TOKEN)
      .update(otherTenant, 'utf8')
      .digest('hex');

    expect(() =>
      guard.canActivate(
        makeContext({
          authorization: `Bearer ${TOKEN}`,
          'x-tenant-id': TENANT,
          'x-tenant-auth': wrongProof,
        })
      )
    ).toThrow(UnauthorizedException);
  });

  it('bloqueia quando BACKEND_SERVICE_TOKEN não está configurado', () => {
    const guard = new BackendServiceTokenGuard({
      get: jest.fn().mockReturnValue(undefined),
    } as unknown as ConfigService);

    expect(() => guard.canActivate(makeContext({}))).toThrow(
      ServiceUnavailableException
    );
  });
});

describe('AgentInternalController', () => {
  it('consulta disponibilidade usando tenant validado pelo guard', async () => {
    const agentService = {
      getInternalConsultationAvailability: jest.fn().mockResolvedValue({
        slots: ['2026-06-01T12:00:00.000Z'],
      }),
    };
    const controller = new AgentInternalController(agentService as any);
    const dto = {
      professionalId: '550e8400-e29b-41d4-a716-446655440000',
      stepKey: 'navigation_consultation',
      from: '2026-06-01T00:00:00.000Z',
      to: '2026-06-02T00:00:00.000Z',
    };

    await expect(
      controller.getConsultationAvailability(dto, {
        internalTenantId: TENANT,
      } as any)
    ).resolves.toEqual({ slots: ['2026-06-01T12:00:00.000Z'] });
    expect(agentService.getInternalConsultationAvailability).toHaveBeenCalledWith(
      TENANT,
      dto
    );
  });

  it('falha explicitamente se o guard não vinculou tenant interno', async () => {
    const agentService = {
      getInternalConsultationAvailability: jest.fn(),
    };
    const controller = new AgentInternalController(agentService as any);

    await expect(
      controller.getConsultationAvailability(
        {
          professionalId: '550e8400-e29b-41d4-a716-446655440000',
          stepKey: 'navigation_consultation',
          from: '2026-06-01T00:00:00.000Z',
          to: '2026-06-02T00:00:00.000Z',
        },
        {} as any
      )
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(agentService.getInternalConsultationAvailability).not.toHaveBeenCalled();
  });

  it('lista profissionais de consulta usando tenant validado pelo guard', async () => {
    const agentService = {
      getInternalConsultationProfessionals: jest.fn().mockResolvedValue({
        professionals: [{ id: 'u-1', name: 'Dra Onco' }],
      }),
    };
    const controller = new AgentInternalController(agentService as any);

    await expect(
      controller.listConsultationProfessionals(
        { stepKey: 'specialist_consultation' },
        { internalTenantId: TENANT } as any
      )
    ).resolves.toEqual({ professionals: [{ id: 'u-1', name: 'Dra Onco' }] });
    expect(agentService.getInternalConsultationProfessionals).toHaveBeenCalledWith(
      TENANT,
      { stepKey: 'specialist_consultation' }
    );
  });
});
