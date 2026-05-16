import {
  BadRequestException,
  Controller,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { memoryStorage } from 'multer';
import { FileInterceptor } from '@nestjs/platform-express';
import { Public } from '../auth/decorators/public.decorator';
import { ExamIngestService } from './exam-ingest.service';
import {
  EXAM_INGEST_MAX_FILE_BYTES,
  isExamIngestMimeAllowed,
} from './exam-ingest.constants';

function assertUploadToken(token: string): void {
  if (!/^[a-f0-9]{64}$/i.test(token)) {
    throw new BadRequestException('Token inválido');
  }
}

@Controller('public/exam-ingest')
export class PublicExamIngestController {
  constructor(private readonly examIngest: ExamIngestService) {}

  @Post(':token')
  @Public()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: EXAM_INGEST_MAX_FILE_BYTES },
      fileFilter: (_req, file, cb) => {
        if (isExamIngestMimeAllowed(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException('Tipo de ficheiro não permitido'),
            false
          );
        }
      },
    })
  )
  async uploadByToken(
    @Param('token') token: string,
    @UploadedFile() file: Express.Multer.File | undefined
  ) {
    assertUploadToken(token);
    if (!file?.buffer) {
      throw new BadRequestException('Ficheiro em falta');
    }
    return this.examIngest.appendFileByUploadToken(
      token,
      file.mimetype,
      file.buffer
    );
  }
}
