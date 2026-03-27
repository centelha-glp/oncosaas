import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsUrl,
  Matches,
} from 'class-validator';
import { WhatsAppAuthMethod } from '@prisma/client';

export class CreateWhatsAppConnectionDto {
  @IsString()
  name: string;

  @IsString()
  @Matches(/^\+[1-9]\d{1,14}$/, {
    message:
      'Phone number must be in international format (e.g., +5511999999999)',
  })
  phoneNumber: string;

  @IsEnum(WhatsAppAuthMethod)
  authMethod: WhatsAppAuthMethod;

  // Campos para OAuth (serão preenchidos automaticamente)
  @IsOptional()
  @IsString()
  phoneNumberId?: string;

  @IsOptional()
  @IsString()
  whatsappBusinessAccountId?: string;

  @IsOptional()
  @IsString()
  businessAccountId?: string;

  // Campos para configuração manual
  @IsOptional()
  @IsString()
  apiToken?: string;

  @IsOptional()
  @IsString()
  appId?: string;

  @IsOptional()
  @IsString()
  appSecret?: string;

  @IsOptional()
  @IsUrl()
  webhookUrl?: string;

  @IsOptional()
  @IsString()
  webhookVerifyToken?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
