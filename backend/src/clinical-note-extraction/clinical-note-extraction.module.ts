import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { ClinicalNotesModule } from '../clinical-notes/clinical-notes.module';
import { CLINICAL_NOTE_EXTRACTION_QUEUE } from './clinical-note-extraction.constants';
import { ClinicalNoteExtractionProcessor } from './clinical-note-extraction.processor';
import { EvolutionStructuringService } from './evolution-structuring.service';
import { ClinicalNoteExtractionService } from './clinical-note-extraction.service';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    forwardRef(() => ClinicalNotesModule),
    BullModule.registerQueue({ name: CLINICAL_NOTE_EXTRACTION_QUEUE }),
  ],
  providers: [
    EvolutionStructuringService,
    ClinicalNoteExtractionProcessor,
    ClinicalNoteExtractionService,
  ],
  exports: [
    ClinicalNoteExtractionService,
    EvolutionStructuringService,
    BullModule.registerQueue({ name: CLINICAL_NOTE_EXTRACTION_QUEUE }),
  ],
})
export class ClinicalNoteExtractionModule {}
