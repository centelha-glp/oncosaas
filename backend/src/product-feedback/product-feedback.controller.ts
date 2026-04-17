import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { ProductFeedbackService } from './product-feedback.service';
import { CreateProductFeedbackDto } from './dto/create-product-feedback.dto';
import { QueryProductFeedbackDto } from './dto/query-product-feedback.dto';
import {
  CurrentUser,
  type CurrentUser as AuthUser,
} from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { ProductFeedback } from '@generated/prisma/client';
import { UserRole } from '@generated/prisma/client';
import type { ProductFeedbackListResult } from './product-feedback.service';

@Controller('product-feedback')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class ProductFeedbackController {
  constructor(private readonly productFeedbackService: ProductFeedbackService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() dto: CreateProductFeedbackDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request
  ): Promise<ProductFeedback> {
    const ua = req.headers['user-agent'];
    return this.productFeedbackService.create(
      dto,
      user.tenantId,
      user.id,
      typeof ua === 'string' ? ua : undefined
    );
  }

  @Get()
  @Roles(UserRole.ADMIN)
  findAll(
    @Query() query: QueryProductFeedbackDto,
    @CurrentUser() user: AuthUser
  ): Promise<ProductFeedbackListResult> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    return this.productFeedbackService.findAllForTenant(
      user.tenantId,
      page,
      limit
    );
  }
}
