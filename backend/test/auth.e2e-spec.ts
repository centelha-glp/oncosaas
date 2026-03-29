import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';

/**
 * E2E tests for auth endpoints.
 * PrismaService and RedisService are overridden with in-memory mocks
 * so no real database or Redis is required.
 */

const TENANT_ID = 'e2e-tenant-1';

let hashedPassword: string;

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockPrisma = {
  user: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  tenant: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  auditLog: {
    create: jest.fn(),
  },
};

const mockRedis = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  increment: jest.fn().mockResolvedValue(1),
  client: {
    multi: jest.fn().mockReturnValue({
      incr: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([1, 1]),
    }),
  },
};

describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    hashedPassword = await bcrypt.hash('senha123', 10);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .overrideProvider(RedisService)
      .useValue(mockRedis)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockRedis.get.mockResolvedValue(null); // não bloqueado por padrão
  });

  // ─── POST /auth/login ────────────────────────────────────────────────────────

  describe('POST /auth/login', () => {
    it('deve retornar 200 com access_token e refresh_token em login válido', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        email: 'nurse@example.com',
        password: hashedPassword,
        name: 'Test Nurse',
        role: 'NURSE',
        mfaEnabled: false,
        tenantId: TENANT_ID,
        tenant: { id: TENANT_ID, name: 'Hospital Teste' },
      });
      mockRedis.del.mockResolvedValue(1);
      mockRedis.set.mockResolvedValue('OK');

      const { status, body } = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'nurse@example.com', password: 'senha123', tenantId: TENANT_ID });

      expect(status).toBe(200);
      expect(body).toHaveProperty('access_token');
      expect(body).toHaveProperty('refresh_token');
      expect(body.user.email).toBe('nurse@example.com');
      expect(body.user).not.toHaveProperty('password');
    });

    it('deve retornar 401 para credenciais inválidas', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      const { status } = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'wrong@example.com', password: 'wrongpass', tenantId: TENANT_ID });

      expect(status).toBe(401);
    });

    it('deve retornar 403 quando conta está bloqueada', async () => {
      mockRedis.get.mockResolvedValue('1'); // conta bloqueada

      const { status } = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'locked@example.com', password: 'qualquer', tenantId: TENANT_ID });

      expect(status).toBe(403);
    });

    it('deve retornar 400 quando email não fornecido', async () => {
      const { status } = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ password: 'senha123' });

      expect(status).toBe(400);
    });

    it('deve retornar 400 quando password não fornecido', async () => {
      const { status } = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'test@example.com' });

      expect(status).toBe(400);
    });
  });

  // ─── POST /auth/forgot-password ──────────────────────────────────────────────

  describe('POST /auth/forgot-password', () => {
    it('deve retornar 200 mesmo quando email não existe (sem enumeração)', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      const { status } = await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: 'naoexiste@example.com' });

      expect(status).toBe(200);
    });

    it('deve armazenar token no Redis quando usuário existe', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'user-1', email: 'admin@example.com' });
      mockRedis.set.mockResolvedValue('OK');

      await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: 'admin@example.com' });

      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringMatching(/^prt:/),
        'user-1',
        3600
      );
    });
  });

  // ─── POST /auth/refresh ──────────────────────────────────────────────────────

  describe('POST /auth/refresh', () => {
    it('deve retornar 401 para refresh_token inválido', async () => {
      mockRedis.get.mockResolvedValue(null); // token não encontrado no Redis

      const { status } = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refresh_token: 'invalid-token' });

      expect(status).toBe(401);
    });

    it('deve retornar 400 quando refresh_token não fornecido', async () => {
      const { status } = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({});

      expect(status).toBe(400);
    });
  });
});
