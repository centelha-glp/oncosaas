'use client';

import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { JOURNEY_STAGE_LABELS, type JourneyStage } from '@/lib/utils/journey-stage';
import type { ConsultationAgendaItem } from '@/lib/api/oncology-navigation';
import {
  CONSULTATION_AGENDA_STATUS_LABEL,
  consultationAgendaItemBorderClass,
  consultationAgendaStatusBadgeVariant,
  formatShortAgendaDate,
} from '@/lib/utils/consultationAgenda';

export interface ConsultationAgendaItemCardProps {
  item: ConsultationAgendaItem;
}

export function ConsultationAgendaItemCard({ item }: ConsultationAgendaItemCardProps) {
  return (
    <Card
      className={cn(
        'border-l-4',
        consultationAgendaItemBorderClass(item.status)
      )}
    >
      <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-foreground">{item.stepName}</span>
            <Badge variant={consultationAgendaStatusBadgeVariant(item.status)}>
              {CONSULTATION_AGENDA_STATUS_LABEL[item.status] ?? item.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{item.patient.name}</span>
            {' · '}
            {JOURNEY_STAGE_LABELS[item.journeyStage as JourneyStage] ??
              item.journeyStage}
          </p>
          <dl className="grid grid-cols-1 gap-1 text-xs text-muted-foreground sm:grid-cols-3">
            <div>
              <dt className="inline font-medium text-foreground">Prevista: </dt>
              <dd className="inline">{formatShortAgendaDate(item.expectedDate)}</dd>
            </div>
            <div>
              <dt className="inline font-medium text-foreground">Limite: </dt>
              <dd className="inline">{formatShortAgendaDate(item.dueDate)}</dd>
            </div>
            <div>
              <dt className="inline font-medium text-foreground">Realizada: </dt>
              <dd className="inline">{formatShortAgendaDate(item.actualDate)}</dd>
            </div>
          </dl>
        </div>
        <Link
          href={`/patients/${item.patientId}`}
          className={cn(
            buttonVariants({ variant: 'outline', size: 'sm' }),
            'inline-flex shrink-0 items-center gap-1'
          )}
        >
          Ficha do paciente
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </CardContent>
    </Card>
  );
}
