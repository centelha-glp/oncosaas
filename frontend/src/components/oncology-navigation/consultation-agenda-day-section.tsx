'use client';

import type {
  ConsultationAgendaItem,
  ConsultationAgendaSchedulableProfessional,
} from '@/lib/api/oncology-navigation';
import { formatAgendaDayLabel } from '@/lib/utils/consultationAgenda';
import { ConsultationAgendaItemCard } from './consultation-agenda-item-card';

export interface ConsultationAgendaDaySectionProps {
  dayKey: string;
  items: ConsultationAgendaItem[];
  schedulableProfessionals: ConsultationAgendaSchedulableProfessional[];
  schedulableProfessionalsLoading?: boolean;
}

export function ConsultationAgendaDaySection({
  dayKey,
  items,
  schedulableProfessionals,
  schedulableProfessionalsLoading,
}: ConsultationAgendaDaySectionProps) {
  const headerIso = `${dayKey}T12:00:00.000Z`;

  return (
    <section
      aria-labelledby={`agenda-day-${dayKey}`}
      className="space-y-3"
    >
      <h2
        id={`agenda-day-${dayKey}`}
        className="text-lg font-semibold capitalize text-foreground"
      >
        {formatAgendaDayLabel(headerIso)}
      </h2>
      <ul className="space-y-3" role="list">
        {items.map((item) => (
          <li key={item.id}>
            <ConsultationAgendaItemCard
              item={item}
              schedulableProfessionals={schedulableProfessionals}
              schedulableProfessionalsLoading={schedulableProfessionalsLoading}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
