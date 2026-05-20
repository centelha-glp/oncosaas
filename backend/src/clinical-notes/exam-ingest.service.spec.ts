import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  GatewayTimeoutException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ExamIngestService } from './exam-ingest.service';
import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ExamIngestService', () => {
  let service: ExamIngestService;
  const redis = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    rpush: jest.fn(),
    llen: jest.fn(),
    lrange: jest.fn(),
    ttl: jest.fn(),
  };
  const prisma = {
    patient: { findFirst: jest.fn() },
    clinicalNote: { findFirst: jest.fn() },
    $transaction: jest.fn(),
  };
  const config = {
    get: jest.fn((k: string) => {
      if (k === 'FRONTEND_URL') {return 'http://localhost:3000';}
      if (k === 'AI_SERVICE_URL') {return 'http://localhost:8001';}
      if (k === 'BACKEND_SERVICE_TOKEN') {return 'test-token';}
      return undefined;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExamIngestService,
        { provide: RedisService, useValue: redis },
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();
    service = module.get(ExamIngestService);
  });

  it('extract envia JSON ao ai-service e limpa Redis após sucesso', async () => {
    prisma.patient.findFirst.mockResolvedValue({ id: 'p1' });
    redis.get.mockResolvedValueOnce(
      JSON.stringify({
        tenantId: 't1',
        userId: 'u1',
        patientId: 'p1',
        createdAt: new Date().toISOString(),
        uploadToken: 'tokhex',
      })
    );
    redis.llen.mockResolvedValue(1);
    redis.lrange.mockResolvedValue([
      JSON.stringify({
        mimeType: 'image/png',
        dataBase64: Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString('base64'),
      }),
    ]);

    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          markdownSummary: '## OK',
          detectedCategories: ['LAB'],
          disclaimer: 'd',
          markdownFromStructuredParse: true,
        }),
    } as Response);

    const out = await service.extract('t1', 'u1', {
      patientId: 'p1',
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
    });

    expect(out).toMatchObject({
      markdownSummary: '## OK',
      markdownFromStructuredParse: true,
      complementaryExamsSavedCount: 0,
      complementaryExamResultSavedCount: 0,
      complementaryExamIds: [],
    });
    expect(fetchSpy).toHaveBeenCalled();
    const call = fetchSpy.mock.calls[0];
    expect(String(call[0])).toContain('/api/v1/exam-extract');
    const init = call[1] as RequestInit;
    expect(init.headers).toMatchObject(
      expect.objectContaining({
        'X-Tenant-Id': 't1',
        Authorization: 'Bearer test-token',
      })
    );
    expect(redis.del).toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('extract falha se utilizador não for dono da sessão', async () => {
    prisma.patient.findFirst.mockResolvedValue({ id: 'p1' });
    redis.get.mockResolvedValueOnce(
      JSON.stringify({
        tenantId: 't1',
        userId: 'outro',
        patientId: 'p1',
        createdAt: new Date().toISOString(),
        uploadToken: 'tokhex',
      })
    );
    redis.llen.mockResolvedValue(0);
    redis.lrange.mockResolvedValue([]);

    await expect(
      service.extract('t1', 'u1', {
        patientId: 'p1',
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('extract exige texto ou ficheiros', async () => {
    prisma.patient.findFirst.mockResolvedValue({ id: 'p1' });
    await expect(
      service.extract('t1', 'u1', { patientId: 'p1' })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('extract inclui vários ficheiros desktop no JSON ao ai-service', async () => {
    prisma.patient.findFirst.mockResolvedValue({ id: 'p1' });
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          markdownSummary: '## Multi',
          detectedCategories: ['LAB'],
          disclaimer: 'd',
          markdownFromStructuredParse: true,
        }),
    } as Response);

    await service.extract('t1', 'u1', {
      patientId: 'p1',
      plainText: 'nota',
      uploadedFiles: [
        { mimeType: 'image/png', buffer: Buffer.from('a') },
        { mimeType: 'image/jpeg', buffer: Buffer.from('bb') },
      ],
    });

    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(init.body as string) as {
      plainText: string | null;
      files: { mimeType: string; dataBase64: string }[];
    };
    expect(body.files).toHaveLength(2);
    expect(body.plainText).toBe('nota');
    fetchSpy.mockRestore();
  });

  it('extract aceita áudio webm no multipart e envia ao ai-service', async () => {
    prisma.patient.findFirst.mockResolvedValue({ id: 'p1' });
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          markdownSummary: '## Áudio',
          detectedCategories: ['OTHER'],
          disclaimer: 'd',
          markdownFromStructuredParse: true,
        }),
    } as Response);

    await service.extract('t1', 'u1', {
      patientId: 'p1',
      plainText: 'nota',
      uploadedFiles: [
        { mimeType: 'audio/webm;codecs=opus', buffer: Buffer.from([0x1a, 0x45]) },
      ],
    });

    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(init.body as string) as {
      files: { mimeType: string; dataBase64: string }[];
    };
    expect(body.files).toHaveLength(1);
    expect(body.files[0].mimeType).toBe('audio/webm;codecs=opus');
    fetchSpy.mockRestore();
  });

  it('extract rejeita mais de 10 ficheiros no total', async () => {
    prisma.patient.findFirst.mockResolvedValue({ id: 'p1' });
    const tooMany = Array.from({ length: 11 }, (_, i) => ({
      mimeType: 'image/png' as const,
      buffer: Buffer.from(String(i)),
    }));
    await expect(
      service.extract('t1', 'u1', { patientId: 'p1', uploadedFiles: tooMany })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('extract mapeia 503 do ai-service para ServiceUnavailableException', async () => {
    prisma.patient.findFirst.mockResolvedValue({ id: 'p1' });
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 503,
      text: async () =>
        JSON.stringify({
          detail: 'Transcrição de áudio indisponível: configure OPENAI_API_KEY no ai-service.',
        }),
    } as Response);

    await expect(
      service.extract('t1', 'u1', {
        patientId: 'p1',
        uploadedFiles: [{ mimeType: 'audio/webm', buffer: Buffer.from([1, 2]) }],
      })
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('extract mapeia corpo não-JSON do ai-service para BadGatewayException', async () => {
    prisma.patient.findFirst.mockResolvedValue({ id: 'p1' });
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => 'not json',
    } as Response);

    await expect(
      service.extract('t1', 'u1', {
        patientId: 'p1',
        plainText: 'x',
      })
    ).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('extract mapeia abort do fetch para GatewayTimeoutException', async () => {
    prisma.patient.findFirst.mockResolvedValue({ id: 'p1' });
    const abortErr = new Error('Aborted');
    abortErr.name = 'AbortError';
    jest.spyOn(global, 'fetch').mockRejectedValue(abortErr);

    await expect(
      service.extract('t1', 'u1', {
        patientId: 'p1',
        plainText: 'x',
      })
    ).rejects.toBeInstanceOf(GatewayTimeoutException);
  });

  it('extract persiste complementaryExams com collectionId quando o ai-service devolve itens', async () => {
    prisma.patient.findFirst.mockResolvedValue({ id: 'p1' });
    const examCreate = jest.fn().mockResolvedValue({ id: 'exam-1' });
    const resCreate = jest.fn().mockResolvedValue({ id: 'res-1' });
    prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        complementaryExam: {
          findMany: jest.fn().mockResolvedValue([]),
          create: examCreate,
        },
        complementaryExamResult: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: resCreate,
          update: jest.fn(),
        },
      })
    );

    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          markdownSummary: '## Lab',
          detectedCategories: ['LAB'],
          disclaimer: 'd',
          markdownFromStructuredParse: true,
          complementaryExams: [
            {
              type: 'LABORATORY',
              name: 'Hemoglobina',
              code: 'Hb',
              result: {
                performedAt: '2025-06-01',
                valueNumeric: 12.1,
                unit: 'g/dL',
              },
            },
          ],
        }),
    } as Response);

    const out = await service.extract('t1', 'u1', {
      patientId: 'p1',
      plainText: 'x',
    });

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(examCreate).toHaveBeenCalled();
    expect(resCreate).toHaveBeenCalled();
    const resData = (resCreate.mock.calls[0][0] as { data: { collectionId?: string } })
      .data;
    expect(typeof resData.collectionId).toBe('string');
    expect(resData.collectionId).toBe(out.collectionId);
    expect(out.complementaryExamsSavedCount).toBe(1);
    expect(out.complementaryExamResultSavedCount).toBe(1);
    expect(out.complementaryExamIds).toEqual(['exam-1']);
    fetchSpy.mockRestore();
  });

  it('extract rejeita resposta do ai-service sem markdownFromStructuredParse true', async () => {
    prisma.patient.findFirst.mockResolvedValue({ id: 'p1' });
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          markdownSummary: '## X',
          detectedCategories: ['LAB'],
          disclaimer: 'd',
        }),
    } as Response);

    await expect(
      service.extract('t1', 'u1', {
        patientId: 'p1',
        plainText: 'x',
      })
    ).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('extract rejeita extractionSource mock em ambiente de produção', async () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    delete process.env.AI_ALLOW_MOCK_RESPONSES;
    prisma.patient.findFirst.mockResolvedValue({ id: 'p1' });
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          markdownSummary: '## Mock',
          detectedCategories: ['LAB'],
          disclaimer: 'd',
          markdownFromStructuredParse: true,
          extractionSource: 'mock',
        }),
    } as Response);

    await expect(
      service.extract('t1', 'u1', {
        patientId: 'p1',
        plainText: 'x',
      })
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    process.env.NODE_ENV = prev;
  });

  it('extract rejeita markdownSummary vazio mesmo com flag estruturada', async () => {
    prisma.patient.findFirst.mockResolvedValue({ id: 'p1' });
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          markdownSummary: '   ',
          detectedCategories: ['LAB'],
          disclaimer: 'd',
          markdownFromStructuredParse: true,
        }),
    } as Response);

    await expect(
      service.extract('t1', 'u1', {
        patientId: 'p1',
        plainText: 'x',
      })
    ).rejects.toBeInstanceOf(BadGatewayException);
  });
});
