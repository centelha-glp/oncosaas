import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ComplementaryExamType, Prisma } from '@generated/prisma/client';
import { ImportExamCatalogItemDto } from './dto/import-exam-catalog.dto';

@Injectable()
export class ExamCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async search(params: {
    q?: string;
    type?: ComplementaryExamType;
    limit: number;
    offset: number;
  }) {
    const { q, type, limit, offset } = params;
    const where: Prisma.ExamCatalogItemWhereInput = {};
    if (type) {
      where.type = type;
    }
    const trimmed = q?.trim();
    if (trimmed) {
      where.OR = [
        { name: { contains: trimmed, mode: 'insensitive' } },
        { code: { contains: trimmed, mode: 'insensitive' } },
        { rolItemCode: { contains: trimmed, mode: 'insensitive' } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.examCatalogItem.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: [{ name: 'asc' }],
      }),
      this.prisma.examCatalogItem.count({ where }),
    ]);
    return { items, total, limit, offset };
  }

  async importBatch(
    items: ImportExamCatalogItemDto[],
    sourceVersion?: string,
  ) {
    let upserted = 0;
    for (const row of items) {
      await this.prisma.examCatalogItem.upsert({
        where: { code: row.code },
        create: {
          code: row.code,
          name: row.name,
          type: row.type,
          rolItemCode: row.rolItemCode ?? null,
          specimenDefault: row.specimenDefault ?? null,
          unit: row.unit ?? null,
          referenceRange: row.referenceRange ?? null,
          sourceVersion: sourceVersion ?? null,
        },
        update: {
          name: row.name,
          type: row.type,
          rolItemCode: row.rolItemCode ?? null,
          specimenDefault: row.specimenDefault ?? null,
          unit: row.unit ?? null,
          referenceRange: row.referenceRange ?? null,
          ...(sourceVersion !== undefined ? { sourceVersion } : {}),
        },
      });
      upserted++;
    }
    return { upserted, sourceVersion: sourceVersion ?? null };
  }
}
