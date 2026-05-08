import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ClinicalNotesModule } from '../clinical-notes/clinical-notes.module';
import { TissGuidesController } from './tiss-guides.controller';
import { TissGuidesService } from './tiss-guides.service';

@Module({
  imports: [PrismaModule, ClinicalNotesModule],
  controllers: [TissGuidesController],
  providers: [TissGuidesService],
})
export class TissGuidesModule {}

