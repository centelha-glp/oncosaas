import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '@/prisma/prisma.service';
import { RedisService } from '@/redis/redis.service';

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
  });

  describe('validateUser', () => {
    it('should throw ForbiddenException when account is locked', async () => {
      mockRedis.get.mockResolvedValueOnce('1'); // locked key exists

      await expect(
        service.validateUser('test@example.com', 'password', 'tenant-1')
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw UnauthorizedException when tenantId is missing', async () => {
      mockRedis.get.mockResolvedValue(null); // not locked

      await expect(
        service.validateUser('test@example.com', 'password')
      ).rejects.toThrow(UnauthorizedException);
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
  });
});
