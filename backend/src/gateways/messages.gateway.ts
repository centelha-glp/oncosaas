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
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  tenantId?: string;
  role?: string;
}

@WebSocketGateway({
  namespace: '/messages',
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
})
export class MessagesGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MessagesGateway.name);

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
   * Emitir nova mensagem recebida do WhatsApp
   */
  emitNewMessage(tenantId: string, message: any) {
    // Emitir para todo o tenant
    this.server.to(`tenant:${tenantId}`).emit('new_message', message);
    // Emitir também para a room específica do paciente
    if (message.patientId) {
      this.server
        .to(`patient:${message.patientId}:tenant:${tenantId}`)
        .emit('new_message', message);
    }
  }

  /**
   * Emitir mensagem enviada (confirmação de envio)
   */
  emitMessageSent(tenantId: string, message: any) {
    // Emitir para todo o tenant
    this.server.to(`tenant:${tenantId}`).emit('message_sent', message);
    // Emitir também para a room específica do paciente
    if (message.patientId) {
      this.server
        .to(`patient:${message.patientId}:tenant:${tenantId}`)
        .emit('message_sent', message);
    }
  }

  /**
   * Emitir atualização de mensagem (ex: assumida pela enfermagem)
   */
  emitMessageUpdate(tenantId: string, message: any) {
    // Emitir para todo o tenant
    this.server.to(`tenant:${tenantId}`).emit('message_updated', message);
    // Emitir também para a room específica do paciente
    if (message.patientId) {
      this.server
        .to(`patient:${message.patientId}:tenant:${tenantId}`)
        .emit('message_updated', message);
    }
  }

  /**
   * Cliente pode se inscrever para receber mensagens de um paciente específico
   */
  @SubscribeMessage('subscribe_patient_messages')
  async handleSubscribePatientMessages(
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

    // Entrar na room do paciente (para mensagens específicas)
    client.join(`patient:${data.patientId}:tenant:${client.tenantId}`);
    this.logger.log(
      `Client ${client.id} subscribed to messages for patient ${data.patientId}`
    );

    return { success: true };
  }

  /**
   * Cliente pode cancelar inscrição de mensagens de um paciente
   */
  @SubscribeMessage('unsubscribe_patient_messages')
  handleUnsubscribePatientMessages(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { patientId: string }
  ) {
    if (!client.tenantId) {
      return { error: 'Unauthorized' };
    }

    client.leave(`patient:${data.patientId}:tenant:${client.tenantId}`);
    this.logger.log(
      `Client ${client.id} unsubscribed from messages for patient ${data.patientId}`
    );

    return { success: true };
  }
}
