'use client';

import React from 'react';
import Link from 'next/link';
import { FileText } from 'lucide-react';
import { useClinicalNotesForNavigationStep } from '@/hooks/use-clinical-notes';
import {
  clinicalNoteTypeLabel,
  type ClinicalNoteListItem,
} from '@/lib/api/clinical-notes';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';

function statusLabel(status: ClinicalNoteListItem['status']): string {
  if (status === 'SIGNED') return 'Assinada';
  if (status === 'VOIDED') return 'Anulada';
  return 'Rascunho';
}

export interface NavigationStepLinkedEvolutionsProps {
  patientId: string;
  navigationStepId: string;
  /** Quando false, não busca (ex.: etapa ainda não persistida) */
  enabled?: boolean;
  compact?: boolean;
}

/**
 * Lista evoluções do prontuário (ClinicalNote) vinculadas à etapa via navigationStepId.
 * Substitui o modelo SOAP duplicado em metadata da etapa para consultas especializada / navegação.
 */
export function NavigationStepLinkedEvolutions({
  patientId,
  navigationStepId,
  enabled = true,
  compact = false,
}: NavigationStepLinkedEvolutionsProps): React.ReactElement {
  const { data, isLoading, isError, refetch } =
    useClinicalNotesForNavigationStep(patientId, navigationStepId, enabled);

  const items = data?.data ?? [];

  return (
    <section
      className="space-y-3 rounded-md border border-primary/25 bg-primary/5 p-3"
      aria-labelledby="nav-step-prontuario-heading"
    >
      <div className="flex items-start gap-2">
        <FileText className="h-4 w-4 shrink-0 text-primary mt-0.5" aria-hidden />
        <div className="min-w-0 flex-1 space-y-1">
          <h4
            id="nav-step-prontuario-heading"
            className="text-sm font-semibold text-foreground"
          >
            Evoluções do prontuário
          </h4>
          <p className="text-xs text-muted-foreground leading-relaxed">
            O registro clínico estruturado desta consulta fica no{' '}
            <strong>Prontuário</strong> do paciente (mesmo modelo das evoluções
            médica / enfermagem). Use os botões de evolução na aba Prontuário
            vinculando esta etapa.
          </p>
        </div>
      </div>

      {isLoading && (
        <p className="text-xs text-muted-foreground">Carregando evoluções…</p>
      )}
      {isError && (
        <p className="text-xs text-destructive">
          Não foi possível carregar as evoluções.{' '}
          <button
            type="button"
            className="underline font-medium"
            onClick={() => void refetch()}
          >
            Tentar novamente
          </button>
        </p>
      )}
      {!isLoading && !isError && items.length === 0 && (
        <p className="text-xs text-muted-foreground rounded border border-dashed border-border bg-background/80 px-2 py-2">
          Nenhuma evolução vinculada a esta etapa ainda. Abra o{' '}
          <Link
            href={`/patients/${patientId}?tab=chart`}
            className="font-medium text-primary underline underline-offset-2"
          >
            Prontuário do paciente
          </Link>{' '}
          e crie a evolução (médica ou enfermagem) escolhendo esta consulta.
        </p>
      )}
      {items.length > 0 && (
        <ul className="space-y-2" aria-label="Evoluções vinculadas">
          {items.map((n) => (
            <li
              key={n.id}
              className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            >
              <span className="font-medium text-foreground">
                {clinicalNoteTypeLabel(n.noteType)}
              </span>
              <Badge variant="secondary" className="text-xs font-normal">
                {statusLabel(n.status)}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {format(new Date(n.createdAt), 'dd/MM/yyyy HH:mm', {
                  locale: ptBR,
                })}
              </span>
              {!compact && (
                <Link
                  href={`/patients/${patientId}?tab=chart`}
                  className="ml-auto text-xs font-medium text-primary underline underline-offset-2"
                >
                  Abrir prontuário
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
