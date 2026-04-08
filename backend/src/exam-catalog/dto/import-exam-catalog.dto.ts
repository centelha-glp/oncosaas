import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { ComplementaryExamType } from '@generated/prisma/client';

export class ImportExamCatalogItemDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(ComplementaryExamType)
  type: ComplementaryExamType;

  @IsString()
  @IsOptional()
  rolItemCode?: string;

  @IsString()
  @IsOptional()
  specimenDefault?: string;

  @IsString()
  @IsOptional()
  unit?: string;

  @IsString()
  @IsOptional()
  referenceRange?: string;
}

export class ImportExamCatalogDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportExamCatalogItemDto)
  items: ImportExamCatalogItemDto[];

  @IsString()
  @IsOptional()
  sourceVersion?: string;
}
