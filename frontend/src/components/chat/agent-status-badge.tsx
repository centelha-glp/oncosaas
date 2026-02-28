'use client';

import { cn } from '@/lib/utils';
import { Bot, User, Users } from 'lucide-react';
import type { Conversation } from '@/lib/api/conversations';

type HandledBy = Conversation['handledBy'];
type ConversationStatus = Conversation['status'];
type Channel = Conversation['channel'];

interface AgentStatusBadgeProps {
  handledBy: HandledBy;
  status: ConversationStatus;
  channel?: Channel;
  className?: string;
}

const HANDLED_BY_CONFIG: Record<
  HandledBy,
  { label: string; icon: React.ElementType; color: string }
> = {
  AGENT: {
    label: 'Agente IA',
    icon: Bot,
    color: 'bg-blue-100 text-blue-700 border-blue-200',
  },
  NURSING: {
    label: 'Enfermagem',
    icon: User,
    color: 'bg-amber-100 text-amber-700 border-amber-200',
  },
  HYBRID: {
    label: 'IA + Enfermagem',
    icon: Users,
    color: 'bg-purple-100 text-purple-700 border-purple-200',
  },
};

const STATUS_COLORS: Record<ConversationStatus, string> = {
  ACTIVE: 'bg-green-500',
  WAITING: 'bg-yellow-500',
  ESCALATED: 'bg-red-500',
  CLOSED: 'bg-gray-400',
};

const CHANNEL_LABELS: Record<Channel, string> = {
  WHATSAPP: 'WhatsApp',
  SMS: 'SMS',
  VOICE: 'Voz',
  WEB_CHAT: 'Chat',
};

export function AgentStatusBadge({
  handledBy,
  status,
  channel,
  className,
}: AgentStatusBadgeProps) {
  const config = HANDLED_BY_CONFIG[handledBy];
  const Icon = config.icon;
  const statusColor = STATUS_COLORS[status];

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
          config.color
        )}
      >
        <Icon className="h-3 w-3" />
        {config.label}
        <span className={cn('ml-0.5 h-1.5 w-1.5 rounded-full', statusColor)} />
      </span>

      {channel && (
        <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs text-gray-500">
          {CHANNEL_LABELS[channel]}
        </span>
      )}
    </div>
  );
}
