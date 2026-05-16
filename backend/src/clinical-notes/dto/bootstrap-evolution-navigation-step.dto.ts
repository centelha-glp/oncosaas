import { IsEnum } from 'class-validator';
import { ClinicalNoteType } from '@generated/prisma/client';

export class BootstrapEvolutionNavigationStepDto {
  @IsEnum(ClinicalNoteType)
  noteType: ClinicalNoteType;
}
