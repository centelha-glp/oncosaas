import { Module, forwardRef } from '@nestjs/common';
import { OncologyNavigationService } from './oncology-navigation.service';
import { ConsultationAgendaAvailabilityService } from './consultation-agenda-availability.service';
import { OncologyNavigationController } from './oncology-navigation.controller';
import { OncologyNavigationScheduler } from './oncology-navigation.scheduler';
import { PriorityRecalculationService } from './priority-recalculation.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AlertsModule } from '../alerts/alerts.module';
import { ChannelGatewayModule } from '../channel-gateway/channel-gateway.module';

@Module({
  imports: [PrismaModule, AlertsModule, forwardRef(() => ChannelGatewayModule)],
  controllers: [OncologyNavigationController],
  providers: [
    ConsultationAgendaAvailabilityService,
    OncologyNavigationService,
    OncologyNavigationScheduler,
    PriorityRecalculationService,
  ],
  exports: [OncologyNavigationService, PriorityRecalculationService],
})
export class OncologyNavigationModule {}