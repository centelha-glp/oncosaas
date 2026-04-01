import { ChannelType } from '@generated/prisma/client';

export interface IncomingMessage {
  patientPhone: string;
  content: string;
  channel: ChannelType;
  externalMessageId: string;
  timestamp: Date;
  type: 'TEXT' | 'AUDIO' | 'IMAGE' | 'DOCUMENT';
  mediaUrl?: string;
  audioDuration?: number;
}

export interface OutgoingMessage {
  to: string; // Phone number or recipient ID
  content: string;
  channel: ChannelType;
  tenantId: string;
  mediaUrl?: string;
}

export interface SendResult {
  success: boolean;
  externalMessageId?: string;
  error?: string;
}

export interface IChannel {
  readonly channelType: ChannelType;
  send(message: OutgoingMessage): Promise<SendResult>;
  validateWebhookSignature?(payload: Buffer, signature: string): boolean;
}
