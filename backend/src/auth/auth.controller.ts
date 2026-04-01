import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  HttpCode,
  HttpStatus,
  Headers,
  UnauthorizedException,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  IsString,
  IsNotEmpty,
  IsEmail,
  MinLength,
  IsOptional,
  IsArray,
  ArrayMinSize,
} from 'class-validator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RegisterInstitutionDto } from './dto/register-institution.dto';
import { Public } from './decorators/public.decorator';
import { Roles } from './decorators/roles.decorator';
import { RolesGuard } from './guards/roles.guard';
import { UserRole } from '@generated/prisma/client';

class RefreshDto {
  @IsString()
  @IsNotEmpty()
  refresh_token: string;
}

class ForgotPasswordDto {
  @IsEmail()
  email: string;
}

class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @MinLength(6)
  password: string;
}

class UpdateTenantSettingsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  enabledCancerTypes: string[];
}

class UpdateProfileDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  currentPassword?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  newPassword?: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
    @Headers('x-tenant-id') headerTenantId?: string
  ) {
    const tenantId = loginDto.tenantId || headerTenantId;
    return this.authService.login(loginDto, tenantId);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() body: RefreshDto) {
    if (!body.refresh_token) {
      throw new UnauthorizedException('refresh_token é obrigatório');
    }
    return this.authService.refresh(body.refresh_token);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() body: Partial<RefreshDto>) {
    await this.authService.logout(body.refresh_token || '');
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() body: ForgotPasswordDto) {
    await this.authService.forgotPassword(body.email);
    return {
      message: 'Se o email existir, você receberá um link de redefinição.',
    };
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() body: ResetPasswordDto) {
    await this.authService.resetPassword(body.token, body.password);
    return { message: 'Senha redefinida com sucesso.' };
  }

  @Get('profile')
  async getProfile(@Request() req) {
    return this.authService.getProfile(req.user?.id ?? req.user?.sub);
  }

  @Patch('profile')
  async updateProfile(@Body() body: UpdateProfileDto, @Request() req) {
    return this.authService.updateProfile(req.user?.id ?? req.user?.sub, body);
  }

  @Patch('tenant-settings')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.ONCOLOGIST, UserRole.NURSE_CHIEF, UserRole.COORDINATOR)
  async updateTenantSettings(
    @Body() body: UpdateTenantSettingsDto,
    @Request() req,
  ) {
    return this.authService.updateTenantSettings(
      req.user?.tenantId,
      body.enabledCancerTypes,
    );
  }

  @Public()
  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Public()
  @Post('register-institution')
  @HttpCode(HttpStatus.CREATED)
  async registerInstitution(@Body() dto: RegisterInstitutionDto) {
    return this.authService.registerInstitution(dto);
  }
}
