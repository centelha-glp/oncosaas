import { PartialType } from '@nestjs/mapped-types';
import { CreateComplementaryExamResultDto } from './create-complementary-exam-result.dto';

export class UpdateComplementaryExamResultDto extends PartialType(
  CreateComplementaryExamResultDto,
) {}
