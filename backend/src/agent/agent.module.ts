import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { GatewaysModule } from '../gateways/gateways.module';
import { ChannelGatewayModule } from '../channel-gateway/channel-gateway.module';
import { OncologyNavigationModule } from '../oncology-navigation/oncology-navigation.module';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { ConversationService } from './conversation.service';
import { DecisionGateService } from './decision-gate.service';
import { AgentSchedulerService } from './agent-scheduler.service';

@Module({
  imports: [
    PrismaModule,
    GatewaysModule,
    forwardRef(() => ChannelGatewayModule),
    OncologyNavigationModule,
  ],
  controllers: [AgentController],
  providers: [
    AgentService,
    ConversationService,
    DecisionGateService,
    AgentSchedulerService,
  ],
  exports: [AgentService, ConversationService],
})
export class AgentModule {}
