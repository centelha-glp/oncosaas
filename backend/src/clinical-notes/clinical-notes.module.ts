import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { ClinicalNotesService } from './clinical-notes.service';
import { ClinicalNoteOrdersService } from './clinical-note-orders.service';
import { ClinicalNoteSectionSuggestionService } from './clinical-note-section-suggestion.service';
import { ClinicalNotesController } from './clinical-notes.controller';
import { PatientClinicalNotesController } from './patient-clinical-notes.controller';
import { PatientClinicalNoteOrdersController } from './patient-clinical-note-orders.controller';
import { ExamIngestService } from './exam-ingest.service';
import { ExamIngestController } from './exam-ingest.controller';
import { PublicExamIngestController } from './public-exam-ingest.controller';
import { OncologyNavigationModule } from '../oncology-navigation/oncology-navigation.module';
import { ClinicalNoteExtractionModule } from '../clinical-note-extraction/clinical-note-extraction.module';

@Module({
  imports: [
    PrismaModule,
    AuditLogModule,
    OncologyNavigationModule,
    forwardRef(() => ClinicalNoteExtractionModule),
  ],
  controllers: [
    ClinicalNotesController,
    PatientClinicalNotesController,
    PatientClinicalNoteOrdersController,
    ExamIngestController,
    PublicExamIngestController,
  ],
  providers: [
    ClinicalNotesService,
    ClinicalNoteOrdersService,
    ClinicalNoteSectionSuggestionService,
    ExamIngestService,
  ],
  exports: [ClinicalNotesService, ClinicalNoteSectionSuggestionService],
})
export class ClinicalNotesModule {}
