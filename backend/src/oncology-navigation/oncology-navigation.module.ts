import { Module } from '@nestjs/common';
import { OncologyNavigationService } from './oncology-navigation.service';
import { OncologyNavigationController } from './oncology-navigation.controller';
import { OncologyNavigationScheduler } from './oncology-navigation.scheduler';
import { PriorityRecalculationService } from './priority-recalculation.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AlertsModule } from '../alerts/alerts.module';

@Module({
  imports: [PrismaModule, AlertsModule],
  controllers: [OncologyNavigationController],
  providers: [
    OncologyNavigationService,
    OncologyNavigationScheduler,
    PriorityRecalculationService,
  ],
  exports: [OncologyNavigationService, PriorityRecalculationService],
})
export class OncologyNavigationModule {}
