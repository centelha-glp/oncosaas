import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class RegisterInstitutionDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  institutionName: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  name: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;
}
