import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class ProcessEmbeddedSignupDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  /** URL exata da página (origin + pathname). Usada na troca de código com a Meta. */
  @IsString()
  @IsOptional()
  redirect_uri?: string;

  /** WABA ID capturado do evento WA_EMBEDDED_SIGNUP postMessage (mais confiável que busca via /me/businesses) */
  @IsString()
  @IsOptional()
  waba_id?: string;

  /** Phone Number ID capturado do evento WA_EMBEDDED_SIGNUP postMessage */
  @IsString()
  @IsOptional()
  phone_number_id?: string;
}
