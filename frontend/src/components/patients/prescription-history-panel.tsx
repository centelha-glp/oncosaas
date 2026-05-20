'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { prescriptionHistoryApi, type PrescriptionHistoryRow } from '@/lib/api/clinical-note-orders';
import { useDebounce } from '@/lib/utils/use-debounce';
import type { PrescriptionDraftFromHistory } from '@/lib/utils/clinical-orders-payload';
import { prescriptionDraftFromHistoryRow } from '@/lib/utils/clinical-orders-payload';
import { buildPrescriptionPosology } from '@/lib/utils/prescription-posology';

type Props = {
  patientId: string;
  currentClinicalNoteId: string;
  onReuse: (draft: PrescriptionDraftFromHistory) => void;
  onReuseAllFromNote: (drafts: PrescriptionDraftFromHistory[]) => void;
};

function formatNoteContext(row: PrescriptionHistoryRow): string {
  const status =
    row.clinicalNote.status === 'SIGNED'
      ? 'assinada'
      : row.clinicalNote.status === 'DRAFT'
        ? 'rascunho'
        : row.clinicalNote.status;
  const signed = row.clinicalNote.signedAt
    ? new Date(row.clinicalNote.signedAt).toLocaleDateString('pt-BR')
    : null;
  return signed ? `${status} · ${signed}` : status;
}

export function PrescriptionHistoryPanel({
  patientId,
  currentClinicalNoteId,
  onReuse,
  onReuseAllFromNote,
}: Props) {
  const [search, setSearch] = useState('');
  const debouncedQ = useDebounce(search, 300);

  const historyQuery = useQuery({
    queryKey: ['prescription-history', patientId, debouncedQ],
    queryFn: () =>
      prescriptionHistoryApi.list(patientId, {
        q: debouncedQ || undefined,
        limit: 50,
        offset: 0,
      }),
    staleTime: 30_000,
  });

  const items = historyQuery.data?.items ?? [];

  const reuseAllForNote = (noteId: string) => {
    const rows = items.filter((r) => r.clinicalNoteId === noteId);
    onReuseAllFromNote(rows.map(prescriptionDraftFromHistoryRow));
  };

  return (
    <section
      className="space-y-2 rounded-md border p-3"
      aria-label="Histórico de prescrições do paciente"
    >
      <h4 className="text-sm font-medium">Histórico de prescrições</h4>
      <p className="text-xs text-muted-foreground">
        Reutilizar copia os dados para o formulário abaixo; nada é salvo até você clicar em Adicionar.
      </p>
      <div className="space-y-1">
        <Label htmlFor="rx-history-search">Buscar</Label>
        <Input
          id="rx-history-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Medicamento, dose, via..."
          autoComplete="off"
        />
      </div>
      {historyQuery.isLoading && (
        <p className="text-xs text-muted-foreground">Carregando histórico…</p>
      )}
      {historyQuery.isError && (
        <p className="text-xs text-destructive" role="alert">
          Falha ao carregar histórico.
        </p>
      )}
      <ul className="space-y-2 text-sm max-h-64 overflow-y-auto">
        {items.map((row) => {
          const posology =
            row.route && row.dosage && row.frequency && row.duration
              ? buildPrescriptionPosology({
                  route: row.route,
                  quantity: row.quantity ?? '1',
                  dosage: row.dosage,
                  frequency: row.frequency,
                  duration: row.duration,
                })
              : [row.dosage, row.frequency, row.route, row.duration]
                  .filter(Boolean)
                  .join(' · ') || '—';
          const observation = row.observation ?? row.indication;
          const isCurrentNote = row.clinicalNoteId === currentClinicalNoteId;
          return (
            <li
              key={row.id}
              className="flex flex-wrap gap-2 items-start justify-between border-b border-border/60 pb-2 last:border-0"
            >
              <div className="min-w-0 flex-1">
                <span className="font-medium">{row.medicationName}</span>
                <span className="text-xs text-muted-foreground block">
                  {posology}
                </span>
                <span className="text-xs text-muted-foreground block">
                  {row.prescribedBy.name} · {formatNoteContext(row)}
                  {isCurrentNote ? ' · evolução atual' : ''}
                </span>
                {observation?.trim() && (
                  <span className="text-xs text-muted-foreground block">
                    Observação: {observation.trim()}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onReuse(prescriptionDraftFromHistoryRow(row))}
                >
                  Reutilizar
                </Button>
                {!isCurrentNote && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={() => reuseAllForNote(row.clinicalNoteId)}
                  >
                    Reutilizar todas desta evolução
                  </Button>
                )}
              </div>
            </li>
          );
        })}
        {!historyQuery.isLoading && items.length === 0 && (
          <li className="text-xs text-muted-foreground">Nenhuma prescrição anterior.</li>
        )}
      </ul>
    </section>
  );
}
