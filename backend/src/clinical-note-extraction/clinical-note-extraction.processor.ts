import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { CLINICAL_NOTE_EXTRACTION_QUEUE } from './clinical-note-extraction.constants';
import type { ClinicalNoteExtractionJobPayload } from './clinical-note-extraction.types';
import { EvolutionStructuringService } from './evolution-structuring.service';

@Processor(CLINICAL_NOTE_EXTRACTION_QUEUE)
export class ClinicalNoteExtractionProcessor extends WorkerHost {
  private readonly logger = new Logger(ClinicalNoteExtractionProcessor.name);

  constructor(
    private readonly evolutionStructuringService: EvolutionStructuringService
  ) {
    super();
  }

  override async process(
    job: Job<ClinicalNoteExtractionJobPayload>
  ): Promise<void> {
    try {
      await this.evolutionStructuringService.runFromJob(job.data);
    } catch (e) {
      this.logger.error(
        `Job clinical-note-extraction failed id=${job.id}`,
        e instanceof Error ? e.stack : String(e)
      );
      throw e;
    }
  }
}
