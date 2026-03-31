import { INestApplication, CanActivate, ExecutionContext } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AddressInfo } from 'node:net';
import { OncologyNavigationController } from '../src/oncology-navigation/oncology-navigation.controller';
import { OncologyNavigationService } from '../src/oncology-navigation/oncology-navigation.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { TenantGuard } from '../src/auth/guards/tenant.guard';
import { RolesGuard } from '../src/auth/guards/roles.guard';
import { STORAGE_SERVICE } from '../src/storage/interfaces/storage-service.interface';

class AllowGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    req.user = {
      id: '11111111-1111-4111-8111-111111111111',
      tenantId: '22222222-2222-4222-8222-222222222222',
      role: 'ADMIN',
    };
    return true;
  }
}

describe('Oncology Navigation Files (e2e)', () => {
  let app: INestApplication;
  let baseUrl: string;

  const mockNavigationService = {
    getStepById: jest.fn(),
    createStepFile: jest.fn(),
    listStepFiles: jest.fn(),
    getStepFileById: jest.fn(),
  };

  const mockStorageService = {
    putObject: jest.fn(),
    getPresignedDownloadUrl: jest.fn(),
    deleteObject: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [OncologyNavigationController],
      providers: [
        {
          provide: OncologyNavigationService,
          useValue: mockNavigationService,
        },
        {
          provide: STORAGE_SERVICE,
          useValue: mockStorageService,
        },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'S3_PRESIGNED_URL_TTL_SECONDS') {
                return '300';
              }
              return undefined;
            },
          },
        },
        { provide: JwtAuthGuard, useClass: AllowGuard },
        { provide: TenantGuard, useClass: AllowGuard },
        { provide: RolesGuard, useClass: AllowGuard },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.listen(0);

    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it('uploads file, stores in S3 and persists step file record', async () => {
    const stepId = '33333333-3333-4333-8333-333333333333';

    mockNavigationService.getStepById.mockResolvedValue({ id: stepId });
    mockStorageService.putObject.mockResolvedValue({
      bucket: 'bucket-a',
      key: 'tenants/222/navigation-steps/333/file.pdf',
      etag: 'etag-1',
      size: 4,
      contentType: 'application/pdf',
      originalName: 'report.pdf',
    });
    mockNavigationService.createStepFile.mockResolvedValue({
      id: '44444444-4444-4444-8444-444444444444',
      originalName: 'report.pdf',
      contentType: 'application/pdf',
      size: 4,
      uploadedBy: '11111111-1111-4111-8111-111111111111',
      createdAt: new Date('2026-03-25T12:00:00.000Z'),
    });

    const form = new FormData();
    form.append('file', new Blob(['test'], { type: 'application/pdf' }), 'report.pdf');

    const response = await fetch(
      `${baseUrl}/api/v1/oncology-navigation/steps/${stepId}/upload`,
      {
        method: 'POST',
        body: form,
      },
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toMatchObject({
      id: '44444444-4444-4444-8444-444444444444',
      originalName: 'report.pdf',
      contentType: 'application/pdf',
      size: 4,
    });

    expect(mockStorageService.putObject).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: '22222222-2222-4222-8222-222222222222',
        entityType: 'navigation-step',
        entityId: stepId,
        filename: 'report.pdf',
        contentType: 'application/pdf',
      }),
    );

    expect(mockNavigationService.createStepFile).toHaveBeenCalledWith(
      stepId,
      expect.objectContaining({
        bucket: 'bucket-a',
        objectKey: 'tenants/222/navigation-steps/333/file.pdf',
      }),
      '22222222-2222-4222-8222-222222222222',
    );
  });

  it('lists step files without exposing bucket/object key', async () => {
    const stepId = '33333333-3333-4333-8333-333333333333';

    mockNavigationService.listStepFiles.mockResolvedValue([
      {
        id: '44444444-4444-4444-8444-444444444444',
        originalName: 'report.pdf',
        contentType: 'application/pdf',
        size: 4,
        uploadedBy: '11111111-1111-4111-8111-111111111111',
        createdAt: new Date('2026-03-25T12:00:00.000Z'),
        bucket: 'bucket-a',
        objectKey: 'sensitive/key',
      },
    ]);

    const response = await fetch(
      `${baseUrl}/api/v1/oncology-navigation/steps/${stepId}/files`,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual([
      expect.objectContaining({
        id: '44444444-4444-4444-8444-444444444444',
        originalName: 'report.pdf',
      }),
    ]);
    expect(JSON.stringify(body)).not.toContain('bucket-a');
    expect(JSON.stringify(body)).not.toContain('sensitive/key');
  });

  it('returns presigned url for step file', async () => {
    const stepId = '33333333-3333-4333-8333-333333333333';
    const fileId = '44444444-4444-4444-8444-444444444444';

    mockNavigationService.getStepFileById.mockResolvedValue({
      id: fileId,
      bucket: 'bucket-a',
      objectKey: 'tenants/222/navigation-steps/333/report.pdf',
      originalName: 'report.pdf',
    });
    mockStorageService.getPresignedDownloadUrl.mockResolvedValue('https://signed-url');

    const response = await fetch(
      `${baseUrl}/api/v1/oncology-navigation/steps/${stepId}/files/${fileId}/presigned-url`,
      { method: 'POST' },
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toEqual({
      fileId,
      url: 'https://signed-url',
      expiresIn: 300,
    });

    expect(mockStorageService.getPresignedDownloadUrl).toHaveBeenCalledWith({
      bucket: 'bucket-a',
      key: 'tenants/222/navigation-steps/333/report.pdf',
      filename: 'report.pdf',
      expiresInSeconds: 300,
    });
  });
});
