import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { GatewaysModule } from '../gateways/gateways.module';
import { ChannelGatewayModule } from '../channel-gateway/channel-gateway.module';
import { OncologyNavigationModule } from '../oncology-navigation/oncology-navigation.module';
import { PatientsModule } from '../patients/patients.module';
import { ClinicalProtocolsModule } from '../clinical-protocols/clinical-protocols.module';
import { AgentController } from './agent.controller';
import { AgentInternalController } from './agent-internal.controller';
import { AgentService } from './agent.service';
import { ConversationService } from './conversation.service';
import { DecisionGateService } from './decision-gate.service';
import { AgentSchedulerService } from './agent-scheduler.service';
import { ProtocolEvaluationService } from './protocol-evaluation.service';
import { ProtocolEvaluationListener } from './protocol-evaluation.listener';
import { BackendServiceTokenGuard } from './guards/backend-service-token.guard';

@Module({
  imports: [
    PrismaModule,
    GatewaysModule,
    forwardRef(() => ChannelGatewayModule),
    forwardRef(() => OncologyNavigationModule),
    forwardRef(() => PatientsModule),
    ClinicalProtocolsModule,
  ],
  controllers: [AgentController, AgentInternalController],
  providers: [
    AgentService,
    ConversationService,
    DecisionGateService,
    AgentSchedulerService,
    ProtocolEvaluationService,
    ProtocolEvaluationListener,
    BackendServiceTokenGuard,
  ],
  exports: [AgentService, ConversationService, ProtocolEvaluationService],
})
export class AgentModule {}
