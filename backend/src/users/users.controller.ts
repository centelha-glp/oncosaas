import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { TenantGuard } from '@/auth/guards/tenant.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { Roles } from '@/auth/decorators/roles.decorator';
import { UserRole } from '@generated/prisma/client';

@Controller('users')
@UseGuards(JwtAuthGuard, TenantGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.NURSE_CHIEF, UserRole.COORDINATOR)
  async findAll(@Request() req) {
    return this.usersService.findAll(req.user.tenantId);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.NURSE_CHIEF, UserRole.COORDINATOR)
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.usersService.findOne(id, req.user.tenantId);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.NURSE_CHIEF)
  async create(@Body() createUserDto: CreateUserDto, @Request() req) {
    return this.usersService.create(
      createUserDto,
      req.user.tenantId,
      req.user.role
    );
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.NURSE_CHIEF)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
    @Request() req
  ) {
    return this.usersService.update(
      id,
      updateUserDto,
      req.user.tenantId,
      req.user.role
    );
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async remove(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.usersService.remove(id, req.user.tenantId);
  }
}
