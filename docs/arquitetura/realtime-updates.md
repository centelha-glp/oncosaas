# Atualizações em Tempo Real - WebSocket/Socket.io

## Visão Geral

A plataforma utiliza **Socket.io** para atualizações em tempo real, essencial para:

- **Alertas críticos**: Notificações instantâneas quando agente detecta sintomas graves
- **Atualizações de conversas**: Novas mensagens WhatsApp aparecem em tempo real no dashboard
- **Mudanças de prioridade**: Score de priorização atualizado automaticamente
- **Status de pacientes**: Mudanças de status (ex: novo paciente adicionado)
- **Notificações para enfermagem**: Alertas de intervenção necessária

## Arquitetura

### Stack

- **Backend**: Socket.io com NestJS (`@nestjs/websockets`)
- **Frontend**: socket.io-client
- **Transport**: WebSocket com fallback para polling (compatibilidade)
- **Autenticação**: JWT via handshake

### Fluxo de Dados

```
[WhatsApp Agent] → Detecta sintoma crítico
    ↓
[Backend Service] → Emite evento Socket.io
    ↓
[Socket.io Server] → Broadcast para clientes conectados
    ↓
[Frontend Dashboard] → Recebe evento → Atualiza UI
```

## Implementação Backend (NestJS)

### 1. Instalar Dependências

```bash
cd backend
npm install @nestjs/websockets @nestjs/platform-socket.io
```

### 2. Gateway de WebSocket

```typescript
// src/modules/alerts/alerts.gateway.ts
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
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/alerts', // Namespace específico para alertas
})
@UseGuards(JwtAuthGuard) // Autenticação obrigatória
export class AlertsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(AlertsGateway.name);
  private readonly connectedClients = new Map<string, Socket>();

  handleConnection(client: Socket) {
    // Extrair tenantId do token JWT
    const tenantId = client.handshake.auth?.tenantId;
    const userId = client.handshake.auth?.userId;

    if (!tenantId || !userId) {
      this.logger.warn('Client connected without tenantId/userId');
      client.disconnect();
      return;
    }

    // Adicionar cliente à room do tenant
    client.join(`tenant:${tenantId}`);
    this.connectedClients.set(client.id, client);

    this.logger.log(`Client connected: ${client.id} (tenant: ${tenantId})`);
  }

  handleDisconnect(client: Socket) {
    this.connectedClients.delete(client.id);
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // Método para emitir alerta crítico
  emitCriticalAlert(tenantId: string, alert: AlertPayload) {
    this.server.to(`tenant:${tenantId}`).emit('critical_alert', alert);
  }

  // Método para emitir atualização de conversa
  emitConversationUpdate(tenantId: string, update: ConversationUpdatePayload) {
    this.server.to(`tenant:${tenantId}`).emit('conversation_update', update);
  }

  // Método para emitir atualização de prioridade
  emitPriorityUpdate(tenantId: string, update: PriorityUpdatePayload) {
    this.server.to(`tenant:${tenantId}`).emit('priority_update', update);
  }

  // Cliente pode se inscrever em eventos específicos
  @SubscribeMessage('subscribe_patient')
  handleSubscribePatient(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { patientId: string }
  ) {
    const tenantId = client.handshake.auth?.tenantId;
    client.join(`patient:${data.patientId}:tenant:${tenantId}`);
    return { status: 'subscribed', patientId: data.patientId };
  }

  @SubscribeMessage('unsubscribe_patient')
  handleUnsubscribePatient(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { patientId: string }
  ) {
    const tenantId = client.handshake.auth?.tenantId;
    client.leave(`patient:${data.patientId}:tenant:${tenantId}`);
    return { status: 'unsubscribed', patientId: data.patientId };
  }
}
```

### 3. Tipos TypeScript

```typescript
// src/modules/alerts/types/alert.types.ts
export interface AlertPayload {
  id: string;
  patientId: string;
  patientName: string;
  type:
    | 'critical_symptom'
    | 'no_response'
    | 'appointment_delay'
    | 'symptom_worsening';
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  timestamp: Date;
  metadata?: {
    symptom?: string;
    score?: number;
    conversationId?: string;
  };
}

export interface ConversationUpdatePayload {
  conversationId: string;
  patientId: string;
  type:
    | 'new_message'
    | 'message_sent'
    | 'conversation_assumed'
    | 'conversation_resolved';
  message?: {
    id: string;
    content: string;
    sender: 'patient' | 'agent' | 'nurse';
    timestamp: Date;
    isAudio?: boolean;
  };
}

export interface PriorityUpdatePayload {
  patientId: string;
  oldPriority: number;
  newPriority: number;
  category: 'critical' | 'high' | 'medium' | 'low';
  reason: string;
}
```

### 4. Service para Emitir Eventos

```typescript
// src/modules/alerts/alerts.service.ts
import { Injectable } from '@nestjs/common';
import { AlertsGateway } from './alerts.gateway';
import {
  AlertPayload,
  ConversationUpdatePayload,
  PriorityUpdatePayload,
} from './types/alert.types';

@Injectable()
export class AlertsService {
  constructor(private readonly alertsGateway: AlertsGateway) {}

  async emitCriticalAlert(tenantId: string, alert: AlertPayload) {
    this.alertsGateway.emitCriticalAlert(tenantId, alert);
    // Também salvar no banco de dados para histórico
    await this.saveAlertToDatabase(tenantId, alert);
  }

  async emitConversationUpdate(
    tenantId: string,
    update: ConversationUpdatePayload
  ) {
    this.alertsGateway.emitConversationUpdate(tenantId, update);
  }

  async emitPriorityUpdate(tenantId: string, update: PriorityUpdatePayload) {
    this.alertsGateway.emitPriorityUpdate(tenantId, update);
  }

  private async saveAlertToDatabase(tenantId: string, alert: AlertPayload) {
    // Implementar salvamento no Prisma
  }
}
```

### 5. Integração com WhatsApp Agent

```typescript
// src/modules/conversations/conversations.service.ts
import { Injectable } from '@nestjs/common';
import { AlertsService } from '../alerts/alerts.service';

@Injectable()
export class ConversationsService {
  constructor(private readonly alertsService: AlertsService) {}

  async processWhatsAppMessage(tenantId: string, message: WhatsAppMessage) {
    // Processar mensagem com agente de IA
    const result = await this.aiAgent.process(message);

    // Se detectar sintoma crítico, emitir alerta
    if (result.criticalSymptom) {
      await this.alertsService.emitCriticalAlert(tenantId, {
        id: generateId(),
        patientId: message.patientId,
        patientName: message.patientName,
        type: 'critical_symptom',
        severity: 'critical',
        message: `Sintoma crítico detectado: ${result.criticalSymptom}`,
        timestamp: new Date(),
        metadata: {
          symptom: result.criticalSymptom,
          conversationId: message.conversationId,
        },
      });
    }

    // Emitir atualização de conversa
    await this.alertsService.emitConversationUpdate(tenantId, {
      conversationId: message.conversationId,
      patientId: message.patientId,
      type: 'new_message',
      message: {
        id: message.id,
        content: message.content,
        sender: 'patient',
        timestamp: new Date(),
      },
    });
  }
}
```

## Implementação Frontend (Next.js)

### 1. Hook Customizado para Socket.io

```typescript
// src/hooks/useSocket.ts
'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '@/hooks/useAuth';

export const useSocket = (namespace: string = '/alerts') => {
  const { user, token } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!user || !token) return;

    // Conectar ao Socket.io server
    const socket = io(`${process.env.NEXT_PUBLIC_API_URL}${namespace}`, {
      auth: {
        token,
        tenantId: user.tenantId,
        userId: user.id,
      },
      transports: ['websocket', 'polling'], // Fallback para polling
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      console.log('Socket connected:', socket.id);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      console.log('Socket disconnected');
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    // Cleanup
    return () => {
      socket.disconnect();
    };
  }, [user, token, namespace]);

  return {
    socket: socketRef.current,
    isConnected,
  };
};
```

### 2. Hook para Alertas em Tempo Real

```typescript
// src/hooks/useAlerts.ts
'use client';

import { useEffect, useState } from 'react';
import { useSocket } from './useSocket';
import { AlertPayload } from '@/types/alerts';

export const useAlerts = () => {
  const { socket, isConnected } = useSocket('/alerts');
  const [alerts, setAlerts] = useState<AlertPayload[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!socket || !isConnected) return;

    // Escutar alertas críticos
    socket.on('critical_alert', (alert: AlertPayload) => {
      setAlerts((prev) => [alert, ...prev]);
      setUnreadCount((prev) => prev + 1);

      // Mostrar notificação do navegador (se permitido)
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Alerta Crítico', {
          body: alert.message,
          icon: '/icon-alert.png',
        });
      }
    });

    // Escutar atualizações de conversa
    socket.on('conversation_update', (update: ConversationUpdatePayload) => {
      // Atualizar lista de conversas
      // Implementar lógica específica
    });

    // Escutar atualizações de prioridade
    socket.on('priority_update', (update: PriorityUpdatePayload) => {
      // Atualizar score de prioridade do paciente
      // Implementar lógica específica
    });

    return () => {
      socket.off('critical_alert');
      socket.off('conversation_update');
      socket.off('priority_update');
    };
  }, [socket, isConnected]);

  const markAsRead = (alertId: string) => {
    setAlerts((prev) =>
      prev.map((alert) =>
        alert.id === alertId ? { ...alert, read: true } : alert
      )
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  return {
    alerts,
    unreadCount,
    markAsRead,
    isConnected,
  };
};
```

### 3. Componente de Alertas

```typescript
// src/components/dashboard/AlertsPanel.tsx
'use client';

import { useAlerts } from '@/hooks/useAlerts';
import { Alert, AlertCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export const AlertsPanel = () => {
  const { alerts, unreadCount, markAsRead, isConnected } = useAlerts();

  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          Alertas
          {unreadCount > 0 && (
            <Badge variant="destructive">{unreadCount}</Badge>
          )}
        </h3>
        {!isConnected && (
          <Badge variant="outline" className="text-yellow-600">
            Desconectado
          </Badge>
        )}
      </div>

      <div className="space-y-2">
        {alerts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum alerta</p>
        ) : (
          alerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-3 rounded-lg border ${
                alert.severity === 'critical'
                  ? 'border-red-500 bg-red-50'
                  : 'border-yellow-500 bg-yellow-50'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="font-medium">{alert.patientName}</p>
                  <p className="text-sm text-muted-foreground">
                    {alert.message}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(alert.timestamp).toLocaleString()}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => markAsRead(alert.id)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
```

### 4. Provider de Socket.io (Opcional)

```typescript
// src/providers/SocketProvider.tsx
'use client';

import { createContext, useContext, ReactNode } from 'react';
import { useSocket } from '@/hooks/useSocket';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider = ({ children }: { children: ReactNode }) => {
  const { socket, isConnected } = useSocket();

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocketContext = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocketContext must be used within SocketProvider');
  }
  return context;
};
```

## Eventos Disponíveis

### Eventos Emitidos pelo Servidor

| Evento                  | Payload                     | Descrição                                |
| ----------------------- | --------------------------- | ---------------------------------------- |
| `critical_alert`        | `AlertPayload`              | Alerta crítico (sintoma grave detectado) |
| `conversation_update`   | `ConversationUpdatePayload` | Nova mensagem ou atualização de conversa |
| `priority_update`       | `PriorityUpdatePayload`     | Mudança no score de priorização          |
| `patient_status_change` | `PatientStatusPayload`      | Mudança de status do paciente            |
| `new_patient`           | `NewPatientPayload`         | Novo paciente adicionado ao sistema      |

### Eventos Enviados pelo Cliente

| Evento                | Payload                 | Descrição                                   |
| --------------------- | ----------------------- | ------------------------------------------- |
| `subscribe_patient`   | `{ patientId: string }` | Inscrever-se em atualizações de um paciente |
| `unsubscribe_patient` | `{ patientId: string }` | Cancelar inscrição                          |
| `mark_alert_read`     | `{ alertId: string }`   | Marcar alerta como lido                     |

## Autenticação

### Backend - JWT no Handshake

```typescript
// src/common/guards/ws-jwt.guard.ts
import { CanActivate, ExecutionContext } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { verify } from 'jsonwebtoken';

export class WsJwtGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const client = context.switchToWs().getClient<Socket>();
    const token = client.handshake.auth?.token;

    if (!token) {
      throw new WsException('Unauthorized');
    }

    try {
      const payload = verify(token, process.env.JWT_SECRET);
      client.data.user = payload;
      return true;
    } catch {
      throw new WsException('Invalid token');
    }
  }
}
```

### Frontend - Enviar Token no Handshake

```typescript
const socket = io(url, {
  auth: {
    token: getToken(), // JWT token
    tenantId: user.tenantId,
    userId: user.id,
  },
});
```

## Performance e Escalabilidade

### Rooms e Namespaces

- **Rooms por tenant**: `tenant:${tenantId}` - Broadcast para todos do tenant
- **Rooms por paciente**: `patient:${patientId}:tenant:${tenantId}` - Broadcast específico
- **Namespaces**: `/alerts`, `/conversations`, `/priority` - Separar por funcionalidade

### Otimizações

1. **Throttling**: Limitar frequência de eventos (ex: máximo 1 evento/segundo por paciente)
2. **Debouncing**: Agrupar múltiplas atualizações em uma única mensagem
3. **Compressão**: Habilitar compressão no Socket.io
4. **Redis Adapter**: Para múltiplas instâncias do servidor

```typescript
// backend/src/main.ts
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

const pubClient = createClient({ url: process.env.REDIS_URL });
const subClient = pubClient.duplicate();

await Promise.all([pubClient.connect(), subClient.connect()]);

io.adapter(createAdapter(pubClient, subClient));
```

## Testes

### Teste de Gateway

```typescript
// src/modules/alerts/alerts.gateway.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { AlertsGateway } from './alerts.gateway';

describe('AlertsGateway', () => {
  let gateway: AlertsGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AlertsGateway],
    }).compile();

    gateway = module.get<AlertsGateway>(AlertsGateway);
  });

  it('should emit critical alert to tenant room', () => {
    const mockSocket = {
      join: jest.fn(),
      emit: jest.fn(),
    };

    gateway.handleConnection(mockSocket as any);
    gateway.emitCriticalAlert('tenant-1', mockAlert);

    expect(mockSocket.emit).toHaveBeenCalledWith('critical_alert', mockAlert);
  });
});
```

## Checklist de Implementação

- [ ] Instalar `@nestjs/websockets` e `@nestjs/platform-socket.io` no backend
- [ ] Criar Gateway de WebSocket (`alerts.gateway.ts`)
- [ ] Implementar autenticação JWT no handshake
- [ ] Criar Service para emitir eventos (`alerts.service.ts`)
- [ ] Integrar com WhatsApp Agent para emitir alertas
- [ ] Criar hook `useSocket` no frontend
- [ ] Criar hook `useAlerts` no frontend
- [ ] Criar componente `AlertsPanel` para exibir alertas
- [ ] Configurar notificações do navegador (opcional)
- [ ] Implementar Redis Adapter para escalabilidade (opcional)
- [ ] Adicionar testes unitários e E2E
- [ ] Documentar eventos disponíveis

## Referências

- [NestJS WebSockets](https://docs.nestjs.com/websockets/gateways)
- [Socket.io Documentation](https://socket.io/docs/v4/)
- [Socket.io Client](https://socket.io/docs/v4/client-api/)

---

**Última atualização**: 2026-04-13  
**Versão**: 1.0.0
