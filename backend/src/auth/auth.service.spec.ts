import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '@/auth/auth.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '@/prisma/prisma.service';
import { RedisService } from '@/redis/redis.service';
import { AuditLogService } from '@/audit-log/audit-log.service';

// Minimal mocks
const mockPrisma = {
  user: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  tenant: {
    findUnique: jest.fn(),
  },
};

const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  increment: jest.fn(),
};

const mockJwt = {
  sign: jest.fn().mockReturnValue('mock-access-token'),
};

const mockConfig = {
  get: jest.fn().mockReturnValue(undefined),
};

const mockAuditLog = {
  log: jest.fn().mockResolvedValue({}),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
        { provide: RedisService, useValue: mockRedis },
        { provide: AuditLogService, useValue: mockAuditLog },
      ],
    })
      .overrideProvider('PrismaService')
      .useValue(mockPrisma)
      .overrideProvider('RedisService')
      .useValue(mockRedis)
      .compile();

    service = module.get<AuthService>(AuthService);

    // Inject private dependencies directly to work around NestJS token names
    (service as any).prisma = mockPrisma;
    (service as any).jwtService = mockJwt;
    (service as any).configService = mockConfig;
    (service as any).redisService = mockRedis;
    (service as any).auditLogService = mockAuditLog;
  });

  describe('validateUser', () => {
    it('should throw ForbiddenException when account is locked', async () => {
      mockRedis.get.mockResolvedValueOnce('1'); // locked key exists

      await expect(
        service.validateUser('test@example.com', 'password', 'tenant-1')
      ).rejects.toThrow(ForbiddenException);
    });

    it('should authenticate without tenantId (first login)', async () => {
      const hashedPassword = await bcrypt.hash('correct-password', 10);

      mockRedis.get.mockResolvedValue(null); // not locked
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        password: hashedPassword,
        mfaEnabled: false,
        tenantId: 'tenant-1',
        role: 'NURSE',
        tenant: { id: 'tenant-1', name: 'Test' },
      });
      mockRedis.del.mockResolvedValue(1);

      const result = await service.validateUser(
        'test@example.com',
        'correct-password'
      );

      expect(result).toMatchObject({
        id: 'user-1',
        email: 'test@example.com',
        tenantId: 'tenant-1',
      });
      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { email: 'test@example.com' },
        })
      );
    });

    it('should throw UnauthorizedException when user not found in tenant', async () => {
      mockRedis.get.mockResolvedValue(null); // not locked
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockRedis.increment.mockResolvedValue(1);

      await expect(
        service.validateUser('unknown@example.com', 'password', 'tenant-1')
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when password is invalid', async () => {
      const hashedPassword = await bcrypt.hash('correct-password', 10);

      mockRedis.get.mockResolvedValue(null); // not locked
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        password: hashedPassword,
        mfaEnabled: false,
        tenantId: 'tenant-1',
        role: 'NURSE',
        tenant: { id: 'tenant-1', name: 'Test' },
      });
      mockRedis.increment.mockResolvedValue(1);

      await expect(
        service.validateUser('test@example.com', 'wrong-password', 'tenant-1')
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should return user without password when credentials are valid', async () => {
      const hashedPassword = await bcrypt.hash('correct-password', 10);
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        password: hashedPassword,
        mfaEnabled: false,
        tenantId: 'tenant-1',
        role: 'NURSE',
        tenant: { id: 'tenant-1', name: 'Test' },
      };

      mockRedis.get.mockResolvedValue(null); // not locked
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockRedis.del.mockResolvedValue(1);

      const result = await service.validateUser(
        'test@example.com',
        'correct-password',
        'tenant-1'
      );

      expect(result).not.toHaveProperty('password');
      expect(result.id).toBe('user-1');
      expect(result.email).toBe('test@example.com');
    });

    it('should not return user from a different tenant', async () => {
      mockRedis.get.mockResolvedValue(null); // not locked
      mockPrisma.user.findFirst.mockResolvedValue(null); // DB scopes query to tenantId
      mockRedis.increment.mockResolvedValue(1);

      await expect(
        service.validateUser('test@example.com', 'correct-password', 'other-tenant')
      ).rejects.toThrow(UnauthorizedException);

      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ tenantId: 'other-tenant' }) })
      );
    });

    it('should throw UnauthorizedException when MFA is enabled', async () => {
      const hashedPassword = await bcrypt.hash('correct-password', 10);

      mockRedis.get.mockResolvedValue(null);
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        password: hashedPassword,
        mfaEnabled: true,
        tenantId: 'tenant-1',
        role: 'ADMIN',
        tenant: { id: 'tenant-1', name: 'Test' },
      });

      await expect(
        service.validateUser('test@example.com', 'correct-password', 'tenant-1')
      ).rejects.toThrow(UnauthorizedException);
    });

  });

  describe('login', () => {
    it('should return access_token, refresh_token, and user on successful login', async () => {
      const hashedPassword = await bcrypt.hash('senha123', 10);

      mockRedis.get.mockResolvedValue(null);
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        email: 'nurse@example.com',
        password: hashedPassword,
        mfaEnabled: false,
        name: 'Test Nurse',
        role: 'NURSE',
        tenantId: 'tenant-1',
        tenant: { id: 'tenant-1', name: 'Hospital Test' },
      });
      mockRedis.del.mockResolvedValue(1);
      mockRedis.set.mockResolvedValue('OK');

      const result = await service.login(
        { email: 'nurse@example.com', password: 'senha123' },
        'tenant-1'
      );

      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('refresh_token');
      expect(result.user.email).toBe('nurse@example.com');
      expect(result.user).not.toHaveProperty('password');
    });
  });

  describe('forgotPassword', () => {
    it('should silently succeed when email is not found (no enumeration)', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.forgotPassword('ghost@example.com')
      ).resolves.not.toThrow();
      expect(mockRedis.set).not.toHaveBeenCalled();
    });

    it('should store reset token in Redis when user exists', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        email: 'admin@example.com',
      });
      mockRedis.set.mockResolvedValue('OK');

      await service.forgotPassword('admin@example.com');

      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringMatching(/^prt:/),
        'user-1',
        3600
      );
    });
  });

  describe('resetPassword', () => {
    it('should throw UnauthorizedException for invalid token', async () => {
      mockRedis.get.mockResolvedValue(null);

      await expect(
        service.resetPassword('invalid-token', 'newpassword')
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should update password and invalidate token on valid token', async () => {
      mockRedis.get.mockResolvedValue('user-1');
      mockRedis.del.mockResolvedValue(1);
      mockPrisma.user.update.mockResolvedValue({ id: 'user-1' });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'admin@example.com',
      });

      await service.resetPassword('valid-token', 'newPassword123');

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { password: expect.any(String) },
      });
      expect(mockRedis.del).toHaveBeenCalledWith('prt:valid-token');
    });

    it('deve invalidar o token ANTES de atualizar a senha (prevenção de replay)', async () => {
      const callOrder: string[] = [];

      mockRedis.get.mockResolvedValue('user-1');
      mockRedis.del.mockImplementation(async () => {
        callOrder.push('del');
        return 1;
      });
      mockPrisma.user.update.mockImplementation(async () => {
        callOrder.push('update');
        return { id: 'user-1' };
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'admin@example.com',
      });

      await service.resetPassword('valid-token', 'newPassword123');

      // del pode ser chamado múltiplas vezes (token + clearFailedAttempts),
      // mas o primeiro del deve ocorrer antes do update
      const firstDelIdx = callOrder.indexOf('del');
      const updateIdx = callOrder.indexOf('update');
      expect(firstDelIdx).toBeGreaterThanOrEqual(0);
      expect(updateIdx).toBeGreaterThan(firstDelIdx);
    });

    it('nao deve permitir reutilizar token após uso — del é chamado mesmo se update falhar', async () => {
      mockRedis.get.mockResolvedValue('user-1');
      mockRedis.del.mockResolvedValue(1);
      mockPrisma.user.update.mockRejectedValue(new Error('DB error'));
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.resetPassword('valid-token', 'newPassword123')
      ).rejects.toThrow();

      // del deve ter sido chamado mesmo que update falhe
      expect(mockRedis.del).toHaveBeenCalledWith('prt:valid-token');
    });
  });

  // ─── register (invite system) ──────────────────────────────────────────────

  describe('register', () => {
    const INVITE_TOKEN = 'valid-invite-token-abc123';
    const INVITE_KEY = `inv:${INVITE_TOKEN}`;

    it('deve criar usuário com tenantId e role extraídos do payload do convite', async () => {
      const payload = JSON.stringify({ tenantId: 'tenant-1', role: 'NURSE' });
      mockRedis.get.mockResolvedValueOnce(payload);
      mockRedis.del.mockResolvedValue(1);
      mockPrisma.user.findFirst.mockResolvedValue(null);
      const createdUser = {
        id: 'user-new',
        email: 'nova@example.com',
        name: 'Nova Enfermeira',
        role: 'NURSE',
        tenantId: 'tenant-1',
        tenant: { id: 'tenant-1', name: 'Hospital Teste' },
        clinicalSubrole: null,
      };
      mockPrisma.user.create.mockResolvedValue(createdUser);

      const result = await service.register({
        inviteToken: INVITE_TOKEN,
        email: 'nova@example.com',
        name: 'Nova Enfermeira',
        password: 'Senha@123',
      } as any);

      expect(result.user.tenantId).toBe('tenant-1');
      expect(result.user.role).toBe('NURSE');
      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tenantId: 'tenant-1', role: 'NURSE' }),
        })
      );
    });

    it('deve lançar UnauthorizedException para token inexistente ou expirado', async () => {
      mockRedis.get.mockResolvedValueOnce(null);

      await expect(
        service.register({
          inviteToken: 'token-inexistente',
          email: 'x@x.com',
          name: 'X',
          password: 'Senha@123',
        } as any)
      ).rejects.toThrow(UnauthorizedException);

      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it('deve lançar UnauthorizedException para token com JSON malformado', async () => {
      mockRedis.get.mockResolvedValueOnce('isto-nao-e-json{{{');

      await expect(
        service.register({
          inviteToken: INVITE_TOKEN,
          email: 'x@x.com',
          name: 'X',
          password: 'Senha@123',
        } as any)
      ).rejects.toThrow(UnauthorizedException);

      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it('deve lançar UnauthorizedException e NÃO criar usuário quando email já cadastrado no tenant', async () => {
      const payload = JSON.stringify({ tenantId: 'tenant-1', role: 'NURSE' });
      mockRedis.get.mockResolvedValueOnce(payload);
      mockRedis.del.mockResolvedValue(1);
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'user-existente' }); // email duplicado

      await expect(
        service.register({
          inviteToken: INVITE_TOKEN,
          email: 'duplicado@example.com',
          name: 'Duplicado',
          password: 'Senha@123',
        } as any)
      ).rejects.toThrow(UnauthorizedException);

      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it('deve invalidar o token (del) ANTES de criar o usuário (anti-replay)', async () => {
      const callOrder: string[] = [];
      const payload = JSON.stringify({ tenantId: 'tenant-1', role: 'COORDINATOR' });

      mockRedis.get.mockResolvedValueOnce(payload);
      mockRedis.del.mockImplementation(async () => {
        callOrder.push('del');
        return 1;
      });
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.create.mockImplementation(async () => {
        callOrder.push('create');
        return {
          id: 'user-new',
          email: 'u@u.com',
          name: 'U',
          role: 'COORDINATOR',
          tenantId: 'tenant-1',
          tenant: { id: 'tenant-1', name: 'H' },
          clinicalSubrole: null,
        };
      });

      await service.register({
        inviteToken: INVITE_TOKEN,
        email: 'u@u.com',
        name: 'U',
        password: 'Senha@123',
      } as any);

      const delIdx = callOrder.indexOf('del');
      const createIdx = callOrder.indexOf('create');
      expect(delIdx).toBeGreaterThanOrEqual(0);
      expect(createIdx).toBeGreaterThan(delIdx);
    });

    it('deve verificar o token com a chave correta inv:<token>', async () => {
      const payload = JSON.stringify({ tenantId: 'tenant-1', role: 'NURSE' });
      mockRedis.get.mockResolvedValueOnce(payload);
      mockRedis.del.mockResolvedValue(1);
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        name: 'A',
        role: 'NURSE',
        tenantId: 'tenant-1',
        tenant: { id: 'tenant-1', name: 'H' },
        clinicalSubrole: null,
      });

      await service.register({
        inviteToken: INVITE_TOKEN,
        email: 'a@b.com',
        name: 'A',
        password: 'Senha@123',
      } as any);

      expect(mockRedis.get).toHaveBeenCalledWith(INVITE_KEY);
    });
  });

  // ─── createInvite ───────────────────────────────────────────────────────────

  describe('createInvite', () => {
    it('deve armazenar payload JSON correto no Redis com chave inv:<token> e TTL 48h', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({ id: 'tenant-1', name: 'Hospital Teste' });
      mockRedis.set.mockResolvedValue('OK');

      const result = await service.createInvite('tenant-1', 'NURSE' as any, 'admin-user-1');

      expect(result).toMatchObject({ inviteToken: expect.any(String), expiresIn: '48h' });
      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringMatching(/^inv:/),
        expect.stringContaining('"tenantId":"tenant-1"'),
        48 * 60 * 60
      );
      // verifica que o payload serializado contém a role correta
      const setCall = (mockRedis.set as jest.Mock).mock.calls[0];
      const storedPayload = JSON.parse(setCall[1]);
      expect(storedPayload).toEqual({ tenantId: 'tenant-1', role: 'NURSE' });
    });

    it('deve lançar UnauthorizedException para tenant inexistente', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);

      await expect(
        service.createInvite('tenant-inexistente', 'NURSE' as any, 'admin-1')
      ).rejects.toThrow(UnauthorizedException);

      expect(mockRedis.set).not.toHaveBeenCalled();
    });
  });

  describe('updateProfile', () => {
    it('deve incluir tenantId no where do user.update para evitar cross-tenant', async () => {
      const hashedPassword = await bcrypt.hash('currentPass', 10);
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({
          id: 'user-1',
          tenantId: 'tenant-1',
          email: 'user@example.com',
          password: hashedPassword,
        })
        .mockResolvedValueOnce({
          id: 'user-1',
          email: 'user@example.com',
          tenantId: 'tenant-1',
          name: 'Novo Nome',
          role: 'NURSE',
        });
      mockPrisma.user.update.mockResolvedValue({ id: 'user-1' });

      await service.updateProfile('user-1', { name: 'Novo Nome' });

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'user-1',
            tenantId: 'tenant-1',
          }),
        })
      );
    });

    it('nao deve executar update para usuario de outro tenant', async () => {
      // Simula que user.findUnique retorna null (usuario nao pertence ao tenant)
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.updateProfile('user-other', { name: 'Hacker' })
      ).rejects.toThrow(UnauthorizedException);

      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('deve rejeitar mudanca de senha quando currentPassword esta incorreta', async () => {
      const hashedPassword = await bcrypt.hash('senhaCorreta', 10);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        tenantId: 'tenant-1',
        email: 'user@example.com',
        password: hashedPassword,
      });

      await expect(
        service.updateProfile('user-1', {
          currentPassword: 'senhaErrada',
          newPassword: 'novaSenha123',
        })
      ).rejects.toThrow(UnauthorizedException);

      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });
  });
});
