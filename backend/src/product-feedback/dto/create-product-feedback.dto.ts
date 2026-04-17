import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ProductFeedbackType } from '@generated/prisma/client';

export class CreateProductFeedbackDto {
  @IsEnum(ProductFeedbackType)
  type: ProductFeedbackType;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(200)
  title: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(8000)
  description: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  pageUrl?: string;
}
