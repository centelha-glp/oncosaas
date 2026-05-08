import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateClinicalExamRequestDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  displayName: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  loincCode?: string;

  /** Código do catálogo global TUSS (ExamCatalogItem.code), quando selecionado por catálogo. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  examCatalogCode?: string;
}
