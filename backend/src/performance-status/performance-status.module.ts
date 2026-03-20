import { Module } from '@nestjs/common';
import { PerformanceStatusService } from './performance-status.service';
import { PerformanceStatusController } from './performance-status.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PerformanceStatusController],
  providers: [PerformanceStatusService],
  exports: [PerformanceStatusService],
})
export class PerformanceStatusModule {}
