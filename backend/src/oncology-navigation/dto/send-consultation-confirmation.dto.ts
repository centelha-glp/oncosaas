import { IsOptional, IsString, MaxLength } from 'class-validator';
import { IsPlainText } from '../../common/validators/is-plain-text.decorator';

export class SendConsultationConfirmationDto {
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  @IsPlainText()
  message?: string;
}
