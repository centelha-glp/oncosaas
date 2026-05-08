'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  clinicalNoteOrdersApi,
  type ClinicalExamRequestRow,
  type ClinicalPrescriptionLineRow,
} from '@/lib/api/clinical-note-orders';
import type { ClinicalNoteType } from '@/lib/api/clinical-notes';
import { toast } from 'sonner';
import { useState } from 'react';

const qk = ['clinical-note-orders'] as const;

function formatVersionHint(row: {
  clinicalNoteVersionNumber: number;
}): string {
  return `v${row.clinicalNoteVersionNumber}`;
}

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function openPrintHtml(args: { title: string; htmlBody: string }) {
  const w = window.open('', '_blank', 'noopener,noreferrer');
  if (!w) {
    toast.error('Não foi possível abrir a janela de impressão.');
    return;
  }
  w.document.open();
  w.document.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(args.title)}</title>
    <style>
      body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; color: #111827; padding: 24px; }
      h1 { font-size: 16px; margin: 0 0 12px; }
      h2 { font-size: 14px; margin: 16px 0 8px; }
      .muted { color: #6b7280; font-size: 12px; }
      .box { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border-bottom: 1px solid #e5e7eb; text-align: left; padding: 8px 6px; font-size: 12px; vertical-align: top; }
      th { font-weight: 600; }
      .page-break { page-break-before: always; }
      @media print { body { padding: 0; } .no-print { display: none; } }
    </style>
  </head>
  <body>
    ${args.htmlBody}
    <script>
      window.onload = () => { window.focus(); window.print(); };
    </script>
  </body>
</html>`);
  w.document.close();
}

export function ClinicalNoteOrdersPanel(props: {
  patientId: string;
  patientName?: string;
  clinicalNoteId: string;
  noteType: ClinicalNoteType;
  noteStatus: 'DRAFT' | 'SIGNED' | 'VOIDED';
  canManageExamRequests: boolean;
  canManagePrescriptions: boolean;
  variant: 'exams' | 'prescription';
  professionalName?: string;
}) {
  const {
    patientId,
    patientName,
    clinicalNoteId,
    noteType,
    noteStatus,
    canManageExamRequests,
    canManagePrescriptions,
    variant,
    professionalName,
  } = props;

  const queryClient = useQueryClient();
  const enabled =
    noteStatus !== 'VOIDED' && Boolean(patientId && clinicalNoteId);

  const examsQuery = useQuery({
    queryKey: [...qk, 'exams', patientId, clinicalNoteId],
    queryFn: () =>
      clinicalNoteOrdersApi.listExamRequests(patientId, clinicalNoteId),
    enabled,
  });

  const rxQuery = useQuery({
    queryKey: [...qk, 'rx', patientId, clinicalNoteId],
    queryFn: () =>
      clinicalNoteOrdersApi.listPrescriptionLines(patientId, clinicalNoteId),
    enabled: enabled && noteType === 'MEDICAL',
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: [...qk, 'exams', patientId, clinicalNoteId],
    });
    void queryClient.invalidateQueries({
      queryKey: [...qk, 'rx', patientId, clinicalNoteId],
    });
  };

  const [examName, setExamName] = useState('');
  const addExam = useMutation({
    mutationFn: () =>
      clinicalNoteOrdersApi.createExamRequest(patientId, clinicalNoteId, {
        displayName: examName.trim(),
      }),
    onSuccess: () => {
      setExamName('');
      invalidate();
      toast.success('Pedido de exame registrado.');
    },
    onError: (e: unknown) => {
      const msg =
        e && typeof e === 'object' && 'message' in e
          ? String((e as { message?: string }).message)
          : 'Não foi possível registrar o pedido.';
      toast.error(msg);
    },
  });

  const delExam = useMutation({
    mutationFn: (id: string) =>
      clinicalNoteOrdersApi.deleteExamRequest(
        patientId,
        clinicalNoteId,
        id
      ),
    onSuccess: () => {
      invalidate();
      toast.success('Pedido removido.');
    },
    onError: () => toast.error('Não foi possível remover o pedido.'),
  });

  const [medName, setMedName] = useState('');
  const [medDose, setMedDose] = useState('');
  const [medFreq, setMedFreq] = useState('');
  const [medRoute, setMedRoute] = useState('');

  const addRx = useMutation({
    mutationFn: () =>
      clinicalNoteOrdersApi.createPrescriptionLine(
        patientId,
        clinicalNoteId,
        {
          medicationName: medName.trim(),
          dosage: medDose.trim() || undefined,
          frequency: medFreq.trim() || undefined,
          route: medRoute.trim() || undefined,
        }
      ),
    onSuccess: () => {
      setMedName('');
      setMedDose('');
      setMedFreq('');
      setMedRoute('');
      invalidate();
      toast.success('Medicamento adicionado à prescrição.');
    },
    onError: (e: unknown) => {
      const msg =
        e && typeof e === 'object' && 'message' in e
          ? String((e as { message?: string }).message)
          : 'Não foi possível registrar o medicamento.';
      toast.error(msg);
    },
  });

  const delRx = useMutation({
    mutationFn: (id: string) =>
      clinicalNoteOrdersApi.deletePrescriptionLine(
        patientId,
        clinicalNoteId,
        id
      ),
    onSuccess: () => {
      invalidate();
      toast.success('Item removido da prescrição.');
    },
    onError: () => toast.error('Não foi possível remover o item.'),
  });

  const draftLocked = noteStatus !== 'DRAFT';
  const canEditExams = !draftLocked && canManageExamRequests;
  const canEditRx = !draftLocked && canManagePrescriptions;

  const safePatientName = patientName?.trim() ? patientName.trim() : 'Paciente';
  const safeProfessionalName =
    professionalName?.trim() ? professionalName.trim() : '—';

  const handlePrintExamRequests = () => {
    const rows = (examsQuery.data as ClinicalExamRequestRow[] | undefined) ?? [];
    const items = rows
      .map(
        (r) =>
          `<tr>
            <td>${escapeHtml(r.displayName)}</td>
            <td class="muted">${escapeHtml(r.code ?? '—')}</td>
            <td class="muted">${escapeHtml(formatVersionHint(r))}</td>
          </tr>`
      )
      .join('');
    openPrintHtml({
      title: `Solicitação de exames — ${safePatientName}`,
      htmlBody: `
        <h1>Solicitação de exames</h1>
        <div class="muted">Paciente: ${escapeHtml(safePatientName)} · Profissional: ${escapeHtml(safeProfessionalName)}</div>
        <div class="box" style="margin-top: 12px;">
          <table>
            <thead>
              <tr><th>Exame</th><th>Código</th><th>Versão</th></tr>
            </thead>
            <tbody>
              ${items || `<tr><td colspan="3" class="muted">Sem exames solicitados.</td></tr>`}
            </tbody>
          </table>
        </div>
      `,
    });
  };

  const [rxCopiesRaw, setRxCopiesRaw] = useState('2');
  const rxCopies = Math.min(
    Math.max(parseInt(rxCopiesRaw || '1', 10) || 1, 1),
    10
  );
  const handlePrintPrescription = () => {
    const rows =
      (rxQuery.data as ClinicalPrescriptionLineRow[] | undefined) ?? [];
    const tableRows = rows
      .map((r) => {
        const sig = [r.dosage, r.frequency, r.route].filter(Boolean).join(' · ');
        return `<tr>
          <td>${escapeHtml(r.medicationName)}</td>
          <td class="muted">${escapeHtml(sig || '—')}</td>
          <td class="muted">${escapeHtml(formatVersionHint(r))}</td>
        </tr>`;
      })
      .join('');

    const single = `
      <h1>Receita</h1>
      <div class="muted">Paciente: ${escapeHtml(safePatientName)} · Profissional: ${escapeHtml(safeProfessionalName)}</div>
      <div class="box" style="margin-top: 12px;">
        <table>
          <thead><tr><th>Medicamento</th><th>Posologia</th><th>Versão</th></tr></thead>
          <tbody>
            ${tableRows || `<tr><td colspan="3" class="muted">Sem itens prescritos.</td></tr>`}
          </tbody>
        </table>
      </div>
    `;

    const copiesHtml = Array.from({ length: rxCopies })
      .map((_, idx) =>
        idx === 0 ? single : `<div class="page-break"></div>${single}`
      )
      .join('');

    openPrintHtml({
      title: `Receita — ${safePatientName}`,
      htmlBody: copiesHtml,
    });
  };

  return (
    <div className="space-y-4">
      {variant === 'exams' && (
        <section
          className="space-y-2 rounded-md border p-3"
          aria-label="Pedidos de exame na evolução"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-medium">Solicitações de exames</h4>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handlePrintExamRequests}
              disabled={!enabled}
            >
              Imprimir solicitação
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {draftLocked
              ? 'Visível após assinatura; não editável.'
              : 'Inclua/remova pedidos antes de assinar.'}
          </p>
        {examsQuery.isLoading && (
          <p className="text-xs text-muted-foreground">Carregando…</p>
        )}
        {examsQuery.isError && (
          <p className="text-xs text-destructive" role="alert">
            Falha ao carregar pedidos.
          </p>
        )}
        <ul className="space-y-2 text-sm">
          {(examsQuery.data as ClinicalExamRequestRow[] | undefined)?.map(
            (r) => (
              <li
                key={r.id}
                className="flex flex-wrap gap-2 items-start justify-between border-b border-border/60 pb-2 last:border-0"
              >
                <div>
                  <span className="font-medium">{r.displayName}</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    ({formatVersionHint(r)})
                  </span>
                  {r.code && (
                    <span className="text-xs text-muted-foreground block">
                      Código: {r.code}
                    </span>
                  )}
                </div>
                {canEditExams && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="shrink-0 text-destructive"
                    disabled={delExam.isPending}
                    onClick={() => delExam.mutate(r.id)}
                  >
                    Remover
                  </Button>
                )}
              </li>
            )
          )}
        </ul>
        {canEditExams && (
          <div className="flex flex-col sm:flex-row gap-2 items-end pt-2">
            <div className="flex-1 w-full space-y-1">
              <Label htmlFor="exam-request-name">Nome do exame</Label>
              <Input
                id="exam-request-name"
                value={examName}
                onChange={(e) => setExamName(e.target.value)}
                placeholder="Ex.: Hemograma completo"
                autoComplete="off"
              />
            </div>
            <Button
              type="button"
              size="sm"
              disabled={addExam.isPending || !examName.trim()}
              onClick={() => addExam.mutate()}
            >
              Adicionar
            </Button>
          </div>
        )}
        </section>
      )}

      {variant === 'prescription' && noteType === 'MEDICAL' && (
        <section
          className="space-y-2 rounded-md border p-3"
          aria-label="Linhas de prescrição na evolução"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-medium">Receita (linhas)</h4>
            <div className="flex flex-wrap gap-2 items-end">
              <div className="space-y-1">
                <Label htmlFor="rx-copies">Nº de vias</Label>
                <Input
                  id="rx-copies"
                  inputMode="numeric"
                  value={rxCopiesRaw}
                  onChange={(e) => setRxCopiesRaw(e.target.value)}
                  className="w-20"
                  autoComplete="off"
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handlePrintPrescription}
                disabled={!enabled}
              >
                Imprimir receita
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {draftLocked
              ? 'Visível após assinatura; não editável.'
              : 'Inclua/remova itens antes de assinar.'}
          </p>
          {rxQuery.isLoading && (
            <p className="text-xs text-muted-foreground">Carregando…</p>
          )}
          {rxQuery.isError && (
            <p className="text-xs text-destructive" role="alert">
              Falha ao carregar prescrição.
            </p>
          )}
          <ul className="space-y-2 text-sm">
            {(rxQuery.data as ClinicalPrescriptionLineRow[] | undefined)?.map(
              (r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap gap-2 items-start justify-between border-b border-border/60 pb-2 last:border-0"
                >
                  <div>
                    <span className="font-medium">{r.medicationName}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      ({formatVersionHint(r)})
                    </span>
                    <span className="text-xs text-muted-foreground block">
                      {[r.dosage, r.frequency, r.route]
                        .filter(Boolean)
                        .join(' · ') || '—'}
                    </span>
                  </div>
                  {canEditRx && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="shrink-0 text-destructive"
                      disabled={delRx.isPending}
                      onClick={() => delRx.mutate(r.id)}
                    >
                      Remover
                    </Button>
                  )}
                </li>
              )
            )}
          </ul>
          {canEditRx && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="rx-med-name">Medicamento</Label>
                <Input
                  id="rx-med-name"
                  value={medName}
                  onChange={(e) => setMedName(e.target.value)}
                  placeholder="Nome ou apresentação"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="rx-dose">Dose</Label>
                <Input
                  id="rx-dose"
                  value={medDose}
                  onChange={(e) => setMedDose(e.target.value)}
                  placeholder="Ex.: 50 mg"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="rx-freq">Frequência</Label>
                <Input
                  id="rx-freq"
                  value={medFreq}
                  onChange={(e) => setMedFreq(e.target.value)}
                  placeholder="Ex.: 12/12 h"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="rx-route">Via</Label>
                <Input
                  id="rx-route"
                  value={medRoute}
                  onChange={(e) => setMedRoute(e.target.value)}
                  placeholder="Ex.: VO, IV"
                  autoComplete="off"
                />
              </div>
              <div className="sm:col-span-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={addRx.isPending || !medName.trim()}
                  onClick={() => addRx.mutate()}
                >
                  Adicionar à prescrição
                </Button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
