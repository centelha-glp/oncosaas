import { PartialType } from '@nestjs/mapped-types';
import { CreateComplementaryExamDto } from './create-complementary-exam.dto';

export class UpdateComplementaryExamDto extends PartialType(
  CreateComplementaryExamDto,
) {}
