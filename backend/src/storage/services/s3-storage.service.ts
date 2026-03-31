import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  StorageService,
  PutObjectInput,
  StoredObject,
  GetPresignedDownloadUrlInput,
  DeleteObjectInput,
} from '../interfaces/storage-service.interface';

@Injectable()
export class S3StorageService implements StorageService {
  private readonly client: S3Client;
  private readonly defaultBucket: string;
  private readonly defaultPresignedTtl: number;

  constructor(private readonly configService: ConfigService) {
    const region = this.configService.get<string>('AWS_REGION');
    if (!region) {
      throw new InternalServerErrorException('Missing AWS_REGION configuration');
    }

    const bucket = this.configService.get<string>('S3_BUCKET_NAVIGATION_FILES');
    if (!bucket) {
      throw new InternalServerErrorException(
        'Missing S3_BUCKET_NAVIGATION_FILES configuration'
      );
    }

    this.defaultBucket = bucket;

    const rawTtl = this.configService.get<string>('S3_PRESIGNED_URL_TTL_SECONDS');
    const parsedTtl = rawTtl ? Number(rawTtl) : 300;
    this.defaultPresignedTtl = Number.isFinite(parsedTtl) && parsedTtl > 0 ? parsedTtl : 300;

    this.client = new S3Client({
      region,
    });
  }

  async putObject(input: PutObjectInput): Promise<StoredObject> {
    const key = this.buildObjectKey(
      input.tenantId,
      input.entityType,
      input.entityId,
      input.filename
    );

    const putCommand = new PutObjectCommand({
      Bucket: this.defaultBucket,
      Key: key,
      Body: input.buffer,
      ContentType: input.contentType,
      ContentLength: input.size,
    });

    const result = await this.client.send(putCommand);

    return {
      bucket: this.defaultBucket,
      key,
      etag: result.ETag,
      size: input.size,
      contentType: input.contentType,
      originalName: input.filename,
    };
  }

  async getPresignedDownloadUrl(
    input: GetPresignedDownloadUrlInput
  ): Promise<string> {
    const expiresIn = input.expiresInSeconds || this.defaultPresignedTtl;

    const getCommand = new GetObjectCommand({
      Bucket: input.bucket,
      Key: input.key,
      ResponseContentDisposition: input.filename
        ? `attachment; filename="${this.sanitizeFilename(input.filename)}"`
        : undefined,
    });

    return getSignedUrl(this.client, getCommand, { expiresIn });
  }

  async deleteObject(input: DeleteObjectInput): Promise<void> {
    const deleteCommand = new DeleteObjectCommand({
      Bucket: input.bucket,
      Key: input.key,
    });

    await this.client.send(deleteCommand);
  }

  private buildObjectKey(
    tenantId: string,
    entityType: string,
    stepId: string,
    originalName: string
  ): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).slice(2, 10);
    const safeName = this.sanitizeFilename(originalName);

    return `tenants/${tenantId}/${entityType}s/${stepId}/${timestamp}-${random}-${safeName}`;
  }

  private sanitizeFilename(filename: string): string {
    return filename
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 150);
  }
}
