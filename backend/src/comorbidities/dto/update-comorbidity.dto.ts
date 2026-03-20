import { PartialType } from '@nestjs/mapped-types';
import { CreateComorbidityDto } from './create-comorbidity.dto';

export class UpdateComorbidityDto extends PartialType(CreateComorbidityDto) {}
