export interface PutObjectInput {
  tenantId: string;
  entityType: string;
  entityId: string;
  filename: string;
  contentType: string;
  buffer: Buffer;
  size: number;
}

export interface StoredObject {
  bucket: string;
  key: string;
  etag?: string;
  size: number;
  contentType: string;
  originalName: string;
}

export interface GetPresignedDownloadUrlInput {
  bucket: string;
  key: string;
  filename?: string;
  expiresInSeconds?: number;
}

export interface DeleteObjectInput {
  bucket: string;
  key: string;
}

export interface StorageService {
  putObject(input: PutObjectInput): Promise<StoredObject>;
  getPresignedDownloadUrl(
    input: GetPresignedDownloadUrlInput
  ): Promise<string>;
  deleteObject(input: DeleteObjectInput): Promise<void>;
}

export const STORAGE_SERVICE = Symbol('STORAGE_SERVICE');
