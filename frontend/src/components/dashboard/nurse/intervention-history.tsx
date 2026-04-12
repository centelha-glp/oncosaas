'use client';

import {
  useMyInterventions,
  usePatientInterventions,
} from '@/hooks/useInterventionHistory';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import {
  History,
  MessageSquare,
  AlertCircle,
  FileText,
  TrendingUp,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const INTERVENTION_TYPE_LABELS: Record<string, string> = {
  ASSUME: 'Assumiu Conversa',
  RESPONSE: 'Respondeu ao Paciente',
  ALERT_RESOLVED: 'Resolveu Alerta',
  NOTE_ADDED: 'Adicionou Nota',
  PRIORITY_UPDATED: 'Atualizou Prioridade',
};

const INTERVENTION_TYPE_ICONS: Record<string, typeof History> = {
  ASSUME: MessageSquare,
  RESPONSE: MessageSquare,
  ALERT_RESOLVED: AlertCircle,
  NOTE_ADDED: FileText,
  PRIORITY_UPDATED: TrendingUp,
};

const INTERVENTION_TYPE_COLORS: Record<string, string> = {
  ASSUME: 'bg-blue-500',
  RESPONSE: 'bg-green-500',
  ALERT_RESOLVED: 'bg-yellow-500',
  NOTE_ADDED: 'bg-purple-500',
  PRIORITY_UPDATED: 'bg-orange-500',
};

interface InterventionHistoryProps {
  patientId?: string;
}

export function InterventionHistory({ patientId }: InterventionHistoryProps) {
  const myInterventionsQuery = useMyInterventions();
  const patientInterventionsQuery = usePatientInterventions(patientId || '');

  const {
    data: interventions,
    isLoading,
    error,
    refetch,
    isFetching,
  } = patientId ? patientInterventionsQuery : myInterventionsQuery;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Intervenções</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Intervenções</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-destructive" role="alert">
            Não foi possível carregar o histórico. Verifique sua conexão e tente
            novamente.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw
              className={cn('mr-2 h-4 w-4', isFetching && 'animate-spin')}
              aria-hidden
            />
            {isFetching ? 'Carregando...' : 'Tentar novamente'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!interventions || interventions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Intervenções</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground">
            Nenhuma intervenção registrada ainda.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Histórico de Intervenções
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-[600px] overflow-y-auto">
          {interventions.map((intervention) => {
            const Icon = INTERVENTION_TYPE_ICONS[intervention.type] || History;
            const colorClass =
              INTERVENTION_TYPE_COLORS[intervention.type] || 'bg-gray-500';

            return (
              <div
                key={intervention.id}
                className="p-4 border rounded-lg space-y-2 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div className={`p-2 rounded-lg ${colorClass} text-white`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge className={colorClass}>
                          {INTERVENTION_TYPE_LABELS[intervention.type] ||
                            intervention.type}
                        </Badge>
                        <span className="text-sm font-medium">
                          {intervention.patient.name}
                        </span>
                      </div>
                      {intervention.notes && (
                        <p className="text-sm text-muted-foreground">
                          {intervention.notes}
                        </p>
                      )}
                      {intervention.message && (
                        <p className="text-xs text-muted-foreground italic">
                          {`Mensagem relacionada: "${intervention.message.content.substring(0, 50)}..."`}
                        </p>
                      )}
                      <div className="text-xs text-muted-foreground">
                        {format(
                          new Date(intervention.createdAt),
                          "dd/MM/yyyy 'às' HH:mm",
                          {
                            locale: ptBR,
                          }
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
