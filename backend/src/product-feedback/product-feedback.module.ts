import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ProductFeedbackController } from './product-feedback.controller';
import { ProductFeedbackService } from './product-feedback.service';

@Module({
  imports: [PrismaModule],
  controllers: [ProductFeedbackController],
  providers: [ProductFeedbackService],
  exports: [ProductFeedbackService],
})
export class ProductFeedbackModule {}
