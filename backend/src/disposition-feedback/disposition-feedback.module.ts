import { Module } from '@nestjs/common';
import { DispositionFeedbackService } from './disposition-feedback.service';
import { DispositionFeedbackController } from './disposition-feedback.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [DispositionFeedbackController],
  providers: [DispositionFeedbackService],
  exports: [DispositionFeedbackService],
})
export class DispositionFeedbackModule {}
