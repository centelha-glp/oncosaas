import { ConfigService } from '@nestjs/config';
import { S3StorageService } from './s3-storage.service';

const sendMock = jest.fn();
const getSignedUrlMock = jest.fn();

jest.mock('@aws-sdk/client-s3', () => {
  return {
    S3Client: jest.fn().mockImplementation(() => ({ send: sendMock })),
    PutObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
    DeleteObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
    GetObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
  };
});

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: (...args: unknown[]) => getSignedUrlMock(...args),
}));

describe('S3StorageService', () => {
  const makeConfigService = (overrides?: Record<string, string>): ConfigService => {
    const defaults: Record<string, string> = {
      AWS_REGION: 'us-east-1',
      S3_BUCKET_NAVIGATION_FILES: 'test-bucket',
      S3_PRESIGNED_URL_TTL_SECONDS: '300',
      ...(overrides || {}),
    };

    return {
      get: jest.fn((key: string) => defaults[key]),
    } as unknown as ConfigService;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uploads an object and returns stored metadata', async () => {
    sendMock.mockResolvedValueOnce({ ETag: 'etag-123' });
    const service = new S3StorageService(makeConfigService());

    const result = await service.putObject({
      tenantId: 'tenant-1',
      entityType: 'navigation-step',
      entityId: 'step-1',
      filename: 'exam result.pdf',
      contentType: 'application/pdf',
      buffer: Buffer.from('test'),
      size: 4,
    });

    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(result.bucket).toBe('test-bucket');
    expect(result.etag).toBe('etag-123');
    expect(result.key).toContain('tenants/tenant-1/navigation-steps/step-1/');
    expect(result.originalName).toBe('exam result.pdf');
  });

  it('generates presigned URL using configured TTL by default', async () => {
    getSignedUrlMock.mockResolvedValueOnce('https://signed-url');
    const service = new S3StorageService(makeConfigService({ S3_PRESIGNED_URL_TTL_SECONDS: '600' }));

    const url = await service.getPresignedDownloadUrl({
      bucket: 'test-bucket',
      key: 'tenants/tenant-1/navigation-steps/step-1/file.pdf',
      filename: 'file.pdf',
    });

    expect(getSignedUrlMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { expiresIn: 600 },
    );
    expect(url).toBe('https://signed-url');
  });

  it('deletes an object with bucket and key', async () => {
    sendMock.mockResolvedValueOnce({});
    const service = new S3StorageService(makeConfigService());

    await service.deleteObject({
      bucket: 'test-bucket',
      key: 'tenants/tenant-1/navigation-steps/step-1/file.pdf',
    });

    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        input: {
          Bucket: 'test-bucket',
          Key: 'tenants/tenant-1/navigation-steps/step-1/file.pdf',
        },
      }),
    );
  });
});
