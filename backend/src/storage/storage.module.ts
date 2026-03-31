import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { STORAGE_SERVICE } from './interfaces/storage-service.interface';
import { S3StorageService } from './services/s3-storage.service';

@Module({
  imports: [ConfigModule],
  providers: [
    S3StorageService,
    {
      provide: STORAGE_SERVICE,
      useExisting: S3StorageService,
    },
  ],
  exports: [STORAGE_SERVICE],
})
export class StorageModule {}
