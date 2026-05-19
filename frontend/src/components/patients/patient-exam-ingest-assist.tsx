'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, Loader2, Mic, QrCode } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  examIngestApi,
  type ExamIngestSessionResponse,
} from '@/lib/api/exam-ingest';
import { useExamIngestSessionPoll } from '@/hooks/use-exam-ingest-session-poll';
import { ApiClientError } from '@/lib/api/client';
import { EXAM_INGEST_CLIENT_ACCEPT } from '@/lib/exam-ingest-file-accept';
import { skippedComplementaryExamsToastMessage } from '@/lib/utils/exam-ingest-skipped-message';
import { cn } from '@/lib/utils';

const ALLOWED_MIME_BASE = new Set<string>([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'audio/webm',
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/wav',
  'audio/x-wav',
  'audio/flac',
  'audio/ogg',
  'audio/opus',
]);

/** Alinhado a EXAM_INGEST_MAX_FILES_PER_SESSION no backend. */
const MAX_EXAM_FILES_PER_EXTRACT = 10;

const MAX_EXAM_RECORDING_MS = 5 * 60 * 1000;

function normalizeFileMime(file: File): string {
  return (file.type || '').split(';')[0].trim().toLowerCase();
}

function pickRecordingMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return undefined;
}

function fileDedupeKey(file: File): string {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

type Props = {
  patientId: string;
  clinicalNoteId?: string;
  disabled: boolean;
  onAppendMarkdown: (fragment: string) => void;
};

function isAllowedExamFile(file: File): boolean {
  return ALLOWED_MIME_BASE.has(normalizeFileMime(file));
}

export function PatientExamIngestAssist({
  patientId,
  clinicalNoteId,
  disabled,
  onAppendMarkdown,
}: Props): React.ReactElement {
  const [pasteText, setPasteText] = useState('');
  const [desktopFiles, setDesktopFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [session, setSession] = useState<ExamIngestSessionResponse | null>(
    null
  );
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [dropzoneDragging, setDropzoneDragging] = useState(false);

  const desktopFileInputRef = useRef<HTMLInputElement>(null);
  const sessionFileInputRef = useRef<HTMLInputElement>(null);
  const recordStreamRef = useRef<MediaStream | null>(null);
  const recordRecorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<number | null>(null);
  const recordMimeRef = useRef<string>('audio/webm');
  const recordLockRef = useRef(false);

  const queryClient = useQueryClient();

  const [isRecording, setIsRecording] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState('');

  const { data: poll } = useExamIngestSessionPoll(
    patientId,
    session?.sessionId ?? null,
    Boolean(session)
  );

  useEffect(() => {
    if (!session?.mobileUrl) {
      setQrDataUrl(null);
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(session.mobileUrl, { margin: 1, width: 220 })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [session?.mobileUrl]);

  const stopMediaStream = useCallback(() => {
    const s = recordStreamRef.current;
    recordStreamRef.current = null;
    if (s) {
      for (const t of s.getTracks()) {
        try {
          t.stop();
        } catch {
          /* ignore */
        }
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      if (recordTimerRef.current) {
        clearTimeout(recordTimerRef.current);
        recordTimerRef.current = null;
      }
      const rec = recordRecorderRef.current;
      recordRecorderRef.current = null;
      if (rec && rec.state !== 'inactive') {
        try {
          rec.onstop = () => {};
          rec.ondataavailable = null;
          rec.onerror = null;
          rec.stop();
        } catch {
          /* ignore */
        }
      }
      recordLockRef.current = false;
      stopMediaStream();
    };
  }, [stopMediaStream]);

  const handleExtract = useCallback(
    async (opts: {
      plainText?: string;
      sessionId?: string;
      files?: File[];
    }) => {
      if (disabled) return;
      setBusy(true);
      try {
        const res = await examIngestApi.extract(patientId, {
          plainText: opts.plainText,
          sessionId: opts.sessionId,
          files: opts.files?.length ? opts.files : undefined,
        });
        if (res.extractionSource === 'mock') {
          toast.error(
            'Extração em modo simulado (desenvolvimento) não pode ser usada como laudo real. Configure as chaves de IA ou use outro ambiente.'
          );
          return;
        }
        if (
          res.markdownFromStructuredParse !== true ||
          !res.markdownSummary?.trim()
        ) {
          toast.error(
            'Extração indisponível ou inválida; nada foi colado na evolução. Tente novamente.'
          );
          return;
        }
        const block = `${res.markdownSummary}\n\n_${res.disclaimer}_`;
        onAppendMarkdown(block);
        await queryClient.invalidateQueries({ queryKey: ['patient', patientId] });
        void queryClient.invalidateQueries({
          queryKey: ['patient-basic', patientId],
        });
        void queryClient.invalidateQueries({
          queryKey: ['patient-detail', patientId],
        });
        void queryClient.invalidateQueries({
          queryKey: ['patient-summary', patientId],
        });
        const skippedMsg = skippedComplementaryExamsToastMessage(
          res.skippedCount ?? 0
        );
        if (skippedMsg) {
          toast.warning(skippedMsg);
        }
        toast.success('Extração incorporada ao rascunho');
        setSession(null);
        setQrOpen(false);
        setDesktopFiles([]);
        setPasteText('');
      } catch (e) {
        const msg =
          e instanceof ApiClientError ? e.message : 'Não foi possível extrair';
        toast.error(msg);
      } finally {
        setBusy(false);
      }
    },
    [disabled, onAppendMarkdown, patientId, queryClient]
  );

  const stopRecording = useCallback(() => {
    const rec = recordRecorderRef.current;
    if (recordTimerRef.current) {
      clearTimeout(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    if (!rec || rec.state === 'inactive') {
      setIsRecording(false);
      setRecordingStatus('');
      stopMediaStream();
      recordLockRef.current = false;
      return;
    }
    setRecordingStatus('A terminar gravação…');
    rec.stop();
  }, [stopMediaStream]);

  const finalizeRecordingAndExtract = useCallback(
    async (blob: Blob, mimeFull: string) => {
      const baseMime = mimeFull.split(';')[0].trim().toLowerCase();
      const ext =
        baseMime === 'audio/ogg' || baseMime.endsWith('/ogg')
          ? 'ogg'
          : baseMime === 'audio/mpeg' || baseMime === 'audio/mp3'
            ? 'mp3'
            : 'webm';
      const audioFile = new File([blob], `exame-gravado-${Date.now()}.${ext}`, {
        type: baseMime || 'audio/webm',
      });
      if (!isAllowedExamFile(audioFile)) {
        toast.error('Formato de áudio gravado não suportado.');
        return;
      }
      const nextFiles = [...desktopFiles, audioFile];
      if (nextFiles.length > MAX_EXAM_FILES_PER_EXTRACT) {
        toast.error(
          `No máximo ${MAX_EXAM_FILES_PER_EXTRACT} ficheiros por extração (incluindo a gravação).`
        );
        return;
      }
      await handleExtract({
        files: nextFiles,
        plainText: pasteText.trim() || undefined,
      });
    },
    [desktopFiles, handleExtract, pasteText]
  );

  const startRecording = useCallback(async () => {
    if (disabled || busy || recordLockRef.current) return;
    const mime = pickRecordingMimeType();
    if (!mime) {
      toast.error('O navegador não suporta gravação de áudio neste formato.');
      return;
    }
    recordLockRef.current = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      recordStreamRef.current = stream;
      recordChunksRef.current = [];
      recordMimeRef.current = mime;
      const opts = MediaRecorder.isTypeSupported(mime)
        ? { mimeType: mime }
        : undefined;
      const rec = new MediaRecorder(stream, opts);
      recordRecorderRef.current = rec;
      rec.ondataavailable = (ev) => {
        if (ev.data.size > 0) recordChunksRef.current.push(ev.data);
      };
      rec.onerror = () => {
        toast.error('Erro durante a gravação.');
        recordLockRef.current = false;
        setIsRecording(false);
        setRecordingStatus('');
        stopMediaStream();
        if (recordTimerRef.current) {
          clearTimeout(recordTimerRef.current);
          recordTimerRef.current = null;
        }
      };
      rec.onstop = () => {
        const chunks = [...recordChunksRef.current];
        recordChunksRef.current = [];
        recordRecorderRef.current = null;
        stopMediaStream();
        recordLockRef.current = false;
        setIsRecording(false);
        setRecordingStatus('');
        const mimeUsed = recordMimeRef.current;
        const blob = new Blob(chunks, {
          type: mimeUsed.split(';')[0].trim() || 'audio/webm',
        });
        if (blob.size < 64) {
          toast.error('Gravação demasiado curta; tente novamente.');
          return;
        }
        void finalizeRecordingAndExtract(blob, mimeUsed);
      };
      if (recordTimerRef.current) clearTimeout(recordTimerRef.current);
      recordTimerRef.current = window.setTimeout(() => {
        recordTimerRef.current = null;
        stopRecording();
      }, MAX_EXAM_RECORDING_MS);
      rec.start(1000);
      setIsRecording(true);
      setRecordingStatus(
        'A gravar áudio do exame (máximo 5 minutos). Pare quando terminar.'
      );
    } catch (e) {
      recordLockRef.current = false;
      const denied =
        e instanceof DOMException &&
        (e.name === 'NotAllowedError' ||
          e.name === 'PermissionDeniedError');
      if (denied) {
        toast.error(
          'Permissão de microfone negada. Ative o microfone nas definições do navegador.'
        );
      } else {
        toast.error('Não foi possível aceder ao microfone.');
      }
      stopMediaStream();
    }
  }, [
    busy,
    disabled,
    finalizeRecordingAndExtract,
    stopMediaStream,
    stopRecording,
  ]);

  const toggleRecording = useCallback(() => {
    if (disabled || busy) return;
    if (isRecording) {
      stopRecording();
    } else {
      void startRecording();
    }
  }, [busy, disabled, isRecording, startRecording, stopRecording]);

  /** Desktop: um único pedido pode incluir vários ficheiros e/ou texto (multipart). */
  const submitDesktopExtract = useCallback(() => {
    if (disabled || busy || isRecording) return;
    const trimmed = pasteText.trim();
    if (desktopFiles.length === 0 && !trimmed) {
      toast.error(
        'Selecione ficheiros (PDF, imagem, áudio ou WebP), grave áudio ou cole o texto do exame antes de extrair.'
      );
      return;
    }
    void handleExtract({
      files: desktopFiles.length > 0 ? desktopFiles : undefined,
      plainText: trimmed || undefined,
    });
  }, [busy, desktopFiles, disabled, handleExtract, isRecording, pasteText]);

  const startQrSession = async () => {
    if (disabled) return;
    setBusy(true);
    try {
      const s = await examIngestApi.createSession(
        patientId,
        clinicalNoteId
      );
      setSession(s);
      setQrOpen(true);
    } catch (e) {
      toast.error(
        e instanceof ApiClientError ? e.message : 'Falha ao criar sessão'
      );
    } finally {
      setBusy(false);
    }
  };

  const uploadToSession = async (file: File) => {
    if (!session || disabled) return;
    await examIngestApi.uploadSessionFile(
      patientId,
      session.sessionId,
      file
    );
  };

  const uploadManyToSession = async (incoming: File[]) => {
    if (!session || disabled || incoming.length === 0) return;
    setBusy(true);
    let ok = 0;
    let rejected = 0;
    try {
      for (const file of incoming) {
        if (!isAllowedExamFile(file)) {
          rejected += 1;
          continue;
        }
        try {
          await uploadToSession(file);
          ok += 1;
        } catch (e) {
          toast.error(
            e instanceof ApiClientError ? e.message : 'Falha no envio para sessão'
          );
          break;
        }
      }
      if (ok > 0) {
        toast.success(
          ok === 1
            ? 'Ficheiro enviado para a sessão'
            : `${ok} ficheiros enviados para a sessão`
        );
      }
      if (rejected > 0 && ok === 0) {
        toast.error(
          'Formato não suportado. Use PDF, imagem (JPEG, PNG, WebP) ou áudio suportado.'
        );
      } else if (rejected > 0) {
        toast.error(
          `${rejected} ficheiro(s) ignorados (formato não suportado ou limite da sessão).`
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const addDesktopFiles = (fileList: FileList | File[] | null | undefined) => {
    if (!fileList?.length) return;
    const incoming = Array.from(fileList);
    const invalid = incoming.filter((f) => !isAllowedExamFile(f));
    if (invalid.length > 0) {
      toast.error(
        invalid.length === incoming.length
          ? 'Formato não suportado. Use PDF, imagem (JPEG, PNG, WebP) ou áudio suportado.'
          : 'Alguns ficheiros foram ignorados (formato não suportado).'
      );
    }
    const valid = incoming.filter((f) => isAllowedExamFile(f));
    if (valid.length === 0) return;

    setDesktopFiles((prev) => {
      const keys = new Set(prev.map(fileDedupeKey));
      const next = [...prev];
      let hitCap = false;
      for (const f of valid) {
        if (next.length >= MAX_EXAM_FILES_PER_EXTRACT) {
          hitCap = true;
          break;
        }
        const k = fileDedupeKey(f);
        if (!keys.has(k)) {
          keys.add(k);
          next.push(f);
        }
      }
      if (hitCap) {
        queueMicrotask(() => {
          toast.error(
            `No máximo ${MAX_EXAM_FILES_PER_EXTRACT} ficheiros por extração.`
          );
        });
      }
      return next;
    });
  };

  const openDesktopFilePicker = () => {
    if (disabled || busy || isRecording) return;
    desktopFileInputRef.current?.click();
  };

  return (
    <div className="rounded-md border border-dashed p-3 space-y-3 bg-muted/20">
      <div className="flex flex-wrap items-center gap-2">
        <p
          id="exam-ingest-assist-title"
          className="text-sm font-medium min-w-0"
        >
          Assistir entrada de exames (PDF, imagem, áudio ou texto)
        </p>
        <div className="flex flex-wrap gap-2 items-center shrink-0">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8 shrink-0 gap-2 px-4 text-xs min-w-[12rem] justify-center"
            disabled={disabled || busy || isRecording}
            onClick={() => void startQrSession()}
            aria-label="Gerar código QR para enviar exames pelo telefone"
          >
            <QrCode className="h-3.5 w-3.5 shrink-0" aria-hidden />
            QR / Envie fotos pelo telefone
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8 shrink-0 gap-2 px-3 text-xs"
            disabled={disabled || busy}
            onClick={toggleRecording}
            aria-pressed={isRecording}
            aria-label={
              isRecording
                ? 'Parar gravação de áudio do exame'
                : 'Iniciar gravação de áudio do exame (máximo 5 minutos)'
            }
          >
            <Mic className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {isRecording ? 'Parar gravação' : 'Gravar áudio'}
          </Button>
        </div>
      </div>
      <p
        className={cn(
          'text-xs text-muted-foreground min-h-[1.25rem]',
          !recordingStatus && 'sr-only'
        )}
        aria-live="polite"
        aria-atomic="true"
      >
        {recordingStatus || ' '}
      </p>
      <div
        className="max-h-[min(70vh,32rem)] overflow-y-auto space-y-3 pt-1 pr-1"
        role="region"
        aria-labelledby="exam-ingest-assist-title"
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:items-stretch">
          <div className="flex min-h-0 flex-col gap-2">
            <Label htmlFor="exam-ingest-desktop-file" className="sr-only">
              Escolher ficheiros de exame (PDF ou imagem), vários permitidos
            </Label>
            <input
              ref={desktopFileInputRef}
              id="exam-ingest-desktop-file"
              type="file"
              multiple
              accept={EXAM_INGEST_CLIENT_ACCEPT}
              disabled={disabled || busy || isRecording}
              tabIndex={-1}
              className="sr-only"
              onChange={(e) => {
                addDesktopFiles(e.target.files);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              disabled={disabled || busy || isRecording}
              onClick={openDesktopFilePicker}
              onDragEnter={(e) => {
                e.preventDefault();
                if (disabled || busy) return;
                setDropzoneDragging(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                  setDropzoneDragging(false);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDropzoneDragging(false);
                if (disabled || busy) return;
                addDesktopFiles(e.dataTransfer.files);
              }}
              aria-label="Selecionar ficheiros de exame: arraste e largue aqui ou clique. Vários ficheiros permitidos. Formatos PDF, imagem (JPEG, PNG, WebP) ou áudio suportado."
              className={cn(
                'flex min-h-[10rem] w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed border-input bg-background px-4 py-6 text-center text-sm text-muted-foreground transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                'disabled:pointer-events-none disabled:opacity-50',
                dropzoneDragging && 'border-primary bg-muted/40 text-foreground'
              )}
            >
              <span aria-hidden="true">
                Arraste ficheiros aqui ou clique para selecionar
              </span>
              <span className="text-xs opacity-80" aria-hidden="true">
                PDF, imagem, áudio — até {MAX_EXAM_FILES_PER_EXTRACT} ficheiros
              </span>
            </button>
            <div className="flex flex-col gap-1">
              <p
                id="exam-ingest-selected-file"
                className={cn(
                  'text-xs text-muted-foreground min-h-[1.25rem]',
                  desktopFiles.length === 0 && 'sr-only'
                )}
                aria-live="polite"
              >
                {desktopFiles.length > 0
                  ? `Selecionado(s) (${desktopFiles.length}): ${desktopFiles.map((f) => f.name).join(', ')}`
                  : 'Nenhum ficheiro selecionado'}
              </p>
              {desktopFiles.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-fit self-start px-2 text-xs text-muted-foreground"
                  disabled={disabled || busy || isRecording}
                  onClick={() => setDesktopFiles([])}
                >
                  Limpar ficheiros
                </Button>
              )}
            </div>
          </div>

          <div className="flex min-h-0 flex-col gap-2 md:h-full">
            <Label htmlFor="exam-paste" className="sr-only">
              Colar resultado de exame (texto livre)
            </Label>
            <Textarea
              id="exam-paste"
              rows={6}
              value={pasteText}
              disabled={disabled || busy || isRecording}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="Colar resultado de exame (texto livre)"
              className="min-h-[10rem] flex-1 resize-y font-mono text-xs md:min-h-0"
            />
          </div>
        </div>

        <Button
          type="button"
          size="sm"
          className="w-fit shrink-0"
          disabled={
            disabled ||
            busy ||
            (desktopFiles.length === 0 && !pasteText.trim())
          }
          onClick={() => void submitDesktopExtract()}
          aria-label="Processar ficheiros selecionados e/ou texto colado e acrescentar ao rascunho"
          aria-describedby="exam-ingest-selected-file"
        >
          Extrair e acrescentar ao rascunho
        </Button>

        {session && (
          <div
            className="rounded-md border border-border bg-muted/30 p-3 space-y-2"
            role="status"
            aria-label="Estado da sessão de envio móvel"
          >
            {poll && poll.fileCount > 0 && (
              <p className="text-xs text-green-700 dark:text-green-400">
                {poll.fileCount} ficheiro(s) na sessão — pode extrair.
              </p>
            )}
            <div className="flex flex-wrap gap-2 items-center">
              <Button
                type="button"
                size="sm"
                disabled={disabled || busy || isRecording || !poll?.fileCount}
                onClick={() =>
                  void handleExtract({ sessionId: session.sessionId })
                }
              >
                Extrair da sessão móvel
              </Button>
              <span className="text-xs text-muted-foreground">
                ou envie pelo PC:
              </span>
              <Label
                htmlFor="exam-ingest-session-desktop-file"
                className="sr-only"
              >
                Enviar ficheiros para a sessão móvel a partir deste computador
              </Label>
              <input
                ref={sessionFileInputRef}
                id="exam-ingest-session-desktop-file"
                type="file"
                multiple
                accept={EXAM_INGEST_CLIENT_ACCEPT}
                disabled={disabled || busy || isRecording}
                tabIndex={-1}
                className="sr-only"
                onChange={(e) => {
                  const list = e.target.files;
                  e.target.value = '';
                  if (list?.length) {
                    void uploadManyToSession(Array.from(list));
                  }
                }}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                disabled={disabled || busy || isRecording}
                onClick={() => sessionFileInputRef.current?.click()}
              >
                Escolher ficheiros
              </Button>
            </div>
          </div>
        )}
      </div>

      <Dialog
        open={qrOpen}
        onOpenChange={(open) => {
          setQrOpen(open);
          if (!open) {
            /* mantém sessão para continuar a receber uploads até extrair */
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Enviar pelo telefone</DialogTitle>
          </DialogHeader>
          {session && (
            <div className="flex flex-col items-center gap-3">
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrDataUrl} alt="QR para upload" width={220} height={220} />
              ) : (
                <div className="h-[220px] w-[220px] flex items-center justify-center text-muted-foreground text-sm">
                  A gerar QR…
                </div>
              )}
              <p className="text-xs text-muted-foreground text-center break-all px-1">
                {session.mobileUrl}
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  void navigator.clipboard.writeText(session.mobileUrl);
                  toast.success('Link copiado');
                }}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copiar link
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {busy && (
        <p className="text-xs flex items-center gap-1 text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          A processar…
        </p>
      )}
    </div>
  );
}
