import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { PatientsModule } from './patients/patients.module';
import { MessagesModule } from './messages/messages.module';
import { AlertsModule } from './alerts/alerts.module';
import { ObservationsModule } from './observations/observations.module';
import { GatewaysModule } from './gateways/gateways.module';
import { OncologyNavigationModule } from './oncology-navigation/oncology-navigation.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { WhatsAppConnectionsModule } from './whatsapp-connections/whatsapp-connections.module';
import { UsersModule } from './users/users.module';
import { InternalNotesModule } from './internal-notes/internal-notes.module';
import { InterventionsModule } from './interventions/interventions.module';
import { TreatmentsModule } from './treatments/treatments.module';
import { ChannelGatewayModule } from './channel-gateway/channel-gateway.module';
import { AgentModule } from './agent/agent.module';
import { ClinicalProtocolsModule } from './clinical-protocols/clinical-protocols.module';
import { AuditLogModule } from './audit-log/audit-log.module';
import { AuditLogInterceptor } from './audit-log/audit-log.interceptor';
import { ScheduledActionsModule } from './scheduled-actions/scheduled-actions.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { ThrottleGuard } from './common/guards/throttle.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../.env', // Caminho relativo ao backend/src
      expandVariables: true,
    }),
    ScheduleModule.forRoot(), // Habilita agendamento de tarefas
    PrismaModule,
    AuthModule,
    PatientsModule,
    MessagesModule,
    AlertsModule,
    ObservationsModule,
    GatewaysModule,
    OncologyNavigationModule,
    DashboardModule,
    WhatsAppConnectionsModule,
    UsersModule,
    InternalNotesModule,
    InterventionsModule,
    TreatmentsModule,
    ChannelGatewayModule,
    AgentModule,
    ClinicalProtocolsModule,
    AuditLogModule,
    ScheduledActionsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Rate Limiting global - 100 req/min geral, 10 req/min para login
    {
      provide: APP_GUARD,
      useClass: ThrottleGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // Audit logging - persists all CREATE/UPDATE/DELETE actions automatically
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogInterceptor,
    },
  ],
})
export class AppModule {}
