import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  tenantId?: string;
  role?: string;
}

@WebSocketGateway({
  namespace: '/alerts',
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
})
export class AlertsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(AlertsGateway.name);

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private prisma: PrismaService
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      // Autenticação via token JWT no handshake
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.split(' ')[1];

      if (!token) {
        this.logger.warn(`Client ${client.id} disconnected: No token provided`);
        client.disconnect();
        return;
      }

      // Verificar e decodificar token
      const jwtSecret = this.configService.get<string>('JWT_SECRET');
      const isProduction =
        this.configService.get<string>('NODE_ENV') === 'production';

      if (isProduction && !jwtSecret) {
        this.logger.error(
          'JWT_SECRET must be configured in production environment'
        );
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token, {
        secret: jwtSecret || 'your-secret-key',
      });

      // Adicionar informações do usuário ao socket
      client.userId = payload.sub;
      client.tenantId = payload.tenantId;
      client.role = payload.role;

      // Entrar na room do tenant (isolamento multi-tenant)
      client.join(`tenant:${client.tenantId}`);

      // Entrar na room do usuário (para notificações pessoais)
      client.join(`user:${client.userId}`);

      this.logger.log(
        `Client ${client.id} connected (User: ${client.userId}, Tenant: ${client.tenantId})`
      );
    } catch (error) {
      this.logger.error(
        `Authentication failed for client ${client.id}:`,
        error
      );
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    this.logger.log(`Client ${client.id} disconnected`);
  }

  /**
   * Emitir alerta crítico para todos os usuários do tenant
   */
  emitCriticalAlert(tenantId: string, alert: any) {
    this.server.to(`tenant:${tenantId}`).emit('critical_alert', alert);
  }

  /**
   * Emitir novo alerta para todos os usuários do tenant
   */
  emitNewAlert(tenantId: string, alert: any) {
    this.server.to(`tenant:${tenantId}`).emit('new_alert', alert);
  }

  /**
   * Emitir atualização de alerta (status mudou)
   */
  emitAlertUpdate(tenantId: string, alert: any) {
    this.server.to(`tenant:${tenantId}`).emit('alert_updated', alert);
  }

  /**
   * Emitir contagem de alertas abertos
   */
  emitOpenAlertsCount(tenantId: string, count: number) {
    this.server.to(`tenant:${tenantId}`).emit('open_alerts_count', { count });
  }

  /**
   * Cliente pode se inscrever para receber alertas de um paciente específico
   */
  @SubscribeMessage('subscribe_patient_alerts')
  async handleSubscribePatientAlerts(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { patientId: string }
  ) {
    if (!client.tenantId) {
      return { error: 'Unauthorized' };
    }

    const patient = await this.prisma.patient.findFirst({
      where: { id: data.patientId, tenantId: client.tenantId },
      select: { id: true },
    });
    if (!patient) {
      return { error: 'Forbidden' };
    }

    // Entrar na room do paciente (para alertas específicos)
    client.join(`patient:${data.patientId}:tenant:${client.tenantId}`);
    this.logger.log(
      `Client ${client.id} subscribed to alerts for patient ${data.patientId}`
    );

    return { success: true };
  }

  /**
   * Cliente pode cancelar inscrição de alertas de um paciente
   */
  @SubscribeMessage('unsubscribe_patient_alerts')
  handleUnsubscribePatientAlerts(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { patientId: string }
  ) {
    if (!client.tenantId) {
      return { error: 'Unauthorized' };
    }

    client.leave(`patient:${data.patientId}:tenant:${client.tenantId}`);
    this.logger.log(
      `Client ${client.id} unsubscribed from alerts for patient ${data.patientId}`
    );

    return { success: true };
  }
}
