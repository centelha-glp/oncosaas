import { Injectable } from '@nestjs/common';
import type { ProductFeedback, User } from '@generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductFeedbackDto } from './dto/create-product-feedback.dto';

export type ProductFeedbackWithAuthor = ProductFeedback & {
  user: Pick<User, 'id' | 'name' | 'email'>;
};

export type ProductFeedbackListResult = {
  data: ProductFeedbackWithAuthor[];
  total: number;
  page: number;
  limit: number;
};

@Injectable()
export class ProductFeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    dto: CreateProductFeedbackDto,
    tenantId: string,
    userId: string,
    headerUserAgent?: string
  ): Promise<ProductFeedback> {
    return this.prisma.productFeedback.create({
      data: {
        tenantId,
        userId,
        type: dto.type,
        title: dto.title,
        description: dto.description,
        pageUrl: dto.pageUrl ?? null,
        userAgent: headerUserAgent ?? null,
      },
    });
  }

  async findAllForTenant(
    tenantId: string,
    page = 1,
    limit = 20
  ): Promise<ProductFeedbackListResult> {
    const take = Math.min(Math.max(limit, 1), 100);
    const skip = (Math.max(page, 1) - 1) * take;

    const [data, total] = await Promise.all([
      this.prisma.productFeedback.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      this.prisma.productFeedback.count({ where: { tenantId } }),
    ]);

    return {
      data,
      total,
      page: Math.max(page, 1),
      limit: take,
    };
  }
}
