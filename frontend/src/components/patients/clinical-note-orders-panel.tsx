'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import {
  clinicalNoteOrdersApi,
  type ClinicalExamRequestRow,
  type ClinicalPrescriptionLineRow,
} from '@/lib/api/clinical-note-orders';
import { tissGuidesApi } from '@/lib/api/tiss-guides';
import type { ClinicalNoteType } from '@/lib/api/clinical-notes';
import { toast } from 'sonner';
import { useRef, useState } from 'react';
import { ExamCatalogCombobox } from '@/components/shared/exam-catalog-combobox';
import { useDebounce } from '@/lib/utils/use-debounce';
import { useExamCatalogComboboxOptions } from '@/hooks/use-exam-catalog-combobox-options';
import type { ExamCatalogSelection } from '@/hooks/use-exam-catalog-combobox-options';
import { buildExamRequestPayload } from '@/lib/utils/clinical-orders-payload';
import { PrescriptionLineForm } from '@/components/patients/prescription-line-form';
import { PrescriptionHistoryPanel } from '@/components/patients/prescription-history-panel';
import type { PrescriptionDraftFromHistory } from '@/lib/utils/clinical-orders-payload';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

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
  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(args.title)}</title>
    <style>
      @page { size: A4; margin: 10mm; content: "A4"; }
      body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; color: #111827; padding: 24px; }
      h1 { font-size: 16px; margin: 0 0 12px; }
      h2 { font-size: 14px; margin: 16px 0 8px; }
      .muted { color: #6b7280; font-size: 12px; }
      .box { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border-bottom: 1px solid #e5e7eb; text-align: left; padding: 8px 6px; font-size: 12px; vertical-align: top; }
      th { font-weight: 600; }
      .page-break { page-break-before: always; }
      @media print {
        body { padding: 0; }
        .no-print { display: none; }
      }
    </style>
  </head>
  <body>
    ${args.htmlBody}
  </body>
</html>`;

  // Imprime via iframe invisível na mesma página (sem abrir nova aba)
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  if (!doc) {
    toast.error('Não foi possível iniciar impressão (documento indisponível).');
    iframe.remove();
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  // Espera o iframe carregar o conteúdo antes de printar
  let didPrint = false;
  const tryPrint = () => {
    if (didPrint) return;
    const win = iframe.contentWindow;
    if (!win) {
      toast.error('Não foi possível iniciar impressão (janela indisponível).');
      iframe.remove();
      return;
    }
    didPrint = true;
    win.focus();
    win.print();
    // Limpeza: remover após um tempo curto (evita acumular iframes)
    window.setTimeout(() => iframe.remove(), 1000);
  };

  // Alguns browsers disparam onload; outros não. Então tentamos ambos.
  iframe.onload = () => tryPrint();
  window.setTimeout(() => tryPrint(), 250);
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
  const [examCatalogSelection, setExamCatalogSelection] =
    useState<ExamCatalogSelection | null>(null);
  const debouncedExamQ = useDebounce(examName, 300);
  const { options: examCatalogOptions } = useExamCatalogComboboxOptions(debouncedExamQ);

  const addExam = useMutation({
    mutationFn: () =>
      clinicalNoteOrdersApi.createExamRequest(
        patientId,
        clinicalNoteId,
        buildExamRequestPayload({
          displayName: examName,
          catalogSelection: examCatalogSelection,
        })
      ),
    onSuccess: () => {
      setExamName('');
      setExamCatalogSelection(null);
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

  const [rxDraft, setRxDraft] = useState<PrescriptionDraftFromHistory | null>(null);
  const rxDraftQueueRef = useRef<PrescriptionDraftFromHistory[]>([]);

  const addRx = useMutation({
    mutationFn: (body: {
      medicationName: string;
      catalogKey?: string;
      presentationCatalogCode?: string;
      dosage?: string;
      frequency?: string;
      route?: string;
      duration?: string;
      indication?: string;
    }) =>
      clinicalNoteOrdersApi.createPrescriptionLine(patientId, clinicalNoteId, body),
    onSuccess: () => {
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

  const canEditExams = noteStatus !== 'VOIDED' && canManageExamRequests;
  const canEditRx = noteStatus !== 'VOIDED' && canManagePrescriptions;

  const safePatientName = patientName?.trim() ? patientName.trim() : 'Paciente';
  const safeProfessionalName =
    professionalName?.trim() ? professionalName.trim() : '—';

  const tissFormSchema = z.object({
    operatorName: z.string().trim().min(1, 'Operadora é obrigatória').max(200),
    operatorANSCode: z.string().trim().max(32).optional().or(z.literal('')),
    beneficiaryName: z.string().trim().max(200).optional().or(z.literal('')),
    beneficiaryCardNumber: z.string().trim().max(64).optional().or(z.literal('')),
    requestingProfessionalName: z
      .string()
      .trim()
      .max(200)
      .optional()
      .or(z.literal('')),
    requestingProfessionalCouncil: z.string().trim().max(32).optional().or(z.literal('')),
    requestingProfessionalCouncilUf: z.string().trim().max(2).optional().or(z.literal('')),
    requestingProfessionalRegistration: z.string().trim().max(32).optional().or(z.literal('')),
    requestingFacilityCnes: z.string().trim().max(16).optional().or(z.literal('')),
  });

  type TissFormValues = z.infer<typeof tissFormSchema>;
  const [tissOpen, setTissOpen] = useState(false);
  const tissForm = useForm<TissFormValues>({
    resolver: zodResolver(tissFormSchema),
    defaultValues: {
      operatorName: '',
      operatorANSCode: '',
      beneficiaryName: safePatientName,
      beneficiaryCardNumber: '',
      requestingProfessionalName: safeProfessionalName !== '—' ? safeProfessionalName : '',
      requestingProfessionalCouncil: '',
      requestingProfessionalCouncilUf: '',
      requestingProfessionalRegistration: '',
      requestingFacilityCnes: '',
    },
  });

  const emitTiss = useMutation({
    mutationFn: async (values: TissFormValues) => {
      const payload = {
        operatorName: values.operatorName,
        operatorANSCode: values.operatorANSCode || undefined,
        beneficiaryName: values.beneficiaryName || undefined,
        beneficiaryCardNumber: values.beneficiaryCardNumber || undefined,
        requestingProfessionalName: values.requestingProfessionalName || undefined,
        requestingProfessionalCouncil: values.requestingProfessionalCouncil || undefined,
        requestingProfessionalCouncilUf: values.requestingProfessionalCouncilUf || undefined,
        requestingProfessionalRegistration:
          values.requestingProfessionalRegistration || undefined,
        requestingFacilityCnes: values.requestingFacilityCnes || undefined,
      };
      return tissGuidesApi.emitSpsadtGuide(patientId, clinicalNoteId, payload);
    },
    onSuccess: (guide) => {
      setTissOpen(false);
      toast.success('Guia TISS (SP/SADT) emitida.');
      const dateStr = new Date(guide.createdAt).toLocaleDateString('pt-BR');
      const itemsHtml = (guide.items ?? [])
        .map((it) => {
          return `<tr>
            <td class="muted">${escapeHtml(it.procedureCode || '—')}</td>
            <td>${escapeHtml(it.procedureName)}</td>
            <td>${escapeHtml(String(it.quantity ?? 1))}</td>
            <td class="muted">${escapeHtml(it.notes || '—')}</td>
          </tr>`;
        })
        .join('');

      openPrintHtml({
        title: `Guia TISS SP/SADT — ${guide.beneficiaryName}`,
        htmlBody: `
          <h1>Guia TISS SP/SADT — Solicitação</h1>
          <div class="muted">Data: ${escapeHtml(dateStr)} · Nº Guia: ${escapeHtml(guide.guideNumber)}</div>

          <h2>Operadora</h2>
          <div class="box">
            <div><strong>Operadora:</strong> ${escapeHtml(guide.operatorName)}</div>
            <div><strong>Código ANS:</strong> <span class="muted">${escapeHtml(guide.operatorANSCode || '—')}</span></div>
          </div>

          <h2>Beneficiário</h2>
          <div class="box">
            <div><strong>Nome:</strong> ${escapeHtml(guide.beneficiaryName)}</div>
            <div><strong>Nº carteirinha:</strong> <span class="muted">${escapeHtml(guide.beneficiaryCardNumber || '—')}</span></div>
          </div>

          <h2>Solicitante</h2>
          <div class="box">
            <div><strong>Profissional:</strong> ${escapeHtml(guide.requestingProfessionalName)}</div>
            <div><strong>Conselho/UF/Registro:</strong> <span class="muted">${escapeHtml(
              [
                guide.requestingProfessionalCouncil,
                guide.requestingProfessionalCouncilUf,
                guide.requestingProfessionalRegistration,
              ]
                .filter(Boolean)
                .join(' ')
                .trim() || '—'
            )}</span></div>
            <div><strong>CNES:</strong> <span class="muted">${escapeHtml(guide.requestingFacilityCnes || '—')}</span></div>
          </div>

          <h2>Procedimentos solicitados</h2>
          <div class="box">
            <table>
              <thead>
                <tr>
                  <th>Código (TUSS/LOINC)</th>
                  <th>Procedimento</th>
                  <th>Qtd</th>
                  <th>Obs.</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml || `<tr><td colspan="4" class="muted">Sem itens.</td></tr>`}
              </tbody>
            </table>
          </div>
        `,
      });
    },
    onError: (e: unknown) => {
      const msg =
        e && typeof e === 'object' && 'message' in e
          ? String((e as { message?: string }).message)
          : 'Não foi possível emitir a guia TISS.';
      toast.error(msg);
    },
  });

  const handlePrintExamRequests = () => {
    const rows = (examsQuery.data as ClinicalExamRequestRow[] | undefined) ?? [];
    const items = rows
      .map(
        (r) => {
          const code = r.examCatalogCode || r.code || r.loincCode || '—';
          return `<tr>
            <td>${escapeHtml(r.displayName)}</td>
            <td class="muted">${escapeHtml(code)}</td>
          </tr>`;
        }
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
              <tr><th>Exame</th><th>Código (TUSS/LOINC)</th></tr>
            </thead>
            <tbody>
              ${items || `<tr><td colspan="2" class="muted">Sem exames solicitados.</td></tr>`}
            </tbody>
          </table>
        </div>
      `,
    });
  };

  const [rxCopiesRaw, setRxCopiesRaw] = useState('2');
  const rxCopiesParsed = parseInt(rxCopiesRaw || '1', 10) || 1;
  const rxCopies = Math.min(Math.max(rxCopiesParsed, 1), 10);
  const handlePrintPrescription = () => {
    const rows =
      (rxQuery.data as ClinicalPrescriptionLineRow[] | undefined) ?? [];
    const tableRows = rows
      .map((r) => {
        const sig = [r.dosage, r.frequency, r.route].filter(Boolean).join(' · ');
        return `<tr>
          <td>${escapeHtml(r.medicationName)}</td>
          <td class="muted">${escapeHtml(sig || '—')}</td>
        </tr>`;
      })
      .join('');

    const single = `
      <h1>Receita</h1>
      <div class="muted">Paciente: ${escapeHtml(safePatientName)} · Profissional: ${escapeHtml(safeProfessionalName)}</div>
      <div class="box" style="margin-top: 12px;">
        <table>
          <thead><tr><th>Medicamento</th><th>Posologia</th></tr></thead>
          <tbody>
            ${tableRows || `<tr><td colspan="2" class="muted">Sem itens prescritos.</td></tr>`}
          </tbody>
        </table>
      </div>
    `;

    // 1 via por página. O “2 páginas por folha” deve ser configurado no diálogo de impressão do navegador.
    const copiesHtml = Array.from({ length: rxCopies })
      .map((_, idx) => {
        const label = `<div class="muted" style="margin-bottom: 6px;">Via ${idx + 1} de ${rxCopies}</div>`;
        return `${idx === 0 ? '' : '<div class="page-break"></div>'}${label}${single}`;
      })
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
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  tissForm.reset({
                    operatorName: '',
                    operatorANSCode: '',
                    beneficiaryName: safePatientName,
                    beneficiaryCardNumber: '',
                    requestingProfessionalName:
                      safeProfessionalName !== '—' ? safeProfessionalName : '',
                    requestingProfessionalCouncil: '',
                    requestingProfessionalCouncilUf: '',
                    requestingProfessionalRegistration: '',
                    requestingFacilityCnes: '',
                  });
                  setTissOpen(true);
                }}
                disabled={!enabled}
              >
                Emitir guia TISS (SP/SADT)
              </Button>
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
          </div>
          <p className="text-xs text-muted-foreground">
            {'Inclua/remova pedidos com a evolução aberta ou assinada.'}
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
              <Label htmlFor="exam-request-name">Exame (catálogo ou texto livre)</Label>
              <ExamCatalogCombobox
                options={examCatalogOptions}
                value={examName}
                onValueChange={(v) => {
                  setExamName(v);
                  setExamCatalogSelection(null);
                }}
                onSelectOption={(opt) => {
                  setExamCatalogSelection(opt.data);
                  setExamName(opt.data.displayName);
                }}
                placeholder="Pesquisar por nome ou código TUSS..."
                emptyText="Nenhum exame no catálogo — use o texto digitado."
                disabled={addExam.isPending}
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
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
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
            {'Inclua/remova itens com a evolução aberta ou assinada.'}
          </p>
          <p className="text-xs text-muted-foreground">
            {'Cada via sai em 1 página. Para 2 páginas por folha, ajuste no diálogo de impressão (Páginas por folha = 2).'}
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
            <>
              <PrescriptionHistoryPanel
                patientId={patientId}
                currentClinicalNoteId={clinicalNoteId}
                onReuse={(draft) => setRxDraft(draft)}
                onReuseAllFromNote={(drafts) => {
                  rxDraftQueueRef.current = [...drafts];
                  if (drafts[0]) setRxDraft(drafts[0]);
                  toast.message(
                    `${drafts.length} item(ns) na fila — confira e clique em Adicionar para cada um.`
                  );
                }}
              />
              <PrescriptionLineForm
                disabled={!canEditRx}
                pending={addRx.isPending}
                draft={rxDraft}
                onDraftConsumed={() => setRxDraft(null)}
                onSubmit={(values) => {
                  addRx.mutate(values, {
                    onSuccess: () => {
                      const queue = rxDraftQueueRef.current;
                      if (queue.length > 0) {
                        const [next, ...rest] = queue;
                        rxDraftQueueRef.current = rest;
                        setRxDraft(next);
                      }
                    },
                  });
                }}
              />
            </>
          )}
        </section>
      )}

      <Dialog open={tissOpen} onOpenChange={setTissOpen}>
        <DialogContent className="max-w-2xl">
          <DialogClose onClose={() => setTissOpen(false)} />
          <DialogHeader>
            <DialogTitle>Emitir guia TISS (SP/SADT)</DialogTitle>
            <DialogDescription>
              MVP: gera uma guia de solicitação e prepara para impressão (1 guia por página).
            </DialogDescription>
          </DialogHeader>

          <form
            className="space-y-4"
            onSubmit={tissForm.handleSubmit((values) => emitTiss.mutate(values))}
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="operatorName">Operadora</Label>
                <Input id="operatorName" {...tissForm.register('operatorName')} />
                {tissForm.formState.errors.operatorName?.message && (
                  <div className="text-xs text-red-600">
                    {tissForm.formState.errors.operatorName.message}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="operatorANSCode">Código ANS (opcional)</Label>
                <Input id="operatorANSCode" {...tissForm.register('operatorANSCode')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="beneficiaryName">Beneficiário</Label>
                <Input id="beneficiaryName" {...tissForm.register('beneficiaryName')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="beneficiaryCardNumber">Nº carteirinha (opcional)</Label>
                <Input
                  id="beneficiaryCardNumber"
                  {...tissForm.register('beneficiaryCardNumber')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="requestingProfessionalName">Profissional solicitante</Label>
                <Input
                  id="requestingProfessionalName"
                  {...tissForm.register('requestingProfessionalName')}
                />
              </div>
              <div className="grid grid-cols-3 gap-2 md:col-span-1">
                <div className="space-y-2">
                  <Label htmlFor="requestingProfessionalCouncil">Conselho</Label>
                  <Input
                    id="requestingProfessionalCouncil"
                    {...tissForm.register('requestingProfessionalCouncil')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="requestingProfessionalCouncilUf">UF</Label>
                  <Input
                    id="requestingProfessionalCouncilUf"
                    {...tissForm.register('requestingProfessionalCouncilUf')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="requestingProfessionalRegistration">Registro</Label>
                  <Input
                    id="requestingProfessionalRegistration"
                    {...tissForm.register('requestingProfessionalRegistration')}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="requestingFacilityCnes">CNES (opcional)</Label>
                <Input
                  id="requestingFacilityCnes"
                  {...tissForm.register('requestingFacilityCnes')}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setTissOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={emitTiss.isPending}>
                Emitir
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
