import { IsString, MaxLength } from 'class-validator';

export class SuggestClinicalOrdersFromEvolutionDto {
  @IsString()
  @MaxLength(28000)
  contentMarkdown: string;
}
