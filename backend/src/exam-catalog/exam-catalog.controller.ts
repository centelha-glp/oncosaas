import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  DefaultValuePipe,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ExamCatalogService } from './exam-catalog.service';
import { ImportExamCatalogDto } from './dto/import-exam-catalog.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole, ComplementaryExamType } from '@generated/prisma/client';

@Controller('exam-catalog')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class ExamCatalogController {
  constructor(private readonly examCatalogService: ExamCatalogService) {}

  @Get()
  @Roles(
    UserRole.ADMIN,
    UserRole.ONCOLOGIST,
    UserRole.DOCTOR,
    UserRole.NURSE_CHIEF,
    UserRole.NURSE,
    UserRole.COORDINATOR,
  )
  search(
    @Query('q') q?: string,
    @Query('type') type?: ComplementaryExamType,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit?: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset?: number,
  ) {
    // Catálogo TUSS pode ter milhares de itens por tipo; leitura pontual, sem paginação no cliente ainda.
    const safeLimit = Math.min(Math.max(limit ?? 50, 1), 10_000);
    const safeOffset = Math.max(offset ?? 0, 0);
    return this.examCatalogService.search({
      q,
      type,
      limit: safeLimit,
      offset: safeOffset,
    });
  }

  @Post('import')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN)
  importCatalog(@Body() dto: ImportExamCatalogDto) {
    return this.examCatalogService.importBatch(dto.items, dto.sourceVersion);
  }
}
