import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { ClinicalNotesService } from './clinical-notes.service';
import { ClinicalNoteSectionSuggestionService } from './clinical-note-section-suggestion.service';
import { ClinicalNotesController } from './clinical-notes.controller';
import { PatientClinicalNotesController } from './patient-clinical-notes.controller';

@Module({
  imports: [PrismaModule, AuditLogModule],
  controllers: [ClinicalNotesController, PatientClinicalNotesController],
  providers: [ClinicalNotesService, ClinicalNoteSectionSuggestionService],
  exports: [ClinicalNotesService, ClinicalNoteSectionSuggestionService],
})
export class ClinicalNotesModule {}
