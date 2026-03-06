'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Activity, ClipboardList, Filter } from 'lucide-react';
import {
  usePatientTimeline,
  TimelineItem,
  TimelineSymptomItem,
  TimelineQuestionnaireItem,
} from '@/hooks/use-patient-timeline';
import { cn } from '@/lib/utils';

const ESAS_ITEM_LABELS: Record<string, string> = {
  pain: 'Dor',
  fatigue: 'Cansaço',
  nausea: 'Náusea',
  depression: 'Humor/Depressão',
  anxiety: 'Ansiedade',
  drowsiness: 'Sonolência',
  appetite: 'Apetite',
  wellbeing: 'Bem-estar',
  dyspnea: 'Falta de ar',
};

const PRO_CTCAE_ITEM_LABELS: Record<string, string> = {
  pain: 'Dor',
  fatigue: 'Cansaço',
  nausea: 'Náusea',
  diarrhea: 'Diarreia',
  constipation: 'Constipação',
  sleep: 'Dificuldade para dormir',
  neuropathy: 'Formigamento/Dormência',
  appetite: 'Apetite',
};

type TimelineFilter = 'all' | 'symptom' | 'ESAS' | 'PRO_CTCAE';

interface PatientSymptomTimelineProps {
  patientId: string;
}

function SymptomItem({ item }: { item: TimelineSymptomItem }) {
  const value =
    item.valueString ?? (item.valueQuantity != null ? String(item.valueQuantity) : null);
  return (
    <div className="flex items-baseline gap-2 py-1.5 border-b border-border/50 last:border-0">
      <span className="text-muted-foreground shrink-0 text-sm">
        {format(new Date(item.date), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
      </span>
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <Activity className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="font-medium truncate">{item.display}</span>
        {value && (
          <Badge variant="outline" className="shrink-0 text-xs">
            {value}
          </Badge>
        )}
      </div>
    </div>
  );
}

function QuestionnaireItem({ item }: { item: TimelineQuestionnaireItem }) {
  const code = item.questionnaire?.code ?? '';
  const name = item.questionnaire?.name ?? code;
  const scores = item.scores;
  const isESAS = code === 'ESAS';
  const isPROCTCAE = code === 'PRO_CTCAE';

  const total = scores?.total;
  const itemsObj = scores?.items ?? {};
  const alerts = scores?.alerts ?? [];
  const interpretation = scores?.interpretation;

  const itemEntries = Object.entries(itemsObj);
  const labels = isESAS ? ESAS_ITEM_LABELS : PRO_CTCAE_ITEM_LABELS;
  const highThreshold = isESAS ? 7 : 3;

  return (
    <div className="flex flex-col gap-2 py-2 border-b border-border/50 last:border-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-sm shrink-0">
          {format(new Date(item.date), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
        </span>
        <div className="flex items-center gap-1.5">
          <ClipboardList className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-medium text-sm">{name}</span>
          {isESAS && total != null && (
            <Badge variant="secondary" className="text-xs">
              {total}/90
            </Badge>
          )}
        </div>
      </div>
      <div className="pl-5 space-y-1 text-sm">
        {itemEntries.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {itemEntries.map(([key, val]) => {
              const label = labels[key] ?? key;
              const isHigh = typeof val === 'number' && val >= highThreshold;
              return (
                <Badge
                  key={key}
                  variant={isHigh ? 'destructive' : 'outline'}
                  className={cn(
                    'text-xs font-normal',
                    isHigh && 'bg-amber-100 text-amber-900 border-amber-300'
                  )}
                >
                  {label}: {val}
                </Badge>
              );
            })}
          </div>
        ) : null}
        {alerts.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {alerts.map((a, i) => (
              <Badge
                key={i}
                variant="destructive"
                className="text-xs bg-red-100 text-red-800 border-red-300"
              >
                {(labels[a.item] ?? a.item)} {a.score != null ? `(${a.score})` : a.grade != null ? `(grau ${a.grade})` : ''} – {a.severity}
              </Badge>
            ))}
          </div>
        )}
        {interpretation && (
          <p className="text-muted-foreground text-xs mt-1">{interpretation}</p>
        )}
      </div>
    </div>
  );
}

export function PatientSymptomTimeline({
  patientId,
}: PatientSymptomTimelineProps): React.ReactElement {
  const { timeline, isLoading, error } = usePatientTimeline(patientId);
  const [filter, setFilter] = useState<TimelineFilter>('all');

  const filtered = useMemo(() => {
    if (filter === 'all') return timeline;
    if (filter === 'symptom') {
      return timeline.filter((t): t is TimelineSymptomItem => t.type === 'symptom');
    }
    if (filter === 'ESAS') {
      return timeline.filter(
        (t): t is TimelineQuestionnaireItem =>
          t.type === 'questionnaire' && t.questionnaire?.code === 'ESAS'
      );
    }
    if (filter === 'PRO_CTCAE') {
      return timeline.filter(
        (t): t is TimelineQuestionnaireItem =>
          t.type === 'questionnaire' && t.questionnaire?.code === 'PRO_CTCAE'
      );
    }
    return timeline;
  }, [timeline, filter]);

  if (error) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-sm text-destructive">
            Erro ao carregar linha do tempo. Tente novamente.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Linha do tempo de sintomas e questionários</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Linha do tempo de sintomas e questionários</CardTitle>
        <div className="flex items-center gap-1">
          <Filter className="h-4 w-4 text-muted-foreground" aria-hidden />
          <div className="flex gap-1">
            {[
              { v: 'all' as const, l: 'Todos' },
              { v: 'symptom' as const, l: 'Sintomas' },
              { v: 'ESAS' as const, l: 'ESAS' },
              { v: 'PRO_CTCAE' as const, l: 'PRO-CTCAE' },
            ].map(({ v, l }) => (
              <Button
                key={v}
                variant={filter === v ? 'default' : 'ghost'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setFilter(v)}
              >
                {l}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum sintoma ou questionário registrado nesta timeline.
          </p>
        ) : (
          <ul className="space-y-0">
            {filtered.map((item) => (
              <li key={item.type === 'symptom' ? item.id : item.id}>
                {item.type === 'symptom' ? (
                  <SymptomItem item={item} />
                ) : (
                  <QuestionnaireItem item={item} />
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
