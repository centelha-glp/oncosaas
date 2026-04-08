import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ExamCatalogController } from './exam-catalog.controller';
import { ExamCatalogService } from './exam-catalog.service';

@Module({
  imports: [PrismaModule],
  controllers: [ExamCatalogController],
  providers: [ExamCatalogService],
  exports: [ExamCatalogService],
})
export class ExamCatalogModule {}
